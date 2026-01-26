// assets/js/constants.js

/**
 * Central configuration constants for frontend validation.
 * These should match the Node constants in server/src/constants.js
 */

/**
 * BASE_PATH - The subdirectory path where the application is hosted.
 * 
 * Examples:
 *   - If hosted at root (https://example.com/): use ''
 *   - If hosted at /p5/ (https://example.com/p5/): use '/p5'
 *   - If hosted at /apps/gallery/ (https://example.com/apps/gallery/): use '/apps/gallery'
 * 
 * IMPORTANT: 
 *   - Do NOT include a trailing slash
 *   - Do include a leading slash (except for root, which should be empty string)
 *   - This value should match BASE_PATH in server/src/config.js
 */
export const BASE_PATH = '/p5';

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
  SIZE_MIN: 4,
  SIZE_MAX: 200,
  STROKE_WEIGHT_MIN: 0,
  STROKE_WEIGHT_MAX: 20
};

export const SHAPES = [
  {
    type: "circle",
    label: "Circle",
    countId: "circleCount",
    sizeId: "circleSize",
    sizeMin: 4,
    sizeMax: 200,
    fillToggleId: "circleFillEnabled",
    fillId: "circleFill",
    strokeToggleId: "circleStrokeEnabled",
    strokeId: "circleStroke",
    strokeWeightId: "circleStrokeWeight",
    countValId: "circleCountVal",
    sizeValId: "circleSizeVal",
    strokeWeightValId: "circleStrokeWeightVal",
    supportsFill: true,
    supportsStroke: true
  },
  {
    type: "rect",
    label: "Rectangle",
    countId: "rectCount",
    sizeId: "rectSize",
    sizeMin: 6,
    sizeMax: 240,
    fillToggleId: "rectFillEnabled",
    fillId: "rectFill",
    strokeToggleId: "rectStrokeEnabled",
    strokeId: "rectStroke",
    strokeWeightId: "rectStrokeWeight",
    countValId: "rectCountVal",
    sizeValId: "rectSizeVal",
    strokeWeightValId: "rectStrokeWeightVal",
    supportsFill: true,
    supportsStroke: true
  },
  {
    type: "triangle",
    label: "Triangle",
    countId: "triangleCount",
    sizeId: "triangleSize",
    sizeMin: 6,
    sizeMax: 220,
    fillToggleId: "triangleFillEnabled",
    fillId: "triangleFill",
    strokeToggleId: "triangleStrokeEnabled",
    strokeId: "triangleStroke",
    strokeWeightId: "triangleStrokeWeight",
    countValId: "triangleCountVal",
    sizeValId: "triangleSizeVal",
    strokeWeightValId: "triangleStrokeWeightVal",
    supportsFill: true,
    supportsStroke: true
  },
  {
    type: "line",
    label: "Line",
    countId: "lineCount",
    sizeId: "lineLength",
    sizeMin: 12,
    sizeMax: 300,
    strokeToggleId: "lineStrokeEnabled",
    strokeId: "lineStroke",
    strokeWeightId: "lineStrokeWeight",
    countValId: "lineCountVal",
    sizeValId: "lineLengthVal",
    strokeWeightValId: "lineStrokeWeightVal",
    supportsFill: false,
    supportsStroke: true
  },
  {
    type: "point",
    label: "Point",
    countId: "pointCount",
    sizeId: "pointSize",
    sizeMin: 1,
    sizeMax: 20,
    strokeToggleId: "pointStrokeEnabled",
    strokeId: "pointStroke",
    countValId: "pointCountVal",
    sizeValId: "pointSizeVal",
    supportsFill: false,
    supportsStroke: true
  }
];

export const API_ENDPOINTS = {
  PIECES: basePath('/api/pieces'),
  HEALTH: basePath('/api/health'),
  DEBUG_DB: basePath('/api/debug/db'),
  RECAPTCHA_SITE_KEY: basePath('/api/recaptcha/site-key')
};

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export const RECAPTCHA = {
  ACTION_CREATE: 'create_piece',
  ACTION_DELETE: 'delete_piece'
};
