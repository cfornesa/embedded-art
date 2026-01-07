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
 * Send piece creation confirmation email with admin key.
 *
 * PRODUCTION NOTE: PHP's mail() function requires a configured mail server.
 * On shared hosting (Hostinger), this typically works out of the box.
 * On Replit or other platforms, you may need to:
 * 1. Use an SMTP library (PHPMailer, SwiftMailer)
 * 2. Use a transactional email service (SendGrid, Mailgun, AWS SES)
 * 3. Configure environment variables for SMTP settings
 *
 * For now, this uses native mail() with proper headers.
 */
function send_piece_created_email(string $toEmail, int $pieceId, string $pieceSlug, string $adminKey): bool {
  $from = "contact@augmenthumankind.com";
  $subject = "Your 3D Art Piece Details";

  // Build email body
  $body = "Hello,\n\n";
  $body .= "Thank you for creating a 3D art piece! Here are your piece details:\n\n";
  $body .= "Piece ID: {$pieceId}\n";
  $body .= "Piece Slug: {$pieceSlug}\n";
  $body .= "Piece Admin Key: {$adminKey}\n\n";
  $body .= "IMPORTANT: Save this admin key! You will need it to edit or delete your piece.\n\n";
  $body .= "You can:\n";
  $body .= "- View your piece at: " . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "/view.html?id={$pieceSlug}\n";
  $body .= "- Edit your piece at: " . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "/edit.html\n";
  $body .= "- Delete your piece at: " . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "/delete.html\n\n";
  $body .= "Best regards,\n";
  $body .= "Augment Humankind";

  // Set headers
  $headers = "From: {$from}\r\n";
  $headers .= "Reply-To: {$from}\r\n";
  $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

  // Attempt to send email
  try {
    $sent = mail($toEmail, $subject, $body, $headers);
    return (bool)$sent;
  } catch (Throwable $e) {
    // Log error but don't fail the request
    error_log("Email send failed: " . $e->getMessage());
    return false;
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
  $shapeType = (string)($config["shapeType"] ?? "box");
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
