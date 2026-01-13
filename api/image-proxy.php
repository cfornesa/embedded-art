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

/**
 * Validate that a URL's resolved IP is not private/internal (SSRF protection)
 * 
 * @param string $url The URL to validate
 * @return array ['valid' => bool, 'error' => string|null]
 */
function validateUrlIpAddress(string $url): array {
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host) {
        return ['valid' => false, 'error' => 'Invalid URL - no host'];
    }
    
    $ip = gethostbyname($host);
    if ($ip === $host) {
        // Failed to resolve - could be IPv6 or invalid hostname
        // Try getaddrinfo for IPv6 support
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (empty($records)) {
            return ['valid' => false, 'error' => 'Could not resolve hostname'];
        }
        $ip = $records[0]['ip'] ?? $records[0]['ipv6'] ?? null;
        if (!$ip) {
            return ['valid' => false, 'error' => 'Could not resolve hostname'];
        }
    }
    
    // Block private and reserved IP ranges
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return ['valid' => false, 'error' => 'Access to internal resources not allowed'];
    }
    
    // Also block link-local addresses explicitly (169.254.x.x for IPv4, fe80:: for IPv6)
    // These are used by cloud metadata services
    if (preg_match('/^169\.254\./', $ip) || stripos($ip, 'fe80:') === 0) {
        return ['valid' => false, 'error' => 'Access to internal resources not allowed'];
    }
    
    return ['valid' => true, 'error' => null];
}

// Validate initial URL's IP address
$validation = validateUrlIpAddress($url);
if (!$validation['valid']) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => $validation['error']]);
    exit;
}

/**
 * Fetch image with SSRF-safe redirect handling
 * Validates each redirect destination before following it
 * 
 * @param string $url Initial URL to fetch
 * @param int $maxRedirects Maximum number of redirects to follow
 * @return array ['success' => bool, 'data' => string|null, 'contentType' => string|null, 'error' => string|null, 'httpCode' => int]
 */
function fetchImageWithSafeRedirects(string $url, int $maxRedirects = 3): array {
    $currentUrl = $url;
    $redirectCount = 0;
    
    while ($redirectCount <= $maxRedirects) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $currentUrl,
            CURLOPT_RETURNTRANSFER => true,
            // SECURITY: Disable automatic redirect following to validate each redirect
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => FETCH_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
            CURLOPT_HTTPHEADER => [
                'Accept: image/*',
            ],
            // Return headers to extract Location for redirects
            CURLOPT_HEADER => true,
            // Size limit (approximate, checked properly after fetch)
            CURLOPT_MAXFILESIZE => MAX_IMAGE_SIZE,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($response === false) {
            return ['success' => false, 'data' => null, 'contentType' => null, 'error' => $error ?: 'Failed to fetch URL', 'httpCode' => $httpCode];
        }
        
        // Check for redirect status codes
        if (in_array($httpCode, [301, 302, 303, 307, 308], true)) {
            $redirectCount++;
            
            if ($redirectCount > $maxRedirects) {
                return ['success' => false, 'data' => null, 'contentType' => null, 'error' => 'Too many redirects', 'httpCode' => $httpCode];
            }
            
            // Extract Location header
            $headers = substr($response, 0, $headerSize);
            if (preg_match('/^Location:\s*(.+)$/mi', $headers, $matches)) {
                $newUrl = trim($matches[1]);
                
                // Handle relative URLs
                if (!parse_url($newUrl, PHP_URL_HOST)) {
                    $parsedCurrent = parse_url($currentUrl);
                    $baseUrl = $parsedCurrent['scheme'] . '://' . $parsedCurrent['host'];
                    if (isset($parsedCurrent['port'])) {
                        $baseUrl .= ':' . $parsedCurrent['port'];
                    }
                    if (strpos($newUrl, '/') === 0) {
                        $newUrl = $baseUrl . $newUrl;
                    } else {
                        $newUrl = $baseUrl . '/' . $newUrl;
                    }
                }
                
                // SECURITY: Validate redirect URL scheme
                $newScheme = parse_url($newUrl, PHP_URL_SCHEME);
                if (!in_array(strtolower($newScheme ?? ''), ['http', 'https'], true)) {
                    return ['success' => false, 'data' => null, 'contentType' => null, 'error' => 'Invalid redirect protocol', 'httpCode' => $httpCode];
                }
                
                // SECURITY: Validate redirect destination IP address (prevents SSRF via redirect)
                $validation = validateUrlIpAddress($newUrl);
                if (!$validation['valid']) {
                    return ['success' => false, 'data' => null, 'contentType' => null, 'error' => 'Redirect blocked: ' . $validation['error'], 'httpCode' => $httpCode];
                }
                
                $currentUrl = $newUrl;
                continue;
            } else {
                return ['success' => false, 'data' => null, 'contentType' => null, 'error' => 'Redirect without Location header', 'httpCode' => $httpCode];
            }
        }
        
        // Not a redirect - extract body and return
        $body = substr($response, $headerSize);
        
        if ($httpCode !== 200) {
            return ['success' => false, 'data' => null, 'contentType' => null, 'error' => "Failed to fetch image (HTTP {$httpCode})", 'httpCode' => $httpCode];
        }
        
        return ['success' => true, 'data' => $body, 'contentType' => $contentType, 'error' => null, 'httpCode' => $httpCode];
    }
    
    return ['success' => false, 'data' => null, 'contentType' => null, 'error' => 'Too many redirects', 'httpCode' => 0];
}

// Fetch the image with SSRF-safe redirect handling
$result = fetchImageWithSafeRedirects($url, 3);
$imageData = $result['data'];
$httpCode = $result['httpCode'];
$contentType = $result['contentType'];
$error = $result['error'];

// Handle fetch errors
if (!$result['success'] || $imageData === null) {
    http_response_code(502);
    header("Content-Type: application/json");
    echo json_encode(["error" => $error ?: "Failed to fetch image"]);
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
