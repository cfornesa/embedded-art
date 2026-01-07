// assets/js/constants.js

/**
 * Central configuration constants for frontend validation.
 * These should match the PHP constants in app/lib/constants.php
 */

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
  PIECES: '/api/pieces',
  HEALTH: '/api/health',
  DEBUG_DB: '/api/debug/db'
};

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
