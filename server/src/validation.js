const crypto = require('crypto');
const {
  LIMITS,
  ALLOWED_SHAPES,
  ALLOWED_VISIBILITY,
  ALLOWED_IMAGE_EXTENSIONS,
} = require('./constants');

function isNumericId(ref) {
  return /^\d+$/.test(ref);
}

function validateVisibility(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (!ALLOWED_VISIBILITY.includes(normalized)) {
    throw new Error('Invalid visibility');
  }
  return normalized;
}

function normalizeSlug(value) {
  let slug = String(value || '').toLowerCase().trim();
  slug = slug.replace(/[^a-z0-9\-]+/g, '-');
  slug = slug.replace(/\-+/g, '-');
  slug = slug.replace(/^\-+|\-+$/g, '');
  if (slug.length > LIMITS.SLUG_MAX_LENGTH) {
    slug = slug.slice(0, LIMITS.SLUG_MAX_LENGTH);
  }
  return slug;
}

function generateSlug() {
  return `piece-${crypto.randomBytes(3).toString('hex')}`;
}

function generateAdminKey() {
  return crypto.randomBytes(LIMITS.ADMIN_KEY_LENGTH).toString('hex');
}

function validateEmail(email) {
  const value = String(email || '').trim();
  if (!value) {
    throw new Error('Email is required');
  }
  if (value.length > 255) {
    throw new Error('Email is too long (max 255 characters)');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error('Invalid email format');
  }
  return value.toLowerCase();
}

function isHexColor(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

function validateImageUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Image URL must start with http:// or https://');
  }

  const parsed = new URL(url);
  const path = (parsed.pathname || '').toLowerCase();

  const ok = ALLOWED_IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
  if (!ok) {
    throw new Error(`Image URL must end in one of: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`);
  }

  if (url.length > LIMITS.URL_MAX_LENGTH) {
    throw new Error(`Image URL too long (max ${LIMITS.URL_MAX_LENGTH} chars)`);
  }
}

function validateTextureDataUrl(dataUrl) {
  if (!String(dataUrl).startsWith('data:image/')) {
    throw new Error('Invalid textureDataUrl');
  }
  if (String(dataUrl).length > LIMITS.TEXTURE_DATA_URL_MAX_SIZE) {
    throw new Error(`textureDataUrl too large (max ${LIMITS.TEXTURE_DATA_URL_MAX_SIZE} bytes)`);
  }
}

function validateShapeBlock(shape) {
  const type = String(shape?.type || '');
  if (!ALLOWED_SHAPES.includes(type)) {
    throw new Error(`Invalid shapes[].type (allowed: ${ALLOWED_SHAPES.join(', ')})`);
  }

  const count = Number.parseInt(shape?.count ?? 0, 10);
  if (Number.isNaN(count) || count < LIMITS.SHAPE_COUNT_MIN || count > LIMITS.SHAPE_COUNT_MAX) {
    throw new Error(`Invalid shapes[].count (must be ${LIMITS.SHAPE_COUNT_MIN}-${LIMITS.SHAPE_COUNT_MAX})`);
  }

  const size = Number(shape?.size ?? 1.0);
  if (!Number.isFinite(size) || size < LIMITS.SIZE_MIN || size > LIMITS.SIZE_MAX) {
    throw new Error(`Invalid shapes[].size (must be ${LIMITS.SIZE_MIN}-${LIMITS.SIZE_MAX})`);
  }

  const palette = shape?.palette && typeof shape.palette === 'object' ? shape.palette : {};
  const baseColor = String(palette.baseColor || '#ffffff');
  if (!isHexColor(baseColor)) {
    throw new Error('Invalid shapes[].palette.baseColor');
  }

  if (shape?.textureUrl) {
    if (typeof shape.textureUrl !== 'string') {
      throw new Error('shapes[].textureUrl must be a string');
    }
    validateImageUrl(shape.textureUrl);
  }

  if (shape?.textureDataUrl) {
    if (typeof shape.textureDataUrl !== 'string') {
      throw new Error('shapes[].textureDataUrl must be a string');
    }
    validateTextureDataUrl(shape.textureDataUrl);
  }
}

function validateConfig(config) {
  if (config?.version !== undefined) {
    const version = Number.parseInt(config.version, 10);
    if (Number.isNaN(version) || version < 1 || version > 999) {
      throw new Error('Invalid config version');
    }
  }

  if (config?.bg !== undefined && config.bg !== null && config.bg !== '') {
    if (typeof config.bg !== 'string' || !isHexColor(config.bg)) {
      throw new Error('Invalid bg color');
    }
  }

  if (config?.bgImageUrl !== undefined && config.bgImageUrl !== null && config.bgImageUrl !== '') {
    if (typeof config.bgImageUrl !== 'string') {
      throw new Error('bgImageUrl must be a string');
    }
    validateImageUrl(config.bgImageUrl);
  }

  if (Array.isArray(config?.shapes)) {
    const shapes = config.shapes;
    if (shapes.length < 1 || shapes.length > 10) {
      throw new Error('Invalid shapes[]');
    }

    let total = 0;
    for (const shape of shapes) {
      if (!shape || typeof shape !== 'object') {
        throw new Error('Invalid shapes[] entry');
      }
      validateShapeBlock(shape);
      total += Number.parseInt(shape.count ?? 0, 10);
    }

    if (total <= 0) {
      throw new Error('At least one shape must have count > 0');
    }
    if (total > LIMITS.TOTAL_INSTANCES_MAX) {
      throw new Error(`Total instances must be ${LIMITS.TOTAL_INSTANCES_MAX} or less`);
    }

    if (config.cameraZ !== undefined) {
      const cameraZ = Number(config.cameraZ);
      if (!Number.isFinite(cameraZ) || cameraZ < LIMITS.CAMERA_Z_MIN || cameraZ > LIMITS.CAMERA_Z_MAX) {
        throw new Error(`Invalid cameraZ (must be ${LIMITS.CAMERA_Z_MIN}-${LIMITS.CAMERA_Z_MAX})`);
      }
    }

    if (config.rotationSpeed !== undefined) {
      const rotationSpeed = Number(config.rotationSpeed);
      if (!Number.isFinite(rotationSpeed) || rotationSpeed < LIMITS.ROTATION_SPEED_MIN || rotationSpeed > LIMITS.ROTATION_SPEED_MAX) {
        throw new Error(`Invalid rotationSpeed (must be ${LIMITS.ROTATION_SPEED_MIN}-${LIMITS.ROTATION_SPEED_MAX})`);
      }
    }

    return;
  }

  const shapeType = String(config?.shapeType || 'box');
  if (!ALLOWED_SHAPES.includes(shapeType)) {
    throw new Error(`Invalid shapeType (allowed: ${ALLOWED_SHAPES.join(', ')})`);
  }

  const uniformSize = Number(config?.uniformSize ?? 1.0);
  if (!Number.isFinite(uniformSize) || uniformSize < LIMITS.SIZE_MIN || uniformSize > LIMITS.SIZE_MAX) {
    throw new Error(`Invalid uniformSize (must be ${LIMITS.SIZE_MIN}-${LIMITS.SIZE_MAX})`);
  }

  const count = Number.parseInt(config?.count ?? 20, 10);
  if (Number.isNaN(count) || count < LIMITS.LEGACY_COUNT_MIN || count > LIMITS.LEGACY_COUNT_MAX) {
    throw new Error(`Invalid count (must be ${LIMITS.LEGACY_COUNT_MIN}-${LIMITS.LEGACY_COUNT_MAX})`);
  }

  const palette = config?.palette && typeof config.palette === 'object' ? config.palette : {};
  const baseColor = String(palette.baseColor || '#ffffff');
  if (!isHexColor(baseColor)) {
    throw new Error('Invalid palette.baseColor');
  }

  if (config?.textureUrl) {
    if (typeof config.textureUrl !== 'string') {
      throw new Error('textureUrl must be a string');
    }
    validateImageUrl(config.textureUrl);
  }

  if (config?.textureDataUrl) {
    if (typeof config.textureDataUrl !== 'string') {
      throw new Error('textureDataUrl must be a string');
    }
    validateTextureDataUrl(config.textureDataUrl);
  }
}

module.exports = {
  isNumericId,
  validateVisibility,
  normalizeSlug,
  generateSlug,
  generateAdminKey,
  validateEmail,
  validateConfig,
};
