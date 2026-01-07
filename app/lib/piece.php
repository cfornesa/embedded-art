<?php
declare(strict_types=1);

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
  if (strlen($s) > 60) $s = substr($s, 0, 60);
  return $s;
}

function generate_slug(): string {
  return "piece-" . bin2hex(random_bytes(3));
}

function generate_admin_key(): string {
  return bin2hex(random_bytes(32));
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
  $ok = (
    str_ends_with($path, ".png") ||
    str_ends_with($path, ".jpg") ||
    str_ends_with($path, ".jpeg") ||
    str_ends_with($path, ".webp")
  );
  if (!$ok) {
    throw new Exception("Image URL must end in .png, .jpg, .jpeg, or .webp");
  }
  if (strlen($url) > 2048) {
    throw new Exception("Image URL too long");
  }
}

function validate_texture_data_url(string $dataUrl): void {
  if (!str_starts_with($dataUrl, "data:image/")) {
    throw new Exception("Invalid textureDataUrl");
  }
  if (strlen($dataUrl) > 5_000_000) {
    throw new Exception("textureDataUrl too large");
  }
}

function validate_shape_block(array $s): void {
  $type = (string)($s["type"] ?? "");
  $allowed = ["box", "sphere", "cone", "torus"];
  if (!in_array($type, $allowed, true)) {
    throw new Exception("Invalid shapes[].type");
  }

  $count = (int)($s["count"] ?? 0);
  if ($count < 0 || $count > 10) {
    throw new Exception("Invalid shapes[].count (must be 0–10)");
  }

  $size = (float)($s["size"] ?? 1.0);
  if (!is_finite($size) || $size <= 0 || $size > 10) {
    throw new Exception("Invalid shapes[].size (must be >0 and ≤10)");
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
    if ($total > 40) {
      throw new Exception("Total instances must be 40 or less");
    }

    if (isset($config["cameraZ"])) {
      $cameraZ = (float)$config["cameraZ"];
      if (!is_finite($cameraZ) || $cameraZ < 1 || $cameraZ > 2000) {
        throw new Exception("Invalid cameraZ");
      }
    }

    if (isset($config["rotationSpeed"])) {
      $rotationSpeed = (float)$config["rotationSpeed"];
      if (!is_finite($rotationSpeed) || $rotationSpeed < -1 || $rotationSpeed > 1) {
        throw new Exception("Invalid rotationSpeed");
      }
    }

    return;
  }

  // Legacy single-shape config
  $shapeType = (string)($config["shapeType"] ?? "box");
  $allowedShapes = ["box", "sphere", "cone", "torus"];
  if (!in_array($shapeType, $allowedShapes, true)) {
    throw new Exception("Invalid shapeType");
  }

  $uniformSize = (float)($config["uniformSize"] ?? 1.0);
  if (!is_finite($uniformSize) || $uniformSize <= 0 || $uniformSize > 10) {
    throw new Exception("Invalid uniformSize");
  }

  $count = (int)($config["count"] ?? 20);
  if ($count < 1 || $count > 500) {
    throw new Exception("Invalid count");
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
