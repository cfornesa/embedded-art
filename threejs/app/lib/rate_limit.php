<?php
declare(strict_types=1);

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/logger.php';

/**
 * app/lib/rate_limit.php
 *
 * Simple IP-based rate limiter using file-based storage.
 * For production at scale, consider Redis or Memcached.
 *
 * Storage: app/data/rate_limits/{md5(ip)}.json
 */

/**
 * Check if the current IP has exceeded rate limits.
 * Responds with 429 Too Many Requests and exits if limit exceeded.
 *
 * @param string $ip Client IP address
 * @param int $max_requests Maximum requests allowed in window
 * @param int $window_seconds Time window in seconds
 * @return void Exits with 429 if limit exceeded
 */
function check_rate_limit(
  string $ip,
  int $max_requests = RATE_LIMIT_MAX_REQUESTS,
  int $window_seconds = RATE_LIMIT_WINDOW_SECONDS
): void {
  // Skip rate limiting on Replit for development
  if (getenv("REPL_ID")) {
    return;
  }

  $cache_dir = __DIR__ . '/../data/rate_limits';
  @mkdir($cache_dir, 0777, true);

  if (!is_writable($cache_dir)) {
    Logger::warning('rate_limit_cache_not_writable', ['dir' => $cache_dir]);
    return; // Fail open (don't block legitimate users if cache fails)
  }

  $cache_file = $cache_dir . '/' . md5($ip) . '.json';
  $now = time();

  // Load existing rate limit data
  $data = file_exists($cache_file)
    ? json_decode(file_get_contents($cache_file), true)
    : ['count' => 0, 'window_start' => $now];

  // Reset window if expired
  if ($now - $data['window_start'] >= $window_seconds) {
    $data = ['count' => 0, 'window_start' => $now];
  }

  $data['count']++;

  // Check if limit exceeded
  if ($data['count'] > $max_requests) {
    $retry_after = $window_seconds - ($now - $data['window_start']);

    Logger::warning('rate_limit_exceeded', [
      'ip' => $ip,
      'count' => $data['count'],
      'limit' => $max_requests,
      'retry_after' => $retry_after
    ]);

    header('Retry-After: ' . $retry_after);
    header('X-RateLimit-Limit: ' . $max_requests);
    header('X-RateLimit-Remaining: 0');
    header('X-RateLimit-Reset: ' . ($data['window_start'] + $window_seconds));
    http_response_code(429);
    echo json_encode([
      'error' => 'Rate limit exceeded. Try again later.',
      'retry_after' => $retry_after
    ]);
    exit;
  }

  // Save updated count
  file_put_contents($cache_file, json_encode($data));

  // Send rate limit headers
  header('X-RateLimit-Limit: ' . $max_requests);
  header('X-RateLimit-Remaining: ' . ($max_requests - $data['count']));
  header('X-RateLimit-Reset: ' . ($data['window_start'] + $window_seconds));
}

/**
 * Cleanup old rate limit cache files (run periodically).
 * Removes files older than 24 hours.
 */
function cleanup_rate_limit_cache(): void {
  $cache_dir = __DIR__ . '/../data/rate_limits';
  if (!is_dir($cache_dir)) return;

  $cutoff = time() - 86400; // 24 hours ago
  $files = glob($cache_dir . '/*.json');

  foreach ($files as $file) {
    if (filemtime($file) < $cutoff) {
      @unlink($file);
    }
  }
}
