import { basePath } from './constants.js';

const wrap = document.querySelector('#wrap');
const msg = document.querySelector('#msg');

function showMsg(text) {
  if (!msg) return;
  msg.style.display = 'block';
  msg.textContent = text;
}

showMsg('Loading viewer...');

const params = new URLSearchParams(location.search);
const ref = params.get('id'); // numeric id or slug
if (!ref) {
  showMsg('Missing ?id=');
  throw new Error('Missing id');
}

async function fetchPiece(refValue) {
  const url = `${basePath('/api/pieces')}/${encodeURIComponent(refValue)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Not available (${res.status}). ${txt ? txt.slice(0, 160) : ''}`.trim());
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    const snippet = (txt || '').slice(0, 200);
    throw new Error(
      `API did not return JSON from ${url}.\n` +
      `Content-Type: ${ct || '(missing)'}\n` +
      `First bytes: ${snippet || '(empty response)'}`
    );
  }

  return await res.json();
}

function ensureSpinComponent() {
  if (!window.AFRAME || AFRAME.components['spin']) return;

  // A-Frame component with tick to rotate entities (docs: registerComponent + tick).
  AFRAME.registerComponent('spin', {
    schema: {
      speed: { type: 'number', default: 0.01 }
    },
    tick: function (time, timeDelta) {
      const delta = (timeDelta || 16.67) / 16.67;
      this.el.object3D.rotation.x += this.data.speed * delta;
      this.el.object3D.rotation.y -= this.data.speed * delta;
    }
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return { r: 255, g: 255, b: 255 };
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function jitterColor(baseHex) {
  const rgb = hexToRgb(baseHex || '#ffffff');
  const jitter = () => Math.round((Math.random() - 0.5) * 50);
  const next = {
    r: clamp(rgb.r + jitter(), 20, 235),
    g: clamp(rgb.g + jitter(), 20, 235),
    b: clamp(rgb.b + jitter(), 20, 235)
  };
  return rgbToHex(next);
}

function randomPos(range = 10) {
  return (Math.random() - 0.5) * 0.4 * range;
}

function wrapWithCorsProxy(url) {
  if (!url || typeof url !== 'string') return url;

  try {
    const imageUrl = new URL(url, window.location.href);
    const isSameOrigin = imageUrl.origin === window.location.origin;
    if (isSameOrigin) {
      return url;
    }
    return `${basePath('/api/image-proxy')}?url=${encodeURIComponent(url)}`;
  } catch (e) {
    return `${basePath('/api/image-proxy')}?url=${encodeURIComponent(url)}`;
  }
}

function createScene() {
  if (!wrap) throw new Error('Missing #wrap');
  wrap.innerHTML = '';

  const scene = document.createElement('a-scene');
  scene.setAttribute('embedded', '');
  scene.setAttribute('renderer', 'antialias: true; colorManagement: true');
  scene.setAttribute('vr-mode-ui', 'enabled: false');

  const assets = document.createElement('a-assets');
  scene.appendChild(assets);

  // Camera
  const camera = document.createElement('a-entity');
  camera.setAttribute('camera', 'active: true');
  camera.setAttribute('position', '0 0 10');
  camera.setAttribute('look-controls', 'enabled: true');
  scene.appendChild(camera);

  // Lights
  const ambient = document.createElement('a-entity');
  ambient.setAttribute('light', 'type: ambient; color: #ffffff; intensity: 0.7');
  scene.appendChild(ambient);

  const directional = document.createElement('a-entity');
  directional.setAttribute('light', 'type: directional; color: #ffffff; intensity: 0.8');
  directional.setAttribute('position', '5 8 6');
  scene.appendChild(directional);

  // Background sky
  const sky = document.createElement('a-sky');
  scene.appendChild(sky);

  wrap.appendChild(scene);

  return { scene, assets, sky, camera };
}

function createPrimitive(type) {
  switch (type) {
    case 'sphere':
      return document.createElement('a-sphere');
    case 'cone':
      return document.createElement('a-cone');
    case 'torus':
      return document.createElement('a-torus');
    case 'box':
    default:
      return document.createElement('a-box');
  }
}

function applyGeometry(el, type, size) {
  const s = Number(size || 1);
  switch (type) {
    case 'sphere':
      el.setAttribute('radius', String(s * 0.5));
      break;
    case 'cone':
      el.setAttribute('radius-bottom', String(s * 0.5));
      el.setAttribute('height', String(s * 1.1));
      break;
    case 'torus':
      el.setAttribute('radius', String(s * 0.45));
      el.setAttribute('radius-tubular', String(s * 0.15));
      break;
    case 'box':
    default:
      el.setAttribute('width', String(s));
      el.setAttribute('height', String(s));
      el.setAttribute('depth', String(s));
      break;
  }
}

function buildMaterialString({ color, opacity, textureId }) {
  const parts = [
    'shader: standard',
    `color: ${color}`,
    'roughness: 0.7',
    'metalness: 0.1',
    'transparent: true',
    `opacity: ${opacity}`
  ];
  if (textureId) {
    parts.push(`src: #${textureId}`);
  }
  return parts.join('; ');
}

function registerTexture(assets, url, idPrefix, textureMap) {
  if (!url) return null;
  const safeUrl = String(url);
  if (textureMap.has(safeUrl)) return textureMap.get(safeUrl);

  const assetId = `${idPrefix}-${textureMap.size + 1}`;
  const img = document.createElement('img');
  img.setAttribute('id', assetId);
  img.setAttribute('crossorigin', 'anonymous');
  img.setAttribute('src', safeUrl);
  assets.appendChild(img);

  textureMap.set(safeUrl, assetId);
  return assetId;
}

function buildFromPieceAFrame(piece) {
  ensureSpinComponent();

  const config = piece?.config || {};
  const { scene, assets, sky, camera } = createScene();

  if (piece?.visibility === 'deleted') {
    showMsg('This piece was deleted.');
    return;
  }

  const textureMap = new Map();

  // Background color or image
  if (config.bgImageUrl) {
    const bgUrl = wrapWithCorsProxy(config.bgImageUrl);
    const bgId = registerTexture(assets, bgUrl, 'bg-image', textureMap);
    if (bgId) {
      sky.setAttribute('src', `#${bgId}`);
    }
  } else {
    sky.setAttribute('color', config.bg || '#000000');
  }

  // Camera
  const cameraZ = Number.isFinite(Number(config.cameraZ)) ? Number(config.cameraZ) : 10;
  camera.setAttribute('position', `0 0 ${cameraZ}`);

  const rotationSpeed = Number.isFinite(Number(config.rotationSpeed))
    ? Number(config.rotationSpeed)
    : 0.01;

  const shapes = Array.isArray(config.shapes) ? config.shapes : null;
  if (shapes) {
    for (const s of shapes) {
      const type = String(s.type || 'box');
      const count = Number(s.count || 0) | 0;
      if (count <= 0) continue;

      const textureUrl = s.textureUrl ? wrapWithCorsProxy(s.textureUrl) : null;
      const textureData = s.textureDataUrl || null;
      const textureId = registerTexture(
        assets,
        textureData || textureUrl,
        `${type}-tex`,
        textureMap
      );

      for (let i = 0; i < count; i += 1) {
        const entity = createPrimitive(type);
        applyGeometry(entity, type, Number(s.size || 1));

        const opacity = Math.random() * 0.65 + 0.35;
        const color = jitterColor(s?.palette?.baseColor || '#ffffff');
        entity.setAttribute(
          'material',
          buildMaterialString({ color, opacity: opacity.toFixed(3), textureId })
        );

        entity.setAttribute(
          'position',
          `${randomPos(10)} ${randomPos(10)} ${randomPos(10)}`
        );
        entity.setAttribute(
          'rotation',
          `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`
        );

        entity.setAttribute('spin', `speed: ${rotationSpeed}`);
        scene.appendChild(entity);
      }
    }
  } else {
    // Legacy single-shape support
    const type = String(config.shapeType || 'box');
    const count = Number(config.count || 20) | 0;
    const textureUrl = config.textureUrl ? wrapWithCorsProxy(config.textureUrl) : null;
    const textureData = config.textureDataUrl || null;
    const textureId = registerTexture(
      assets,
      textureData || textureUrl,
      `${type}-tex`,
      textureMap
    );

    for (let i = 0; i < count; i += 1) {
      const entity = createPrimitive(type);
      applyGeometry(entity, type, Number(config.uniformSize || 1));

      const opacity = Math.random() * 0.65 + 0.35;
      const color = jitterColor(config?.palette?.baseColor || '#ffffff');
      entity.setAttribute(
        'material',
        buildMaterialString({ color, opacity: opacity.toFixed(3), textureId })
      );
      entity.setAttribute(
        'position',
        `${randomPos(10)} ${randomPos(10)} ${randomPos(10)}`
      );
      entity.setAttribute(
        'rotation',
        `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`
      );
      entity.setAttribute('spin', `speed: ${rotationSpeed}`);
      scene.appendChild(entity);
    }
  }

  showMsg(piece.slug ? `Piece: ${piece.slug}` : `Piece #${piece.id}`);
}

fetchPiece(ref)
  .then((piece) => buildFromPieceAFrame(piece))
  .catch((err) => {
    showMsg(
      `Error loading piece.\n\n${err?.message || String(err)}\n\n` +
      'If you see HTML here, your /api route is not returning JSON. Confirm /api/pieces/{id} is reachable.'
    );
  });
