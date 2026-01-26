// assets/js/constants.js

/**
 * Central configuration constants for frontend validation.
 * These should match the PHP constants in app/lib/constants.php
 */

/**
 * BASE_PATH - The subdirectory path where the application is hosted.
 * 
 * Examples:
 *   - If hosted at root (https://example.com/): use ''
 *   - If hosted at /c2/ (https://example.com/c2/): use '/c2'
 *   - If hosted at /apps/gallery/ (https://example.com/apps/gallery/): use '/apps/gallery'
 * 
 * IMPORTANT: 
 *   - Do NOT include a trailing slash
 *   - Do include a leading slash (except for root, which should be empty string)
 *   - This value should match BASE_PATH in app/lib/config.php
 */
export const BASE_PATH = '/c2';

/**
 * Helper function to build full paths with base path prefix
 * @param {string} path - The path to prefix (should start with /)
 * @returns {string} The full path including base path
 */
export function basePath(path = '') {
  if (path === '' || path === '/') {
    return BASE_PATH || '/';
  }
  return BASE_PATH + path;
}

export const LIMITS = {
  SLUG_MAX_LENGTH: 60,
  URL_MAX_LENGTH: 2048,
  SHAPE_COUNT_MAX: 10,
  SHAPE_COUNT_MIN: 0,
  TOTAL_INSTANCES_MAX: 40,
  SIZE_MIN: 0.1,
  SIZE_MAX: 10.0
};

export const SHAPES = [
  {
    type: "rect",
    countId: "rectCount",
    sizeId: "rectSize",
    colorId: "rectColor",
    texId: "rectTex",
    countValId: "rectCountVal",
    sizeValId: "rectSizeVal"
  },
  {
    type: "circle",
    countId: "circleCount",
    sizeId: "circleSize",
    colorId: "circleColor",
    texId: "circleTex",
    countValId: "circleCountVal",
    sizeValId: "circleSizeVal"
  },
  {
    type: "triangle",
    countId: "triangleCount",
    sizeId: "triangleSize",
    colorId: "triangleColor",
    texId: "triangleTex",
    countValId: "triangleCountVal",
    sizeValId: "triangleSizeVal"
  },
  {
    type: "line",
    countId: "lineCount",
    sizeId: "lineSize",
    colorId: "lineColor",
    texId: "lineTex",
    countValId: "lineCountVal",
    sizeValId: "lineSizeVal"
  }
];

export const API_ENDPOINTS = {
  PIECES: basePath('/api/pieces'),
  HEALTH: basePath('/api/health'),
  DEBUG_DB: basePath('/api/debug/db')
};

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
