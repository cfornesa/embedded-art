<?php
declare(strict_types=1);

/**
 * app/lib/db.php
 *
 * Goals:
 * 1) Platform-agnostic: same codebase runs on Replit (dev) and Hostinger (prod) without edits.
 * 2) Safe default: if MySQL isn't reachable, automatically fall back to SQLite (never hard-break).
 * 3) Minimal coupling: API code calls pdo_conn() for DB access and db_health()/db_debug_info() for status.
 * 4) Security: never output credentials; config.php is allowed to exist anywhere but will not break dev.
 *
 * DB selection rules:
 * - If DB_DRIVER=sqlite -> use SQLite only (no MySQL attempts).
 * - If DB_DRIVER=mysql  -> try MySQL; if it fails, fall back to SQLite.
 * - If DB_DRIVER unset:
 *    - If MySQL creds exist -> try MySQL; if it fails, fall back to SQLite.
 *    - Else -> use SQLite.
 *
 * Hostinger socket gotcha:
 * - When DB_HOST = "localhost", MySQL can try a local socket.
 * - Some environments prefer TCP. So we try "localhost" then "127.0.0.1".
 */

/**
 * Returns true if we appear to be running on Replit.
 * Used only for diagnostics / potential environment decisions (not required for DB selection).
 */
function is_replit(): bool {
  return (bool)getenv("REPL_ID") || (bool)getenv("REPL_SLUG") || (bool)getenv("REPL_OWNER");
}

/**
 * Load DB configuration from environment variables and (optionally) app/lib/config.php.
 *
 * - Env vars are useful on any host.
 * - config.php is useful on Hostinger (private creds) and may still exist on Replit
 *   without breaking anything.
 *
 * config.php should return an array like:
 *   return [
 *     "DB_DRIVER" => "mysql",
 *     "DB_HOST" => "localhost",
 *     "DB_NAME" => "...",
 *     "DB_USER" => "...",
 *     "DB_PASS" => "..."
 *   ];
 */
function load_config(): array {
  $cfg = [
    "DB_DRIVER" => getenv("DB_DRIVER") ?: "",
    "DB_HOST"   => getenv("DB_HOST") ?: "",
    "DB_NAME"   => getenv("DB_NAME") ?: "",
    "DB_USER"   => getenv("DB_USER") ?: "",
    "DB_PASS"   => getenv("DB_PASS") ?: "",
  ];

  $file = __DIR__ . "/config.php";
  if (file_exists($file)) {
    $fileCfg = require $file;
    if (is_array($fileCfg)) {
      $cfg = array_merge($cfg, $fileCfg);
    }
  }

  return $cfg;
}

/**
 * Whether we have enough info to attempt a MySQL connection.
 */
function has_mysql_creds(array $cfg): bool {
  return !empty($cfg["DB_HOST"]) && !empty($cfg["DB_NAME"]) && !empty($cfg["DB_USER"]);
}

/**
 * Ensure MySQL schema exists.
 */
function ensure_mysql_schema(PDO $pdo): void {
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS pieces (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      slug VARCHAR(60) NOT NULL,
      visibility VARCHAR(12) NOT NULL DEFAULT 'public',
      admin_key VARCHAR(64) NOT NULL,
      config_json LONGTEXT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ");
}

/**
 * Ensure SQLite schema exists.
 */
function ensure_sqlite_schema(PDO $pdo): void {
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      visibility TEXT NOT NULL DEFAULT 'public',
      admin_key TEXT NOT NULL,
      config_json TEXT NOT NULL
    )
  ");
}

/**
 * Attempt to connect to MySQL with the provided config.
 * Tries DB_HOST as specified; if it's "localhost", also tries "127.0.0.1".
 *
 * Throws Exception on failure.
 */
function try_mysql(array $cfg): PDO {
  $host = (string)$cfg["DB_HOST"];
  $hostsToTry = ($host === "localhost") ? ["localhost", "127.0.0.1"] : [$host];

  $name = (string)$cfg["DB_NAME"];
  $user = (string)$cfg["DB_USER"];
  $pass = (string)($cfg["DB_PASS"] ?? "");

  $lastErr = null;

  foreach ($hostsToTry as $h) {
    try {
      $dsn = "mysql:host={$h};dbname={$name};charset=utf8mb4";
      $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 2, // fast fail -> quick fallback
      ]);

      ensure_mysql_schema($pdo);
      return $pdo;
    } catch (Throwable $e) {
      $lastErr = $e;
    }
  }

  throw new Exception($lastErr ? $lastErr->getMessage() : "MySQL connection failed");
}

/**
 * Attempt to connect to SQLite.
 *
 * SQLite DB file is stored at: app/data/pieces.sqlite
 * - app/data must exist and be writable.
 *
 * Throws Exception on failure.
 */
function try_sqlite(): PDO {
  if (!in_array("sqlite", PDO::getAvailableDrivers(), true)) {
    throw new Exception("PDO SQLite driver not available (enable pdo_sqlite).");
  }

  $dbPath = __DIR__ . "/../data/pieces.sqlite";
  $dbDir = dirname($dbPath);

  @mkdir($dbDir, 0777, true);

  if (!is_dir($dbDir) || !is_writable($dbDir)) {
    throw new Exception("app/data is not writable. Create app/data and chmod 775.");
  }

  $pdo = new PDO("sqlite:" . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  ensure_sqlite_schema($pdo);
  return $pdo;
}

/**
 * Decide whether to try MySQL first based on config.
 * Returns true if we SHOULD attempt MySQL before SQLite.
 */
function should_try_mysql_first(array $cfg): bool {
  $forced = strtolower((string)($cfg["DB_DRIVER"] ?? ""));
  $mysqlPossible = has_mysql_creds($cfg);

  if ($forced === "sqlite") return false;
  if ($forced === "mysql")  return $mysqlPossible;

  // Default behavior: if creds exist, try MySQL first; else skip.
  return $mysqlPossible;
}

/**
 * Health check that never throws:
 * - ok: true/false
 * - driver: mysql/sqlite/none
 * - note: optional (e.g. "mysql_failed_fallback_sqlite")
 * - error: only if ok=false
 *
 * This is safe to call from /api/health.
 */
function db_health(): array {
  $cfg = load_config();
  $mysqlFirst = should_try_mysql_first($cfg);
  $mysqlPossible = has_mysql_creds($cfg);
  $forced = strtolower((string)($cfg["DB_DRIVER"] ?? ""));

  if ($mysqlFirst && $mysqlPossible) {
    try {
      try_mysql($cfg);
      return ["ok" => true, "driver" => "mysql"];
    } catch (Throwable $e) {
      // fallback to sqlite
      try {
        try_sqlite();
        return ["ok" => true, "driver" => "sqlite", "note" => "mysql_failed_fallback_sqlite"];
      } catch (Throwable $e2) {
        return [
          "ok" => false,
          "driver" => "none",
          "error" => "MySQL failed: {$e->getMessage()} | SQLite failed: {$e2->getMessage()}"
        ];
      }
    }
  }

  // SQLite first (forced or no mysql creds)
  try {
    try_sqlite();
    return ["ok" => true, "driver" => "sqlite"];
  } catch (Throwable $e) {
    // If forced sqlite, do not attempt mysql
    if ($forced === "sqlite") {
      return ["ok" => false, "driver" => "none", "error" => $e->getMessage()];
    }

    // Otherwise, try mysql as fallback if creds exist
    if ($mysqlPossible) {
      try {
        try_mysql($cfg);
        return ["ok" => true, "driver" => "mysql", "note" => "sqlite_failed_fallback_mysql"];
      } catch (Throwable $e2) {
        return [
          "ok" => false,
          "driver" => "none",
          "error" => "SQLite failed: {$e->getMessage()} | MySQL failed: {$e2->getMessage()}"
        ];
      }
    }

    return ["ok" => false, "driver" => "none", "error" => $e->getMessage()];
  }
}

/**
 * Main PDO connection used by the API.
 * - Never hard-breaks due to presence of config.php
 * - Tries MySQL when appropriate; falls back to SQLite on failure
 */
function pdo_conn(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  $cfg = load_config();

  if (should_try_mysql_first($cfg)) {
    try {
      $pdo = try_mysql($cfg);
      return $pdo;
    } catch (Throwable $e) {
      // fallback
      $pdo = try_sqlite();
      return $pdo;
    }
  }

  $pdo = try_sqlite();
  return $pdo;
}

/**
 * Dev-only debug info. Safe: never returns DB_PASS value.
 * Wrapped in function_exists guard so you can never redeclare it while iterating.
 */
if (!function_exists("db_debug_info")) {
  function db_debug_info(): array {
    $cfg = load_config();
    $forced = strtolower((string)($cfg["DB_DRIVER"] ?? ""));
    $mysqlPossible = has_mysql_creds($cfg);

    $configFile = __DIR__ . "/config.php";
    $hasConfigFile = file_exists($configFile);

    $safeCfg = [
      "DB_DRIVER" => !empty($cfg["DB_DRIVER"]) ? "set" : "unset",
      "DB_HOST"   => (string)($cfg["DB_HOST"] ?? ""),
      "DB_NAME"   => !empty($cfg["DB_NAME"]) ? "set" : "unset",
      "DB_USER"   => !empty($cfg["DB_USER"]) ? "set" : "unset",
      "DB_PASS"   => !empty($cfg["DB_PASS"]) ? "set" : "unset",
    ];

    return [
      "env" => [
        "is_replit" => is_replit(),
        "php_sapi" => PHP_SAPI,
        "available_pdo_drivers" => PDO::getAvailableDrivers(),
      ],
      "config" => [
        "has_config_php" => $hasConfigFile,
        "forced_driver" => $forced !== "" ? $forced : "(none)",
        "mysql_creds_present" => $mysqlPossible,
        "sanitized" => $safeCfg
      ],
      "decision" => db_health()
    ];
  }
}
