import c2Module from 'https://cdn.skypack.dev/c2.js';
import { basePath } from './constants.js';

const c2 = c2Module?.default || c2Module;

const wrap = document.querySelector('#wrap');
const msg = document.querySelector('#msg');

function showMsg(text) {
  if (!msg) return;
  msg.style.display = 'block';
  msg.textContent = text;
}

function hideMsg() {
  if (!msg) return;
  msg.style.display = 'none';
}

showMsg('Loading viewer...');

const params = new URLSearchParams(location.search);
const ref = params.get('id'); // numeric id OR slug
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = (hex || '#ffffff').replace('#', '').trim();
  if (!/^([0-9a-fA-F]{6})$/.test(normalized)) {
    return { r: 255, g: 255, b: 255 };
  }
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function jitterColor(hex) {
  const { r, g, b } = hexToRgb(hex || '#ffffff');
  const jitter = () => (Math.random() - 0.5) * 40;
  return rgbToHex({
    r: r + jitter(),
    g: g + jitter(),
    b: b + jitter()
  });
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

function normalizeConfig(rawConfig) {
  const cfg = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const shapes = Array.isArray(cfg.shapes) ? cfg.shapes : [];
  return {
    version: cfg.version || 2,
    bg: typeof cfg.bg === 'string' ? cfg.bg : '#000000',
    bgImageUrl: typeof cfg.bgImageUrl === 'string' ? cfg.bgImageUrl : '',
    rotationSpeed: typeof cfg.rotationSpeed === 'number' ? cfg.rotationSpeed : 0.01,
    shapes
  };
}

function getRenderSize() {
  const rect = wrap.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  };
}

function getRendererContext(renderer) {
  if (!renderer) return null;
  if (renderer.ctx) return renderer.ctx;
  if (renderer.context) return renderer.context;
  if (renderer._context) return renderer._context;
  if (renderer.canvas && renderer.canvas.getContext) return renderer.canvas.getContext('2d');
  if (renderer.el && renderer.el.getContext) return renderer.el.getContext('2d');
  return null;
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function buildShapeInstances(width, height, cfg) {
  const instances = [];
  const minDim = Math.min(width, height);
  const padding = Math.max(12, minDim * 0.08);
  const spreadX = Math.max(1, width - padding * 2);
  const spreadY = Math.max(1, height - padding * 2);
  const baseScale = minDim * 0.08;
  const speedScale = Math.max(0.25, Math.min(2.5, Math.abs(cfg.rotationSpeed) * 120));

  cfg.shapes.forEach((shape) => {
    const count = Math.max(0, Number.parseInt(shape?.count ?? 0, 10) || 0);
    const size = clamp(Number(shape?.size ?? 1), 0.1, 10) * baseScale;
    const baseColor = shape?.palette?.baseColor || '#ffffff';
    const textureUrl = (shape?.textureUrl || '').trim();

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedScale * (0.6 + Math.random());
      instances.push({
        type: (shape?.type || 'rect').toLowerCase(),
        size,
        color: jitterColor(baseColor),
        textureUrl,
        x: padding + Math.random() * spreadX,
        y: padding + Math.random() * spreadY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * cfg.rotationSpeed * 8
      });
    }
  });

  return instances;
}

function shapeRadius(shape) {
  switch (shape.type) {
    case 'circle':
      return shape.size * 0.5;
    case 'triangle':
      return shape.size * 0.55;
    case 'line':
      return shape.size * 0.6;
    case 'rect':
    default:
      return shape.size * 0.5;
  }
}

function updatePosition(shape, width, height) {
  const r = shapeRadius(shape);
  shape.x += shape.vx;
  shape.y += shape.vy;

  if (shape.x < r) {
    shape.x = r;
    shape.vx *= -1;
  }
  if (shape.x > width - r) {
    shape.x = width - r;
    shape.vx *= -1;
  }
  if (shape.y < r) {
    shape.y = r;
    shape.vy *= -1;
  }
  if (shape.y > height - r) {
    shape.y = height - r;
    shape.vy *= -1;
  }

  shape.angle += shape.spin;
}

function drawShape(renderer, ctx, shape, textureMap) {
  const useFill = shape.type !== 'line';
  const texture = textureMap.get(shape.textureUrl || '');
  const pattern = ctx && texture?.img
    ? (texture.pattern || (texture.pattern = ctx.createPattern(texture.img, 'repeat')))
    : null;

  if (useFill) {
    if (typeof renderer.fill === 'function') {
      renderer.fill(pattern || shape.color);
    } else if (ctx) {
      ctx.fillStyle = pattern || shape.color;
    }
  } else if (typeof renderer.noFill === 'function') {
    renderer.noFill();
  }

  if (typeof renderer.stroke === 'function') {
    renderer.stroke(shape.color);
  } else if (ctx) {
    ctx.strokeStyle = shape.color;
  }

  if (typeof renderer.strokeWeight === 'function') {
    renderer.strokeWeight(Math.max(1, shape.size * 0.08));
  } else if (ctx) {
    ctx.lineWidth = Math.max(1, shape.size * 0.08);
  }

  switch (shape.type) {
    case 'circle': {
      const circle = new c2.Circle(shape.x, shape.y, shape.size * 0.5);
      renderer.circle(circle);
      break;
    }
    case 'triangle': {
      const r = shape.size * 0.6;
      const a1 = shape.angle;
      const a2 = a1 + (Math.PI * 2) / 3;
      const a3 = a1 + (Math.PI * 4) / 3;
      const tri = new c2.Triangle(
        shape.x + Math.cos(a1) * r, shape.y + Math.sin(a1) * r,
        shape.x + Math.cos(a2) * r, shape.y + Math.sin(a2) * r,
        shape.x + Math.cos(a3) * r, shape.y + Math.sin(a3) * r
      );
      renderer.triangle(tri);
      break;
    }
    case 'line': {
      const half = shape.size * 0.6;
      const x1 = shape.x - Math.cos(shape.angle) * half;
      const y1 = shape.y - Math.sin(shape.angle) * half;
      const x2 = shape.x + Math.cos(shape.angle) * half;
      const y2 = shape.y + Math.sin(shape.angle) * half;
      const line = new c2.Line(x1, y1, x2, y2);
      renderer.line(line);
      break;
    }
    case 'rect':
    default: {
      const half = shape.size * 0.5;
      const rect = new c2.Rect(shape.x - half, shape.y - half, shape.size, shape.size);
      renderer.rect(rect);
      break;
    }
  }
}

async function init() {
  try {
    if (!c2 || !c2.Renderer) {
      throw new Error('c2.js failed to load. Check the CDN or network settings.');
    }
    if (!wrap) {
      throw new Error('Missing #wrap container.');
    }

    const data = await fetchPiece(ref);
    const cfg = normalizeConfig(data?.config);

    hideMsg();

    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'c2-canvas';
    wrap.appendChild(canvas);

    const renderer = new c2.Renderer(canvas);
    let { width, height } = getRenderSize();
    renderer.size(width, height);
    if (typeof renderer.background === 'function') {
      renderer.background(cfg.bg || '#000000');
    }

    const ctx = getRendererContext(renderer);

    let bgImage = null;
    const textureMap = new Map();

    if (cfg.bgImageUrl) {
      const wrappedBg = wrapWithCorsProxy(cfg.bgImageUrl);
      bgImage = await loadImage(wrappedBg);
    }

    for (const shape of cfg.shapes) {
      if (!shape?.textureUrl) continue;
      const wrapped = wrapWithCorsProxy(shape.textureUrl);
      const img = await loadImage(wrapped);
      textureMap.set(shape.textureUrl, { img, pattern: null });
    }

    let shapes = buildShapeInstances(width, height, cfg);

    const handleResize = () => {
      ({ width, height } = getRenderSize());
      renderer.size(width, height);
      shapes = buildShapeInstances(width, height, cfg);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('eap:layout', handleResize);

    const renderFrame = () => {
      if (typeof renderer.clear === 'function') {
        renderer.clear();
      } else if (ctx) {
        ctx.fillStyle = cfg.bg || '#000000';
        ctx.fillRect(0, 0, width, height);
      }

      if (bgImage && ctx) {
        ctx.drawImage(bgImage, 0, 0, width, height);
      }

      for (const shape of shapes) {
        updatePosition(shape, width, height);
        drawShape(renderer, ctx, shape, textureMap);
      }
    };

    if (typeof renderer.draw === 'function') {
      renderer.draw(renderFrame);
    } else {
      const tick = () => {
        renderFrame();
        requestAnimationFrame(tick);
      };
      tick();
    }
  } catch (err) {
    showMsg(`Error loading piece.\n\n${err?.message || String(err)}\n\nIf you see \"// assets/...\", your /api route is not returning JSON. Confirm the API is running and reachable at /api/pieces/{id}.`);
  }
}

init();
