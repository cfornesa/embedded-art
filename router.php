<?php
/**
 * Router for PHP built-in server (Replit)
 *
 * PHP's built-in server doesn't process .htaccess files, so we need
 * a router script to handle API routing and other rewrites.
 *
 * Usage: php -S 0.0.0.0:8000 -t . router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Security: block /app and /threejs/app from being served
if (preg_match('#^/?(threejs/)?app/#', $uri)) {
  http_response_code(403);
  echo '403 Forbidden';
  return false;
}

// API routing: /api/* -> /api/index.php
// Also handles /threejs/api/* -> /threejs/api/index.php
if (preg_match('#^(/threejs)?/api/#', $uri)) {
  $isThreejsApi = preg_match('#^/threejs#', $uri);
  $apiScript = $isThreejsApi
    ? __DIR__ . '/threejs/api/index.php'
    : __DIR__ . '/api/index.php';

  if (file_exists($apiScript)) {
    // Strip /threejs prefix from REQUEST_URI so API script sees /api/* instead of /threejs/api/*
    // This ensures the API's path parsing (which expects /api/* as first segment) works correctly
    if ($isThreejsApi) {
      $_SERVER['REQUEST_URI'] = preg_replace('#^/threejs#', '', $_SERVER['REQUEST_URI']);
    }

    require $apiScript;
    return true;
  }
}

// Serve static files directly (with path traversal protection)
$staticPath = realpath(__DIR__ . $uri);
if ($staticPath !== false
  && strpos($staticPath, __DIR__ . DIRECTORY_SEPARATOR) === 0
  && is_file($staticPath)
) {
  return false; // Let PHP's built-in server handle it
}

// Default: return false to let PHP serve the file
return false;
