<?php
declare(strict_types=1);

/**
 * api/image-proxy.php
 * 
 * Self-hosted image proxy to avoid exposing user URLs to third-party CORS proxies.
 * Fetches external images server-side and serves them with appropriate headers.
 * 
 * Usage: /api/image-proxy.php?url=https://example.com/image.jpg
 */

// Security: Only allow specific image extensions
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 10; // seconds
const CACHE_DURATION = 3600; // 1 hour

// CORS headers - allow all origins for images (or restrict as needed)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 86400");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

// Get and validate URL parameter
$url = $_GET['url'] ?? '';

if (empty($url)) {
    http_response_code(400);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Missing 'url' parameter"]);
    exit;
}

// Decode URL if it was encoded
$url = urldecode($url);

// Validate URL format
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Invalid URL format"]);
    exit;
}

// Only allow http/https
$scheme = parse_url($url, PHP_URL_SCHEME);
if (!in_array(strtolower($scheme), ['http', 'https'], true)) {
    http_response_code(400);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Only HTTP/HTTPS URLs allowed"]);
    exit;
}

// Validate file extension
$path = parse_url($url, PHP_URL_PATH) ?? '';
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

if (!in_array($extension, ALLOWED_EXTENSIONS, true)) {
    http_response_code(400);
    header("Content-Type: application/json");
    $allowed = implode(', ', ALLOWED_EXTENSIONS);
    echo json_encode(["error" => "Invalid image type. Allowed: {$allowed}"]);
    exit;
}

// Security: Block private/internal IPs to prevent SSRF
$host = parse_url($url, PHP_URL_HOST);
if ($host) {
    $ip = gethostbyname($host);
    if ($ip !== $host) { // Successfully resolved
        // Block private and reserved IP ranges
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            http_response_code(403);
            header("Content-Type: application/json");
            echo json_encode(["error" => "Access to internal resources not allowed"]);
            exit;
        }
    }
}

// Fetch the image using cURL
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_TIMEOUT => FETCH_TIMEOUT,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
    CURLOPT_HTTPHEADER => [
        'Accept: image/*',
    ],
    // Security: Don't expose internal errors
    CURLOPT_FAILONERROR => true,
    // Size limit (approximate, checked properly after fetch)
    CURLOPT_MAXFILESIZE => MAX_IMAGE_SIZE,
]);

$imageData = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$error = curl_error($ch);
curl_close($ch);

// Handle fetch errors
if ($imageData === false || $httpCode !== 200) {
    http_response_code(502);
    header("Content-Type: application/json");
    $msg = $error ?: "Failed to fetch image (HTTP {$httpCode})";
    echo json_encode(["error" => $msg]);
    exit;
}

// Validate size
if (strlen($imageData) > MAX_IMAGE_SIZE) {
    http_response_code(413);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Image too large (max " . (MAX_IMAGE_SIZE / 1024 / 1024) . " MB)"]);
    exit;
}

// Validate content type is actually an image
$validContentTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
];

$contentTypeLower = strtolower(explode(';', $contentType)[0] ?? '');
if (!in_array($contentTypeLower, $validContentTypes, true)) {
    // Try to detect from magic bytes as fallback
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detectedType = $finfo->buffer($imageData);
    
    if (!in_array($detectedType, $validContentTypes, true)) {
        http_response_code(400);
        header("Content-Type: application/json");
        echo json_encode(["error" => "URL does not point to a valid image"]);
        exit;
    }
    $contentTypeLower = $detectedType;
}

// Success - serve the image
header("Content-Type: {$contentTypeLower}");
header("Content-Length: " . strlen($imageData));
header("Cache-Control: public, max-age=" . CACHE_DURATION);
header("X-Content-Type-Options: nosniff");

// Generate ETag for caching
$etag = md5($imageData);
header("ETag: \"{$etag}\"");

// Check if client has cached version
$clientEtag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
if ($clientEtag === "\"{$etag}\"") {
    http_response_code(304);
    exit;
}

echo $imageData;
