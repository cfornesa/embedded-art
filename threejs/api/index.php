<?php
declare(strict_types=1);

require_once __DIR__ . "/../app/lib/constants.php";
require_once __DIR__ . "/../app/lib/db.php";
require_once __DIR__ . "/../app/lib/piece.php";
require_once __DIR__ . "/../app/lib/logger.php";
require_once __DIR__ . "/../app/lib/rate_limit.php";

header("Content-Type: application/json; charset=utf-8");

// Security headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Load API configuration from environment variables and/or config.php
// Config is located at repository root: /app/lib/config.php
$apiConfig = [];
$configFile = __DIR__ . "/../../app/lib/config.php";
if (file_exists($configFile)) {
  $fileConfig = require $configFile;
  if (is_array($fileConfig)) {
    $apiConfig = $fileConfig;
  }
}

// CORS headers
// Configure via environment variable ALLOWED_ORIGINS (comma-separated) or config.php
// Defaults to '*' (allow all) if not configured - set specific origins in production
$allowedOriginsEnv = getenv('ALLOWED_ORIGINS') ?: ($apiConfig['ALLOWED_ORIGINS'] ?? '');
$allowed_origins = $allowedOriginsEnv ? array_map('trim', explode(',', $allowedOriginsEnv)) : ['*'];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array('*', $allowed_origins, true) || in_array($origin, $allowed_origins, true)) {
  header("Access-Control-Allow-Origin: " . (in_array('*', $allowed_origins, true) ? '*' : $origin));
  header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type, X-Admin-Key");
  header("Access-Control-Max-Age: 86400");
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

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
  // Enable by setting environment variable ENABLE_DEBUG_ENDPOINTS=1 or in config.php
  if ($method === "GET" && $resource === "debug" && (($segments[2] ?? "") === "db")) {
    $debugEnabled = (getenv("ENABLE_DEBUG_ENDPOINTS") === "1") || ($apiConfig['ENABLE_DEBUG_ENDPOINTS'] ?? '') === '1';
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

  // GET /api/debug/mysql  (dev-only; shows MySQL configuration)
  if ($method === "GET" && $resource === "debug" && (($segments[2] ?? "") === "mysql")) {
    $debugEnabled = (getenv("ENABLE_DEBUG_ENDPOINTS") === "1") || ($apiConfig['ENABLE_DEBUG_ENDPOINTS'] ?? '') === '1';
    if (!$debugEnabled) respond(404, ["error" => "Not found"]);

    $pdo = pdo_conn();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    if ($driver !== "mysql") {
      respond(200, ["error" => "Not using MySQL (driver: {$driver})"]);
    }

    // Get MySQL configuration variables
    $vars = [
      'max_allowed_packet',
      'wait_timeout',
      'interactive_timeout',
      'character_set_server',
      'collation_server',
      'innodb_strict_mode',
      'sql_mode'
    ];

    $config = [];
    foreach ($vars as $var) {
      try {
        $stmt = $pdo->query("SHOW VARIABLES LIKE '{$var}'");
        $row = $stmt->fetch();
        $config[$var] = $row ? $row['Value'] : 'unknown';
      } catch (Throwable $e) {
        $config[$var] = 'error: ' . $e->getMessage();
      }
    }

    respond(200, [
      "driver" => $driver,
      "server_version" => $pdo->getAttribute(PDO::ATTR_SERVER_VERSION),
      "client_version" => $pdo->getAttribute(PDO::ATTR_CLIENT_VERSION),
      "connection_status" => $pdo->getAttribute(PDO::ATTR_CONNECTION_STATUS),
      "variables" => $config
    ]);
  }

  // Everything below requires a DB connection
  $pdo = pdo_conn();

  if ($resource !== "pieces") {
    respond(404, ["error" => "Not found"]);
  }

  // POST /api/pieces
  if ($method === "POST" && count($segments) === 2) {
    // Rate limiting for POST requests
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    check_rate_limit($ip, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS);

    $body = json_in();
    if (!isset($body["config"]) || !is_array($body["config"])) throw new Exception("Missing config");

    $config = $body["config"];
    validate_config($config);

    // Validate email (required)
    if (!isset($body["email"]) || !is_string($body["email"])) {
      throw new Exception("Email is required");
    }
    $email = validate_email((string)$body["email"]);

    $visibility = validate_visibility((string)($body["visibility"] ?? "public"));
    $requestedSlug = normalize_slug((string)($body["slug"] ?? ""));
    $adminKey = generate_admin_key();

    $userProvidedSlug = $requestedSlug !== "";
    $slug = $userProvidedSlug ? $requestedSlug : generate_slug();

    // Check slug uniqueness
    $checkStmt = $pdo->prepare("SELECT id FROM pieces WHERE slug = :slug LIMIT 1");

    if ($userProvidedSlug) {
      // User provided a custom slug - fail immediately if taken
      $checkStmt->execute([":slug" => $slug]);
      if ($checkStmt->fetch()) {
        Logger::warning('slug_conflict_user_provided', ['slug' => $slug, 'ip' => $ip]);
        respond(409, ["error" => "Slug '$slug' is already taken. Please choose a different slug."]);
      }
    } else {
      // Auto-generated slug - retry if conflict (very unlikely)
      for ($i = 0; $i < SLUG_RETRY_ATTEMPTS; $i++) {
        $checkStmt->execute([":slug" => $slug]);
        if (!$checkStmt->fetch()) break;
        $slug = generate_slug();
      }
      // Final check
      $checkStmt->execute([":slug" => $slug]);
      if ($checkStmt->fetch()) {
        Logger::error('slug_generation_exhausted', ['attempts' => SLUG_RETRY_ATTEMPTS, 'ip' => $ip]);
        respond(500, ["error" => "Unable to generate unique slug. Please try again."]);
      }
    }

    $json = json_encode($config, JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new Exception("Config encode failed");

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    try {
      if ($driver === "sqlite") {
        $stmt = $pdo->prepare("
          INSERT INTO pieces (created_at, slug, visibility, admin_key, email, config_json)
          VALUES (:created_at, :slug, :visibility, :admin_key, :email, :config_json)
        ");
        $stmt->execute([
          ":created_at" => gmdate("c"),
          ":slug" => $slug,
          ":visibility" => $visibility,
          ":admin_key" => $adminKey,
          ":email" => $email,
          ":config_json" => $json
        ]);
      } else {
        $stmt = $pdo->prepare("
          INSERT INTO pieces (slug, visibility, admin_key, email, config_json)
          VALUES (:slug, :visibility, :admin_key, :email, :config_json)
        ");
        $stmt->execute([
          ":slug" => $slug,
          ":visibility" => $visibility,
          ":admin_key" => $adminKey,
          ":email" => $email,
          ":config_json" => $json
        ]);
      }

      $pieceId = (int)$pdo->lastInsertId();

      // Send confirmation email with piece details and configuration
      $emailSent = send_piece_created_email($email, $pieceId, $slug, $adminKey, $config);

      Logger::audit('piece_created', [
        'id' => $pieceId,
        'slug' => $slug,
        'visibility' => $visibility,
        'email' => $email,
        'email_sent' => $emailSent,
        'ip' => $ip
      ]);

      respond(200, [
        "id" => $pieceId,
        "slug" => $slug,
        "visibility" => $visibility,
        "adminKey" => $adminKey,
        "emailSent" => $emailSent
      ]);
    } catch (PDOException $e) {
      if ($e->getCode() === '23000') {
        // Duplicate key error
        Logger::warning('duplicate_key_error', ['slug' => $slug, 'error' => $e->getMessage()]);
        respond(409, ["error" => "Duplicate entry. Please try again."]);
      }
      throw $e;
    }
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

    $visibility = (string)$row["visibility"];
    $configJson = (string)$row["config_json"];

    // Add caching headers for public pieces
    if ($visibility === "public") {
      $etag = md5($configJson);
      // Use must-revalidate to allow caching but force check on each request
      // This lets edits be seen immediately while still benefiting from ETag
      header("Cache-Control: public, max-age=3600, must-revalidate");
      header("ETag: \"$etag\"");

      // Check if client has cached version with matching ETag
      $clientEtag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
      if ($clientEtag === "\"$etag\"") {
        // Content hasn't changed - send 304
        http_response_code(304);
        exit;
      }
    } else {
      header("Cache-Control: private, no-cache");
    }

    respond(200, [
      "id" => (int)$row["id"],
      "slug" => (string)$row["slug"],
      "visibility" => $visibility,
      "config" => json_decode($configJson, true)
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
    if ((string)$row["admin_key"] !== $adminKey) {
      Logger::warning('invalid_admin_key_patch', ['ref' => $ref, 'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
      respond(403, ["error" => "Invalid admin key"]);
    }

    if (is_numeric_id($ref)) {
      $up = $pdo->prepare("UPDATE pieces SET visibility = :v WHERE id = :id");
      $up->execute([":v" => $visibility, ":id" => (int)$ref]);
    } else {
      $up = $pdo->prepare("UPDATE pieces SET visibility = :v WHERE slug = :slug");
      $up->execute([":v" => $visibility, ":slug" => $ref]);
    }

    Logger::audit('piece_visibility_updated', [
      'ref' => $ref,
      'visibility' => $visibility,
      'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);

    respond(200, ["ok" => true, "visibility" => $visibility]);
  }

  // PUT /api/pieces/{ref}
  if ($method === "PUT" && count($segments) === 3) {
    $ref = (string)$segments[2];
    $adminKey = (string)($_SERVER["HTTP_X_ADMIN_KEY"] ?? "");
    if ($adminKey === "") respond(401, ["error" => "Missing admin key"]);

    // Fetch existing piece to verify ownership and get current data (including email for notification)
    if (is_numeric_id($ref)) {
      $stmt = $pdo->prepare("SELECT id, slug, admin_key, visibility, config_json, created_at, email FROM pieces WHERE id = :id LIMIT 1");
      $stmt->execute([":id" => (int)$ref]);
    } else {
      $stmt = $pdo->prepare("SELECT id, slug, admin_key, visibility, config_json, created_at, email FROM pieces WHERE slug = :slug LIMIT 1");
      $stmt->execute([":slug" => $ref]);
    }

    $row = $stmt->fetch();
    if (!$row) respond(404, ["error" => "Not found"]);
    if ((string)$row["admin_key"] !== $adminKey) {
      Logger::warning('invalid_admin_key_update', ['ref' => $ref, 'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
      respond(403, ["error" => "Invalid admin key"]);
    }

    // Parse request body
    $body = json_decode(file_get_contents("php://input"), true);
    if (!is_array($body)) respond(400, ["error" => "Invalid JSON body"]);

    // Validate and update config (required)
    if (!isset($body["config"]) || !is_array($body["config"])) {
      respond(400, ["error" => "Missing or invalid config"]);
    }

    try {
      validate_config($body["config"]); // Validates and throws on error
      $newConfig = $body["config"]; // Use validated config
      $configJson = json_encode($newConfig, JSON_THROW_ON_ERROR);
    } catch (Exception $e) {
      respond(400, ["error" => "Invalid config: " . $e->getMessage()]);
    }

    // Optional visibility update
    $newVisibility = isset($body["visibility"])
      ? validate_visibility((string)$body["visibility"])
      : (string)$row["visibility"];

    // Log before update for debugging
    Logger::info('update_attempt', [
      'ref' => $ref,
      'is_numeric' => is_numeric_id($ref),
      'new_config_size' => strlen($configJson),
      'new_visibility' => $newVisibility,
      'old_config_size' => strlen((string)$row['config_json']),
      'old_visibility' => (string)$row['visibility']
    ]);

    // Update the piece
    if (is_numeric_id($ref)) {
      $update = $pdo->prepare("UPDATE pieces SET config_json = :config, visibility = :visibility WHERE id = :id");
      $update->execute([
        ":config" => $configJson,
        ":visibility" => $newVisibility,
        ":id" => (int)$ref
      ]);
    } else {
      $update = $pdo->prepare("UPDATE pieces SET config_json = :config, visibility = :visibility WHERE slug = :slug");
      $update->execute([
        ":config" => $configJson,
        ":visibility" => $newVisibility,
        ":slug" => $ref
      ]);
    }

    // Verify the update actually succeeded
    $rowsAffected = $update->rowCount();
    if ($rowsAffected === 0) {
      Logger::error('update_failed_no_rows_affected', [
        'ref' => $ref,
        'is_numeric' => is_numeric_id($ref),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
      ]);
      respond(500, ["error" => "Update failed: no rows affected"]);
    }

    // Verify data was actually written to database
    if (is_numeric_id($ref)) {
      $verify = $pdo->prepare("SELECT config_json, visibility FROM pieces WHERE id = :id LIMIT 1");
      $verify->execute([":id" => (int)$ref]);
    } else {
      $verify = $pdo->prepare("SELECT config_json, visibility FROM pieces WHERE slug = :slug LIMIT 1");
      $verify->execute([":slug" => $ref]);
    }

    $verifyRow = $verify->fetch();
    $dbConfigMatches = $verifyRow && (string)$verifyRow['config_json'] === $configJson;
    $dbVisibilityMatches = $verifyRow && (string)$verifyRow['visibility'] === $newVisibility;

    Logger::info('update_successful', [
      'ref' => $ref,
      'rows_affected' => $rowsAffected,
      'config_size' => strlen($configJson),
      'db_config_matches' => $dbConfigMatches,
      'db_visibility_matches' => $dbVisibilityMatches,
      'verification' => $verifyRow ? 'found' : 'not_found'
    ]);

    // If verification failed, log detailed error
    if (!$dbConfigMatches || !$dbVisibilityMatches) {
      Logger::error('update_verification_mismatch', [
        'ref' => $ref,
        'config_matches' => $dbConfigMatches,
        'visibility_matches' => $dbVisibilityMatches,
        'expected_config_size' => strlen($configJson),
        'actual_config_size' => $verifyRow ? strlen((string)$verifyRow['config_json']) : 0,
        'expected_visibility' => $newVisibility,
        'actual_visibility' => $verifyRow ? (string)$verifyRow['visibility'] : 'null'
      ]);
      respond(500, ["error" => "Update verification failed: data mismatch after write"]);
    }

    // Send update notification email with new configuration
    $emailSent = false;
    $email = (string)($row['email'] ?? '');
    if ($email !== '') {
      try {
        $emailSent = send_piece_updated_email($email, (int)$row['id'], (string)$row['slug'], $newConfig);
      } catch (Throwable $e) {
        error_log("Failed to send update email: " . $e->getMessage());
        // Continue even if email fails
      }
    }

    Logger::audit('piece_updated', [
      'id' => (int)$row['id'],
      'slug' => (string)$row['slug'],
      'ref' => $ref,
      'visibility' => $newVisibility,
      'email' => $email,
      'email_sent' => $emailSent,
      'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);

    // Return updated piece data (without admin_key for security)
    respond(200, [
      "ok" => true,
      "id" => (int)$row["id"],
      "slug" => (string)$row["slug"],
      "visibility" => $newVisibility,
      "config" => $newConfig,
      "created_at" => (string)$row["created_at"]
    ]);
  }

  // DELETE /api/pieces/{ref}
  if ($method === "DELETE" && count($segments) === 3) {
    $ref = (string)$segments[2];
    $adminKey = (string)($_SERVER["HTTP_X_ADMIN_KEY"] ?? "");
    if ($adminKey === "") respond(401, ["error" => "Missing admin key"]);

    // Fetch piece details including email and config for deletion notification
    // IMPORTANT: Must fetch everything BEFORE deletion since it won't be accessible afterward
    if (is_numeric_id($ref)) {
      $stmt = $pdo->prepare("SELECT id, slug, admin_key, visibility, email, config_json FROM pieces WHERE id = :id LIMIT 1");
      $stmt->execute([":id" => (int)$ref]);
    } else {
      $stmt = $pdo->prepare("SELECT id, slug, admin_key, visibility, email, config_json FROM pieces WHERE slug = :slug LIMIT 1");
      $stmt->execute([":slug" => $ref]);
    }

    $row = $stmt->fetch();
    if (!$row) respond(404, ["error" => "Not found"]);
    if ((string)$row["admin_key"] !== $adminKey) {
      Logger::warning('invalid_admin_key_delete', ['ref' => $ref, 'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
      respond(403, ["error" => "Invalid admin key"]);
    }

    // Parse configuration for email notification
    $config = [];
    try {
      $configJson = (string)($row['config_json'] ?? '{}');
      $config = json_decode($configJson, true) ?? [];
    } catch (Throwable $e) {
      error_log("Failed to parse config for deletion email: " . $e->getMessage());
      // Continue with deletion even if config parsing fails
    }

    // Send deletion notification email BEFORE deleting the piece
    $emailSent = false;
    $email = (string)($row['email'] ?? '');
    if ($email !== '') {
      try {
        $emailSent = send_piece_deleted_email($email, (int)$row['id'], (string)$row['slug'], $config);
      } catch (Throwable $e) {
        error_log("Failed to send deletion email: " . $e->getMessage());
        // Continue with deletion even if email fails
      }
    }

    // Hard delete - permanently remove from database
    if (is_numeric_id($ref)) {
      $del = $pdo->prepare("DELETE FROM pieces WHERE id = :id");
      $del->execute([":id" => (int)$ref]);
    } else {
      $del = $pdo->prepare("DELETE FROM pieces WHERE slug = :slug");
      $del->execute([":slug" => $ref]);
    }

    Logger::audit('piece_deleted', [
      'id' => (int)$row['id'],
      'slug' => (string)$row['slug'],
      'ref' => $ref,
      'visibility' => (string)$row['visibility'],
      'email' => $email,
      'email_sent' => $emailSent,
      'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
      'permanent' => true
    ]);

    respond(200, ["ok" => true, "deleted" => true, "emailSent" => $emailSent]);
  }

  respond(405, ["error" => "Method not allowed"]);

} catch (PDOException $e) {
  // Database-specific errors
  $code = $e->getCode();
  Logger::error('database_error', [
    'code' => $code,
    'message' => $e->getMessage(),
    'file' => $e->getFile(),
    'line' => $e->getLine()
  ]);

  if ($code === '23000') {
    respond(409, ["error" => "Duplicate entry conflict"]);
  }
  respond(500, ["error" => "Database error"]);

} catch (Exception $e) {
  // Business logic / validation errors
  Logger::warning('validation_error', [
    'message' => $e->getMessage(),
    'file' => $e->getFile(),
    'line' => $e->getLine()
  ]);
  respond(400, ["error" => $e->getMessage()]);

} catch (Throwable $e) {
  // Unexpected errors
  Logger::error('unexpected_error', [
    'error' => $e->getMessage(),
    'trace' => $e->getTraceAsString(),
    'file' => $e->getFile(),
    'line' => $e->getLine()
  ]);
  respond(500, ["error" => "Internal server error"]);
}
