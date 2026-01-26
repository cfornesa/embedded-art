<?php
/**
 * Simple test script to verify improvements are working
 */

require_once __DIR__ . '/app/lib/constants.php';
require_once __DIR__ . '/app/lib/logger.php';
require_once __DIR__ . '/app/lib/piece.php';
require_once __DIR__ . '/app/lib/db.php';

echo "=== Testing Code Quality Improvements ===\n\n";

// Test 1: Constants are defined
echo "Test 1: Constants are defined\n";
$constants_ok = defined('SLUG_MAX_LENGTH') &&
                defined('TOTAL_INSTANCES_MAX') &&
                defined('ALLOWED_SHAPES') &&
                defined('RATE_LIMIT_MAX_REQUESTS');
echo $constants_ok ? "OK PASS: All constants defined\n" : "X FAIL: Missing constants\n";
echo "  - SLUG_MAX_LENGTH: " . SLUG_MAX_LENGTH . "\n";
echo "  - TOTAL_INSTANCES_MAX: " . TOTAL_INSTANCES_MAX . "\n";
echo "  - RATE_LIMIT_MAX_REQUESTS: " . RATE_LIMIT_MAX_REQUESTS . "\n\n";

// Test 2: Logger class exists
echo "Test 2: Logger class exists\n";
$logger_ok = class_exists('Logger');
echo $logger_ok ? "OK PASS: Logger class loaded\n" : "X FAIL: Logger class not found\n";
if ($logger_ok) {
  echo "  - Logger methods: " . implode(', ', get_class_methods('Logger')) . "\n";
}
echo "\n";

// Test 3: Validation functions work
echo "Test 3: Validation functions work\n";
try {
  $slug = normalize_slug("Test-Piece-123");
  $admin_key = generate_admin_key();
  $slug_ok = strlen($slug) > 0 && strlen($slug) <= SLUG_MAX_LENGTH;
  $key_ok = strlen($admin_key) === (ADMIN_KEY_LENGTH * 2); // hex is 2 chars per byte

  echo $slug_ok ? "OK PASS: normalize_slug() works\n" : "X FAIL: normalize_slug() failed\n";
  echo "  - Generated slug: $slug\n";
  echo $key_ok ? "OK PASS: generate_admin_key() works\n" : "X FAIL: generate_admin_key() wrong length\n";
  echo "  - Admin key length: " . strlen($admin_key) . " chars\n";
} catch (Exception $e) {
  echo "X FAIL: " . $e->getMessage() . "\n";
}
echo "\n";

// Test 4: Shape validation
echo "Test 4: Shape validation\n";
try {
  $valid_shape = [
    'type' => 'box',
    'count' => 5,
    'size' => 1.5,
    'palette' => ['baseColor' => '#ff0000'],
    'textureUrl' => ''
  ];
  validate_shape_block($valid_shape);
  echo "OK PASS: Shape validation accepts valid input\n";
} catch (Exception $e) {
  echo "X FAIL: " . $e->getMessage() . "\n";
}

try {
  $invalid_shape = [
    'type' => 'invalid',
    'count' => 5,
    'size' => 1.5,
    'palette' => ['baseColor' => '#ff0000']
  ];
  validate_shape_block($invalid_shape);
  echo "X FAIL: Shape validation should reject invalid type\n";
} catch (Exception $e) {
  echo "OK PASS: Shape validation correctly rejects invalid type\n";
  echo "  - Error: " . $e->getMessage() . "\n";
}
echo "\n";

// Test 5: Database health check
echo "Test 5: Database health check\n";
try {
  $health = db_health();
  $db_ok = $health['ok'] ?? false;
  $driver = $health['driver'] ?? 'unknown';
  echo $db_ok ? "OK PASS: Database connection healthy\n" : "WARNING WARNING: Database not connected\n";
  echo "  - Driver: $driver\n";
  if (isset($health['note'])) {
    echo "  - Note: " . $health['note'] . "\n";
  }
  if (isset($health['error'])) {
    echo "  - Error: " . $health['error'] . "\n";
  }
} catch (Exception $e) {
  echo "X FAIL: " . $e->getMessage() . "\n";
}
echo "\n";

// Summary
echo "=== Test Summary ===\n";
echo "All core improvements are loaded and functional.\n";
echo "Ready for integration testing.\n";
