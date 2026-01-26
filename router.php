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

// Security: Check for null bytes in URI (prevents null byte injection attacks)
if ($uri === false || strpos($uri, "\0") !== false) {
  http_response_code(400);
  echo '400 Bad Request';
  return false;
}

// Security: block /app, /threejs/app, and /aframe/app from being served
if (preg_match('#^/?(threejs/|aframe/)?app/#', $uri)) {
  http_response_code(403);
  echo '403 Forbidden';
  return false;
}

// API routing: /api/* -> /api/index.php
// Also handles /threejs/api/* -> /threejs/api/index.php and /aframe/api/* -> /aframe/api/index.php
if (preg_match('#^/(threejs|aframe)?/api/#', $uri)) {
  $isThreejsApi = preg_match('#^/threejs#', $uri);
  $isAframeApi = preg_match('#^/aframe#', $uri);
  $apiScript = $isAframeApi
    ? __DIR__ . '/aframe/api/index.php'
    : ($isThreejsApi ? __DIR__ . '/threejs/api/index.php' : __DIR__ . '/api/index.php');

  if (file_exists($apiScript)) {
    // Strip /threejs prefix from REQUEST_URI so API script sees /api/* instead of /threejs/api/*
    // Save original URI first in case API script or logging needs it
    $originalRequestUri = $_SERVER['REQUEST_URI'];
    $_SERVER['ORIGINAL_REQUEST_URI'] = $originalRequestUri;

    if ($isThreejsApi) {
      $_SERVER['REQUEST_URI'] = preg_replace('#^/threejs#', '', $_SERVER['REQUEST_URI']);
    } elseif ($isAframeApi) {
      $_SERVER['REQUEST_URI'] = preg_replace('#^/aframe#', '', $_SERVER['REQUEST_URI']);
    }

    require $apiScript;

    // Restore original REQUEST_URI after API script completes (in case of any subsequent processing)
    $_SERVER['REQUEST_URI'] = $originalRequestUri;
    return true;
  }
}

// Serve static files directly (with path traversal protection)
// Normalize base directory to ensure consistent path comparison
$baseDir = realpath(__DIR__);
$staticPath = $baseDir !== false ? realpath($baseDir . $uri) : false;

if ($staticPath !== false
  && $baseDir !== false
  && strpos($staticPath, $baseDir . DIRECTORY_SEPARATOR) === 0
  && is_file($staticPath)
) {
  return false; // Let PHP's built-in server handle it
}

// Default: return false to let PHP serve the file
return false;
