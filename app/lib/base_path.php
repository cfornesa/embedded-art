<?php
declare(strict_types=1);

/**
 * Base Path Configuration
 * 
 * This file configures the subdirectory path where the application is hosted.
 * Unlike config.php (which contains secrets), this file is tracked in git.
 */

/**
 * BASE_PATH - The subdirectory path where the application is hosted.
 * 
 * Examples:
 *   - If hosted at root (https://example.com/): use ''
 *   - If hosted at /threejs/ (https://example.com/threejs/): use '/threejs'
 *   - If hosted at /apps/gallery/ (https://example.com/apps/gallery/): use '/apps/gallery'
 * 
 * IMPORTANT: 
 *   - Do NOT include a trailing slash
 *   - Do include a leading slash (except for root, which should be empty string)
 *   - This value should match BASE_PATH in assets/js/constants.js
 */
const BASE_PATH = '';

/**
 * Get the full path with base path prefix
 * 
 * @param string $path The path to prefix (should start with /)
 * @return string The full path including base path
 */
function basePath(string $path = ''): string {
    if ($path === '' || $path === '/') {
        return BASE_PATH ?: '/';
    }
    return BASE_PATH . $path;
}
