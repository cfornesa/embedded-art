<?php
declare(strict_types=1);

/**
 * app/lib/logger.php
 *
 * Simple structured logger that outputs JSON to error_log.
 * Enables easy parsing, searching, and monitoring.
 */

class Logger {
  /**
   * Core logging function.
   * Outputs structured JSON to PHP error_log.
   */
  private static function log(string $level, string $message, array $context = []): void {
    $entry = [
      'timestamp' => gmdate('c'),
      'level' => $level,
      'message' => $message,
      'context' => $context,
      'request' => [
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
        'uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
      ]
    ];

    error_log(json_encode($entry));
  }

  /**
   * Log informational message (normal operation).
   */
  public static function info(string $message, array $context = []): void {
    self::log('INFO', $message, $context);
  }

  /**
   * Log warning (unexpected but handled situation).
   */
  public static function warning(string $message, array $context = []): void {
    self::log('WARNING', $message, $context);
  }

  /**
   * Log error (failure that needs attention).
   */
  public static function error(string $message, array $context = []): void {
    self::log('ERROR', $message, $context);
  }

  /**
   * Log audit event (security-relevant actions).
   * Used for piece creation, deletion, visibility changes.
   */
  public static function audit(string $action, array $context = []): void {
    self::log('AUDIT', $action, $context);
  }

  /**
   * Log debug information (development only).
   * Only logs if running on Replit or ENABLE_DEBUG_LOGGING=1.
   */
  public static function debug(string $message, array $context = []): void {
    $debugEnabled = (bool)getenv("REPL_ID") || (getenv("ENABLE_DEBUG_LOGGING") === "1");
    if ($debugEnabled) {
      self::log('DEBUG', $message, $context);
    }
  }
}
