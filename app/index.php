<?php
declare(strict_types=1);

require_once __DIR__ . "/../app/lib/db.php";
require_once __DIR__ . "/../app/lib/piece.php";

header("Content-Type: application/json; charset=utf-8");

function json_in(): array {
  $raw = file_get_contents("php://input") ?: "";
  $data = json_decode($raw, true);
  if (!is_array($data)) throw new Exception("Invalid JSON");
  return $data;
}

function respond(int $code, array $payload): void {
  http_response_code($code);
  echo json_encode($payload);
  exit;
}

try {
  $uri = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH) ?: "";
  $path = trim($uri, "/");         // api/pieces/123
  $segments = $path === "" ? [] : explode("/", $path);

  if (count($segments) < 2 || $segments[0] !== "api") {
    respond(404, ["error" => "Not found"]);
  }

  $method = $_SERVER["REQUEST_METHOD"];
  $resource = $segments[1] ?? "";

  // GET /api/health (never hard-fails; always 200)
  if ($method === "GET" && $resource === "health") {
    respond(200, db_health());
  }

  // GET /api/debug/db  (dev-only; never requires DB connection)
  if ($method === "GET" && $resource === "debug" && (($segments[2] ?? "") === "db")) {
    $debugEnabled = is_replit() || (getenv("ENABLE_DEBUG_ENDPOINTS") === "1");
    if (!$debugEnabled) respond(404, ["error" => "Not found"]);

    if (!function_exists("db_debug_info")) {
      respond(200, [
        "ok" => false,
        "driver" => "none",
        "error" => "db_debug_info() is not defined. Add it to app/lib/db.php inside the PHP block."
      ]);
    }

    respond(200, db_debug_info());
  }

  // Everything below requires a DB connection
  $pdo = pdo_conn();

  if ($resource !== "pieces") {
    respond(404, ["error" => "Not found"]);
  }

  // POST /api/pieces
  if ($method === "POST" && count($segments) === 2) {
    $body = json_in();
    if (!isset($body["config"]) || !is_array($body["config"])) throw new Exception("Missing config");

    $config = $body["config"];
    validate_config($config);

    $visibility = validate_visibility((string)($body["visibility"] ?? "public"));
    $requestedSlug = normalize_slug((string)($body["slug"] ?? ""));
    $adminKey = generate_admin_key();

    $slug = $requestedSlug !== "" ? $requestedSlug : generate_slug();

    // Ensure slug uniqueness
    $checkStmt = $pdo->prepare("SELECT id FROM pieces WHERE slug = :slug LIMIT 1");
    for ($i = 0; $i < 5; $i++) {
      $checkStmt->execute([":slug" => $slug]);
      if (!$checkStmt->fetch()) break;
      $slug = generate_slug();
    }
    $checkStmt->execute([":slug" => $slug]);
    if ($checkStmt->fetch()) respond(409, ["error" => "Slug already exists"]);

    $json = json_encode($config, JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new Exception("Config encode failed");

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    if ($driver === "sqlite") {
      $stmt = $pdo->prepare("
        INSERT INTO pieces (created_at, slug, visibility, admin_key, config_json)
        VALUES (:created_at, :slug, :visibility, :admin_key, :config_json)
      ");
      $stmt->execute([
        ":created_at" => gmdate("c"),
        ":slug" => $slug,
        ":visibility" => $visibility,
        ":admin_key" => $adminKey,
        ":config_json" => $json
      ]);
    } else {
      $stmt = $pdo->prepare("
        INSERT INTO pieces (slug, visibility, admin_key, config_json)
        VALUES (:slug, :visibility, :admin_key, :config_json)
      ");
      $stmt->execute([
        ":slug" => $slug,
        ":visibility" => $visibility,
        ":admin_key" => $adminKey,
        ":config_json" => $json
      ]);
    }

    respond(200, [
      "id" => (int)$pdo->lastInsertId(),
      "slug" => $slug,
      "visibility" => $visibility,
      "adminKey" => $adminKey
    ]);
  }

  // GET /api/pieces/{ref}
  if ($method === "GET" && count($segments) === 3) {
    $ref = (string)$segments[2];

    if (is_numeric_id($ref)) {
      $stmt = $pdo->prepare("SELECT id, slug, visibility, config_json FROM pieces WHERE id = :id LIMIT 1");
      $stmt->execute([":id" => (int)$ref]);
    } else {
      $stmt = $pdo->prepare("SELECT id, slug, visibility, config_json FROM pieces WHERE slug = :slug LIMIT 1");
      $stmt->execute([":slug" => $ref]);
    }

    $row = $stmt->fetch();
    if (!$row) respond(404, ["error" => "Not found"]);

    respond(200, [
      "id" => (int)$row["id"],
      "slug" => (string)$row["slug"],
      "visibility" => (string)$row["visibility"],
      "config" => json_decode((string)$row["config_json"], true)
    ]);
  }

  // PATCH /api/pieces/{ref}
  if ($method === "PATCH" && count($segments) === 3) {
    $ref = (string)$segments[2];
    $adminKey = (string)($_SERVER["HTTP_X_ADMIN_KEY"] ?? "");
    if ($adminKey === "") respond(401, ["error" => "Missing admin key"]);

    $body = json_in();
    $visibility = validate_visibility((string)($body["visibility"] ?? ""));

    if (is_numeric_id($ref)) {
      $stmt = $pdo->prepare("SELECT admin_key FROM pieces WHERE id = :id LIMIT 1");
      $stmt->execute([":id" => (int)$ref]);
    } else {
      $stmt = $pdo->prepare("SELECT admin_key FROM pieces WHERE slug = :slug LIMIT 1");
      $stmt->execute([":slug" => $ref]);
    }

    $row = $stmt->fetch();
    if (!$row) respond(404, ["error" => "Not found"]);
    if ((string)$row["admin_key"] !== $adminKey) respond(403, ["error" => "Invalid admin key"]);

    if (is_numeric_id($ref)) {
      $up = $pdo->prepare("UPDATE pieces SET visibility = :v WHERE id = :id");
      $up->execute([":v" => $visibility, ":id" => (int)$ref]);
    } else {
      $up = $pdo->prepare("UPDATE pieces SET visibility = :v WHERE slug = :slug");
      $up->execute([":v" => $visibility, ":slug" => $ref]);
    }

    respond(200, ["ok" => true, "visibility" => $visibility]);
  }

  respond(405, ["error" => "Method not allowed"]);
} catch (Throwable $e) {
  respond(400, ["error" => $e->getMessage()]);
}
