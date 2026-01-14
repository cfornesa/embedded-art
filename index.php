<?php
require_once __DIR__ . '/app/lib/base_path.php';

header("Location: " . basePath('/builder.html'), true, 302);
exit;
?>
