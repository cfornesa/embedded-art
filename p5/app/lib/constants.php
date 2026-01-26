<?php
declare(strict_types=1);

/**
 * app/lib/constants.php
 *
 * Central configuration constants for validation, limits, and allowed values.
 * This eliminates magic numbers scattered throughout the codebase and ensures
 * consistency between client and server validation.
 */

// Validation limits
define('SLUG_MAX_LENGTH', 60);
define('URL_MAX_LENGTH', 2048);
define('SHAPE_COUNT_MAX', 10);
define('SHAPE_COUNT_MIN', 0);
define('TOTAL_INSTANCES_MAX', 40);
define('SIZE_MIN', 0.1);
define('SIZE_MAX', 10.0);
define('ADMIN_KEY_LENGTH', 32); // bytes (64 hex chars)
define('TEXTURE_DATA_URL_MAX_SIZE', 5_000_000); // 5 MB

// Camera and rotation limits
define('CAMERA_Z_MIN', 1.0);
define('CAMERA_Z_MAX', 2000.0);
define('ROTATION_SPEED_MIN', -1.0);
define('ROTATION_SPEED_MAX', 1.0);

// Legacy config limits
define('LEGACY_COUNT_MIN', 1);
define('LEGACY_COUNT_MAX', 500);

// Allowed values
define('ALLOWED_SHAPES', ['box', 'sphere', 'cone', 'torus']);
define('ALLOWED_VISIBILITY', ['public', 'unlisted', 'deleted']);
define('ALLOWED_IMAGE_EXTENSIONS', ['.png', '.jpg', '.jpeg', '.webp']);

// Database settings
define('DB_TIMEOUT_SECONDS', 2);
define('SLUG_RETRY_ATTEMPTS', 5);

// Rate limiting (requests per window)
define('RATE_LIMIT_MAX_REQUESTS', 10);
define('RATE_LIMIT_WINDOW_SECONDS', 60);
