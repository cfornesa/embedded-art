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
 *   - If hosted at /aframe/ (https://example.com/aframe/): use '/aframe'
 *   - If hosted at /apps/gallery/ (https://example.com/apps/gallery/): use '/apps/gallery'
 * 
 * IMPORTANT: 
 *   - Do NOT include a trailing slash
 *   - Do include a leading slash (except for root, which should be empty string)
 *   - This value should match BASE_PATH in server/src/config.js
 */
export const BASE_PATH = '/aframe';

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
    type: "box",
    countId: "boxCount",
    sizeId: "boxSize",
    colorId: "boxColor",
    texId: "boxTex",
    countValId: "boxCountVal",
    sizeValId: "boxSizeVal"
  },
  {
    type: "sphere",
    countId: "sphereCount",
    sizeId: "sphereSize",
    colorId: "sphereColor",
    texId: "sphereTex",
    countValId: "sphereCountVal",
    sizeValId: "sphereSizeVal"
  },
  {
    type: "cone",
    countId: "coneCount",
    sizeId: "coneSize",
    colorId: "coneColor",
    texId: "coneTex",
    countValId: "coneCountVal",
    sizeValId: "coneSizeVal"
  },
  {
    type: "torus",
    countId: "torusCount",
    sizeId: "torusSize",
    colorId: "torusColor",
    texId: "torusTex",
    countValId: "torusCountVal",
    sizeValId: "torusSizeVal"
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
