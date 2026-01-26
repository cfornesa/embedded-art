<?php
declare(strict_types=1);

require_once __DIR__ . '/constants.php';

/**
 * app/lib/piece.php
 * Validation helpers for piece payloads.
 * Supports:
 * - Legacy single-shape config
 * - Multi-shape config (shapes[])
 * - Scene background color (bg) + optional background image (bgImageUrl)
 */

function is_numeric_id(string $ref): bool {
  return (bool)preg_match('/^\d+$/', $ref);
}

function validate_visibility(string $v): string {
  $v = strtolower(trim($v));
  $allowed = ["public", "unlisted", "deleted"];
  if (!in_array($v, $allowed, true)) {
    throw new Exception("Invalid visibility");
  }
  return $v;
}

function normalize_slug(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9\-]+/', '-', $s) ?? "";
  $s = preg_replace('/\-+/', '-', $s) ?? "";
  $s = trim($s, "-");
  if (strlen($s) > SLUG_MAX_LENGTH) $s = substr($s, 0, SLUG_MAX_LENGTH);
  return $s;
}

function generate_slug(): string {
  return "piece-" . bin2hex(random_bytes(3));
}

function generate_admin_key(): string {
  return bin2hex(random_bytes(ADMIN_KEY_LENGTH));
}

function validate_email(string $email): string {
  $email = trim($email);
  if (empty($email)) {
    throw new Exception("Email is required");
  }
  if (strlen($email) > 255) {
    throw new Exception("Email is too long (max 255 characters)");
  }
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    throw new Exception("Invalid email format");
  }
  return strtolower($email);
}

/**
 * Load SMTP configuration from environment variables and optionally app/lib/config.php.
 * Same pattern as database config loading.
 */
function load_smtp_config(): array {
  $cfg = [
    "SMTP_HOST" => getenv("SMTP_HOST") ?: "",
    "SMTP_PORT" => (int)(getenv("SMTP_PORT") ?: 587),
    "SMTP_USER" => getenv("SMTP_USER") ?: "",
    "SMTP_PASS" => getenv("SMTP_PASS") ?: "",
  ];

  // Load from shared config.php in repository root: /app/lib/config.php
  $file = __DIR__ . "/../../../app/lib/config.php";
  if (file_exists($file)) {
    $fileCfg = require $file;
    if (is_array($fileCfg)) {
      // Merge SMTP settings from config.php
      if (isset($fileCfg["SMTP_HOST"])) $cfg["SMTP_HOST"] = $fileCfg["SMTP_HOST"];
      if (isset($fileCfg["SMTP_PORT"])) $cfg["SMTP_PORT"] = (int)$fileCfg["SMTP_PORT"];
      if (isset($fileCfg["SMTP_USER"])) $cfg["SMTP_USER"] = $fileCfg["SMTP_USER"];
      if (isset($fileCfg["SMTP_PASS"])) $cfg["SMTP_PASS"] = $fileCfg["SMTP_PASS"];
    }
  }

  return $cfg;
}

/**
 * Format configuration details for email body.
 * Returns a formatted string with background and shape specifications.
 */
function format_config_for_email(array $config): string {
  $output = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  $output .= "CONFIGURATION DETAILS\n";
  $output .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Background
  $output .= "BACKGROUND:\n";
  $output .= "• Color: " . ($config['bg'] ?? '#000000') . "\n";
  $output .= "• Image URL: " . ($config['bgImageUrl'] ?? '(none)') . "\n\n";

  // Shapes
  $output .= "SHAPES:\n";
  if (isset($config['shapes']) && is_array($config['shapes'])) {
    foreach ($config['shapes'] as $shape) {
      $shapeType = ucfirst($shape['type'] ?? 'unknown');
      $output .= "• {$shapeType}\n";
      $output .= "  - Number of shapes: " . ($shape['count'] ?? 0) . "\n";
      $output .= "  - Size: " . ($shape['size'] ?? 1.0) . "\n";
      $output .= "  - Base color: " . ($shape['palette']['baseColor'] ?? '#ffffff') . "\n";
      $output .= "  - Texture URL: " . ($shape['textureUrl'] ?? '(none)') . "\n";
    }
  } else {
    $output .= "(No shapes configured)\n";
  }

  $output .= "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  return $output;
}

/**
 * Send piece creation confirmation email with admin key.
 *
 * Uses SMTP if credentials are available, otherwise falls back to PHP's mail() function.
 *
 * SMTP credentials can be provided via:
 * 1. Environment variables (Replit Secrets): SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT
 * 2. app/lib/config.php (Hostinger): return array with SMTP_* keys
 *
 * On Hostinger shared hosting, mail() typically works without SMTP credentials.
 */
function send_piece_created_email(string $toEmail, int $pieceId, string $pieceSlug, string $adminKey, array $config): bool {
  $from = "contact@augmenthumankind.com";
  $fromName = "Augment Humankind";
  $subject = "Your c2.js Art Piece Details";

  // Get the current host with protocol
  $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $baseUrl = "{$protocol}://{$host}";

  // Build email body
  $body = "Hello,\n\n";
  $body .= "Thank you for creating a c2.js art piece! Here are your piece details:\n\n";
  $body .= "Piece ID: {$pieceId}\n";
  $body .= "Piece Slug: {$pieceSlug}\n";
  $body .= "Piece Admin Key: {$adminKey}\n\n";
  $body .= "IMPORTANT: Save this admin key! You will need it to edit or delete your piece.\n\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  $body .= "LINKS\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  $body .= "View:   {$baseUrl}/view.html?id={$pieceSlug}\n";
  $body .= "Edit:   {$baseUrl}/edit.html\n";
  $body .= "Delete: {$baseUrl}/delete.html\n\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  $body .= "EMBED CODES (Copy & Paste)\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  $body .= "Using Slug:\n";
  $body .= "<iframe src=\"{$baseUrl}/view.html?id={$pieceSlug}\" width=\"800\" height=\"600\" frameborder=\"0\"></iframe>\n\n";
  $body .= "Using ID:\n";
  $body .= "<iframe src=\"{$baseUrl}/view.html?id={$pieceId}\" width=\"800\" height=\"600\" frameborder=\"0\"></iframe>\n\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Add configuration details
  $body .= format_config_for_email($config);

  $body .= "Best regards,\n";
  $body .= "Augment Humankind";

  // Load SMTP config from env vars or config.php
  $smtpCfg = load_smtp_config();
  $smtpHost = (string)$smtpCfg["SMTP_HOST"];
  $smtpUser = (string)$smtpCfg["SMTP_USER"];
  $smtpPass = (string)$smtpCfg["SMTP_PASS"];
  $smtpPort = (int)$smtpCfg["SMTP_PORT"];

  // Try SMTP first if credentials are available
  if ($smtpHost && $smtpUser && $smtpPass) {
    try {
      return send_smtp_email($smtpHost, $smtpPort, $smtpUser, $smtpPass, $from, $fromName, $toEmail, $subject, $body);
    } catch (Throwable $e) {
      error_log("SMTP send failed, trying mail(): " . $e->getMessage());
      // Fall through to mail() attempt
    }
  }

  // Fallback to PHP mail() function (works on Hostinger by default)
  try {
    $headers = "From: {$fromName} <{$from}>\r\n";
    $headers .= "Reply-To: {$from}\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    $sent = mail($toEmail, $subject, $body, $headers);
    return (bool)$sent;
  } catch (Throwable $e) {
    error_log("Email send failed: " . $e->getMessage());
    return false;
  }
}

/**
 * Send update notification email after editing a piece.
 * Includes the updated configuration details.
 */
function send_piece_updated_email(string $toEmail, int $pieceId, string $pieceSlug, array $config): bool {
  $from = "contact@augmenthumankind.com";
  $fromName = "Augment Humankind";
  $subject = "Your c2.js Art Piece Has Been Updated";

  // Get the current host with protocol
  $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $baseUrl = "{$protocol}://{$host}";

  // Build email body
  $body = "Hello,\n\n";
  $body .= "This is to confirm that your c2.js art piece has been successfully updated:\n\n";
  $body .= "Piece ID: {$pieceId}\n";
  $body .= "Piece Slug: {$pieceSlug}\n\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  $body .= "LINKS\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  $body .= "View:   {$baseUrl}/view.html?id={$pieceSlug}\n";
  $body .= "Edit:   {$baseUrl}/edit.html\n";
  $body .= "Delete: {$baseUrl}/delete.html\n\n";
  $body .= "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Add UPDATED configuration details
  $body .= format_config_for_email($config);

  $body .= "Best regards,\n";
  $body .= "Augment Humankind";

  // Load SMTP config from env vars or config.php
  $smtpCfg = load_smtp_config();
  $smtpHost = (string)$smtpCfg["SMTP_HOST"];
  $smtpUser = (string)$smtpCfg["SMTP_USER"];
  $smtpPass = (string)$smtpCfg["SMTP_PASS"];
  $smtpPort = (int)$smtpCfg["SMTP_PORT"];

  // Try SMTP first if credentials are available
  if ($smtpHost && $smtpUser && $smtpPass) {
    try {
      return send_smtp_email($smtpHost, $smtpPort, $smtpUser, $smtpPass, $from, $fromName, $toEmail, $subject, $body);
    } catch (Throwable $e) {
      error_log("SMTP send failed for update email, trying mail(): " . $e->getMessage());
      // Fall through to mail() attempt
    }
  }

  // Fallback to PHP mail() function (works on Hostinger by default)
  try {
    $headers = "From: {$fromName} <{$from}>\r\n";
    $headers .= "Reply-To: {$from}\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    $sent = mail($toEmail, $subject, $body, $headers);
    return (bool)$sent;
  } catch (Throwable $e) {
    error_log("Update email send failed: " . $e->getMessage());
    return false;
  }
}

/**
 * Send deletion notification email BEFORE deleting a piece.
 * This must be called before deletion since the email address won't be accessible afterward.
 */
function send_piece_deleted_email(string $toEmail, int $pieceId, string $pieceSlug, array $config): bool {
  $from = "contact@augmenthumankind.com";
  $fromName = "Augment Humankind";
  $subject = "Your c2.js Art Piece Has Been Deleted";

  // Build email body
  $body = "Hello,\n\n";
  $body .= "This is to confirm that your c2.js art piece has been permanently deleted:\n\n";
  $body .= "Piece ID: {$pieceId}\n";
  $body .= "Piece Slug: {$pieceSlug}\n\n";
  $body .= "The piece and all associated data have been removed from our system.\n\n";
  $body .= "If this deletion was made in error, you can recreate it using the configuration details below.\n\n";

  // Add configuration details BEFORE deletion
  $body .= format_config_for_email($config);

  $body .= "Best regards,\n";
  $body .= "Augment Humankind";

  // Load SMTP config from env vars or config.php
  $smtpCfg = load_smtp_config();
  $smtpHost = (string)$smtpCfg["SMTP_HOST"];
  $smtpUser = (string)$smtpCfg["SMTP_USER"];
  $smtpPass = (string)$smtpCfg["SMTP_PASS"];
  $smtpPort = (int)$smtpCfg["SMTP_PORT"];

  // Try SMTP first if credentials are available
  if ($smtpHost && $smtpUser && $smtpPass) {
    try {
      return send_smtp_email($smtpHost, $smtpPort, $smtpUser, $smtpPass, $from, $fromName, $toEmail, $subject, $body);
    } catch (Throwable $e) {
      error_log("SMTP send failed for deletion email, trying mail(): " . $e->getMessage());
      // Fall through to mail() attempt
    }
  }

  // Fallback to PHP mail() function (works on Hostinger by default)
  try {
    $headers = "From: {$fromName} <{$from}>\r\n";
    $headers .= "Reply-To: {$from}\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    $sent = mail($toEmail, $subject, $body, $headers);
    return (bool)$sent;
  } catch (Throwable $e) {
    error_log("Deletion email send failed: " . $e->getMessage());
    return false;
  }
}

/**
 * Send email via SMTP using raw socket connection.
 * This is a simple SMTP client implementation that works without external dependencies.
 */
function send_smtp_email(string $host, int $port, string $username, string $password, string $from, string $fromName, string $to, string $subject, string $body): bool {
  // Connect to SMTP server
  $smtp = @fsockopen($host, $port, $errno, $errstr, 10);
  if (!$smtp) {
    throw new Exception("Failed to connect to SMTP server: {$errstr} ({$errno})");
  }

  // Helper function to read SMTP response
  $read = function() use ($smtp) {
    $response = '';
    while ($line = fgets($smtp, 515)) {
      $response .= $line;
      if (substr($line, 3, 1) === ' ') break;
    }
    return $response;
  };

  // Helper function to send SMTP command
  $send = function(string $cmd) use ($smtp, $read) {
    fwrite($smtp, $cmd . "\r\n");
    return $read();
  };

  try {
    // Read greeting
    $read();

    // EHLO
    $send("EHLO " . ($_SERVER['HTTP_HOST'] ?? 'localhost'));

    // STARTTLS if port 587
    if ($port == 587) {
      $send("STARTTLS");
      stream_socket_enable_crypto($smtp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
      $send("EHLO " . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    }

    // AUTH LOGIN
    $send("AUTH LOGIN");
    $send(base64_encode($username));
    $send(base64_encode($password));

    // MAIL FROM
    $send("MAIL FROM: <{$from}>");

    // RCPT TO
    $send("RCPT TO: <{$to}>");

    // DATA
    $send("DATA");

    // Email headers and body
    $message = "From: {$fromName} <{$from}>\r\n";
    $message .= "To: <{$to}>\r\n";
    $message .= "Subject: {$subject}\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "\r\n";
    $message .= $body;
    $message .= "\r\n.\r\n";

    fwrite($smtp, $message);
    $read();

    // QUIT
    $send("QUIT");

    fclose($smtp);
    return true;

  } catch (Throwable $e) {
    if (is_resource($smtp)) fclose($smtp);
    throw $e;
  }
}

function is_hex_color(string $c): bool {
  return (bool)preg_match('/^#[0-9a-fA-F]{6}$/', $c);
}

/** url must be http(s) and end in png/jpg/jpeg/webp */
function validate_image_url(string $url): void {
  if (!preg_match('/^https?:\/\//i', $url)) {
    throw new Exception("Image URL must start with http:// or https://");
  }
  $parts = parse_url($url);
  $path = strtolower((string)($parts["path"] ?? ""));

  $ok = false;
  foreach (ALLOWED_IMAGE_EXTENSIONS as $ext) {
    if (str_ends_with($path, $ext)) {
      $ok = true;
      break;
    }
  }

  if (!$ok) {
    $allowed = implode(', ', ALLOWED_IMAGE_EXTENSIONS);
    throw new Exception("Image URL must end in one of: $allowed");
  }
  if (strlen($url) > URL_MAX_LENGTH) {
    throw new Exception("Image URL too long (max " . URL_MAX_LENGTH . " chars)");
  }
}

function validate_texture_data_url(string $dataUrl): void {
  if (!str_starts_with($dataUrl, "data:image/")) {
    throw new Exception("Invalid textureDataUrl");
  }
  if (strlen($dataUrl) > TEXTURE_DATA_URL_MAX_SIZE) {
    throw new Exception("textureDataUrl too large (max " . TEXTURE_DATA_URL_MAX_SIZE . " bytes)");
  }
}

function validate_shape_block(array $s): void {
  $type = (string)($s["type"] ?? "");
  if (!in_array($type, ALLOWED_SHAPES, true)) {
    $allowed = implode(', ', ALLOWED_SHAPES);
    throw new Exception("Invalid shapes[].type (allowed: $allowed)");
  }

  $count = (int)($s["count"] ?? 0);
  if ($count < SHAPE_COUNT_MIN || $count > SHAPE_COUNT_MAX) {
    throw new Exception("Invalid shapes[].count (must be " . SHAPE_COUNT_MIN . "–" . SHAPE_COUNT_MAX . ")");
  }

  $size = (float)($s["size"] ?? 1.0);
  if (!is_finite($size) || $size < SIZE_MIN || $size > SIZE_MAX) {
    throw new Exception("Invalid shapes[].size (must be " . SIZE_MIN . "–" . SIZE_MAX . ")");
  }

  $palette = $s["palette"] ?? [];
  if (!is_array($palette)) $palette = [];
  $baseColor = (string)($palette["baseColor"] ?? "#ffffff");
  if (!is_hex_color($baseColor)) {
    throw new Exception("Invalid shapes[].palette.baseColor");
  }

  if (isset($s["textureUrl"]) && $s["textureUrl"] !== null && $s["textureUrl"] !== "") {
    if (!is_string($s["textureUrl"])) throw new Exception("shapes[].textureUrl must be a string");
    validate_image_url($s["textureUrl"]);
  }

  if (isset($s["textureDataUrl"]) && $s["textureDataUrl"] !== null && $s["textureDataUrl"] !== "") {
    if (!is_string($s["textureDataUrl"])) throw new Exception("shapes[].textureDataUrl must be a string");
    validate_texture_data_url($s["textureDataUrl"]);
  }
}

function validate_config(array $config): void {
  // Optional version marker
  if (isset($config["version"])) {
    $v = (int)$config["version"];
    if ($v < 1 || $v > 999) throw new Exception("Invalid config version");
  }

  // Validate scene background (optional)
  if (isset($config["bg"]) && $config["bg"] !== null && $config["bg"] !== "") {
    if (!is_string($config["bg"]) || !is_hex_color($config["bg"])) {
      throw new Exception("Invalid bg color");
    }
  }

  // Validate scene background image (optional)
  if (isset($config["bgImageUrl"]) && $config["bgImageUrl"] !== null && $config["bgImageUrl"] !== "") {
    if (!is_string($config["bgImageUrl"])) throw new Exception("bgImageUrl must be a string");
    validate_image_url($config["bgImageUrl"]);
  }

  // New multi-shape config: shapes[]
  if (isset($config["shapes"]) && is_array($config["shapes"])) {
    $shapes = $config["shapes"];
    if (count($shapes) < 1 || count($shapes) > 10) {
      throw new Exception("Invalid shapes[]");
    }

    $total = 0;
    foreach ($shapes as $s) {
      if (!is_array($s)) throw new Exception("Invalid shapes[] entry");
      validate_shape_block($s);
      $total += (int)($s["count"] ?? 0);
    }

    if ($total <= 0) {
      throw new Exception("At least one shape must have count > 0");
    }
    if ($total > TOTAL_INSTANCES_MAX) {
      throw new Exception("Total instances must be " . TOTAL_INSTANCES_MAX . " or less");
    }

    if (isset($config["cameraZ"])) {
      $cameraZ = (float)$config["cameraZ"];
      if (!is_finite($cameraZ) || $cameraZ < CAMERA_Z_MIN || $cameraZ > CAMERA_Z_MAX) {
        throw new Exception("Invalid cameraZ (must be " . CAMERA_Z_MIN . "–" . CAMERA_Z_MAX . ")");
      }
    }

    if (isset($config["rotationSpeed"])) {
      $rotationSpeed = (float)$config["rotationSpeed"];
      if (!is_finite($rotationSpeed) || $rotationSpeed < ROTATION_SPEED_MIN || $rotationSpeed > ROTATION_SPEED_MAX) {
        throw new Exception("Invalid rotationSpeed (must be " . ROTATION_SPEED_MIN . "–" . ROTATION_SPEED_MAX . ")");
      }
    }

    return;
  }

  // Legacy single-shape config
  $shapeType = (string)($config["shapeType"] ?? "rect");
  if (!in_array($shapeType, ALLOWED_SHAPES, true)) {
    $allowed = implode(', ', ALLOWED_SHAPES);
    throw new Exception("Invalid shapeType (allowed: $allowed)");
  }

  $uniformSize = (float)($config["uniformSize"] ?? 1.0);
  if (!is_finite($uniformSize) || $uniformSize < SIZE_MIN || $uniformSize > SIZE_MAX) {
    throw new Exception("Invalid uniformSize (must be " . SIZE_MIN . "–" . SIZE_MAX . ")");
  }

  $count = (int)($config["count"] ?? 20);
  if ($count < LEGACY_COUNT_MIN || $count > LEGACY_COUNT_MAX) {
    throw new Exception("Invalid count (must be " . LEGACY_COUNT_MIN . "–" . LEGACY_COUNT_MAX . ")");
  }

  // bg already validated above if present; default if missing
  if (!isset($config["bg"])) {
    // ok
  }

  $palette = $config["palette"] ?? [];
  if (!is_array($palette)) $palette = [];
  $baseColor = (string)($palette["baseColor"] ?? "#ffffff");
  if (!is_hex_color($baseColor)) {
    throw new Exception("Invalid palette.baseColor");
  }

  if (isset($config["textureUrl"]) && $config["textureUrl"] !== null && $config["textureUrl"] !== "") {
    if (!is_string($config["textureUrl"])) throw new Exception("textureUrl must be a string");
    validate_image_url($config["textureUrl"]);
  }

  if (isset($config["textureDataUrl"]) && $config["textureDataUrl"] !== null && $config["textureDataUrl"] !== "") {
    if (!is_string($config["textureDataUrl"])) throw new Exception("textureDataUrl must be a string");
    validate_texture_data_url($config["textureDataUrl"]);
  }
}
