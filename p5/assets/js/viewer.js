import { basePath } from './constants.js';

const wrap = document.querySelector("#wrap");
const msg = document.querySelector("#msg");

function showMsg(text) {
  if (!msg) return;
  msg.style.display = "block";
  msg.textContent = text;
}

function hideMsg() {
  if (!msg) return;
  msg.style.display = "none";
}

showMsg("Loading viewer…");

const params = new URLSearchParams(location.search);
const ref = params.get("id"); // numeric id OR slug
if (!ref) {
  showMsg("Missing ?id=");
  throw new Error("Missing id");
}

async function fetchPiece(refValue) {
  const url = `${basePath('/api/pieces')}/${encodeURIComponent(refValue)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Not available (${res.status}). ${txt ? txt.slice(0, 160) : ""}`.trim());
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const snippet = (txt || "").slice(0, 200);
    throw new Error(
      `API did not return JSON from ${url}.\n` +
      `Content-Type: ${ct || "(missing)"}\n` +
      `First bytes: ${snippet || "(empty response)"}`
    );
  }

  return await res.json();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = (hex || "#ffffff").replace("#", "").trim();
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

function jitterColor(p, hex) {
  const { r, g, b } = hexToRgb(hex || "#ffffff");
  const jitter = 36;
  return p.color(
    clamp(Math.round(r + (Math.random() - 0.5) * jitter), 0, 255),
    clamp(Math.round(g + (Math.random() - 0.5) * jitter), 0, 255),
    clamp(Math.round(b + (Math.random() - 0.5) * jitter), 0, 255)
  );
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

const LEGACY_TYPE_MAP = {
  box: 'rect',
  sphere: 'circle',
  cone: 'triangle',
  torus: 'line'
};

function buildShapeInstances(p, cfg) {
  const instances = [];
  const minDim = Math.min(p.width, p.height);
  const legacyScale = minDim * 0.12;
  const isLegacy = Number(cfg.version || 2) < 3;

  cfg.shapes.forEach((shape) => {
    const count = Math.max(0, Number.parseInt(shape?.count ?? 0, 10) || 0);
    const rawType = String(shape?.type || '').toLowerCase();
    const type = isLegacy ? (LEGACY_TYPE_MAP[rawType] || 'rect') : (rawType || 'rect');
    const sizeRaw = Number(shape?.size ?? (isLegacy ? 1 : 24));
    const size = isLegacy ? clamp(sizeRaw, 0.1, 10) * legacyScale : clamp(sizeRaw, 1, minDim * 0.9);

    const fillEnabled = (type === 'line' || type === 'point')
      ? false
      : (isLegacy ? true : (shape?.fill?.enabled ?? true));
    const fillColor = isLegacy
      ? (shape?.palette?.baseColor || '#ffffff')
      : (shape?.fill?.color || '#ffffff');

    const strokeEnabled = isLegacy
      ? false
      : (shape?.stroke?.enabled ?? (type === 'line' || type === 'point'));
    const strokeColor = isLegacy
      ? fillColor
      : (shape?.stroke?.color || '#000000');
    const strokeWeightRaw = Number(shape?.stroke?.weight);
    const strokeWeight = Number.isFinite(strokeWeightRaw)
      ? strokeWeightRaw
      : (type === 'point' ? Math.max(1, Math.round(size)) : 1);

    for (let i = 0; i < count; i += 1) {
      instances.push({
        type,
        size,
        x: Math.random() * p.width,
        y: Math.random() * p.height,
        angle: Math.random() * Math.PI * 2,
        fillEnabled,
        fillColor: jitterColor(p, fillColor),
        strokeEnabled,
        strokeColor: jitterColor(p, strokeColor),
        strokeWeight
      });
    }
  });

  return instances;
}

function applyStyle(p, shape) {
  if (shape.strokeEnabled && shape.strokeWeight > 0) {
    p.stroke(shape.strokeColor);
    p.strokeWeight(shape.strokeWeight);
  } else {
    p.noStroke();
  }

  if (shape.fillEnabled) {
    p.fill(shape.fillColor);
  } else {
    p.noFill();
  }
}

function drawShape(p, shape) {
  const s = shape.size;
  switch (shape.type) {
    case 'circle':
      p.circle(shape.x, shape.y, s);
      break;
    case 'triangle': {
      const r = s * 0.6;
      const a = shape.angle;
      const x1 = shape.x + Math.cos(a) * r;
      const y1 = shape.y + Math.sin(a) * r;
      const x2 = shape.x + Math.cos(a + (Math.PI * 2) / 3) * r;
      const y2 = shape.y + Math.sin(a + (Math.PI * 2) / 3) * r;
      const x3 = shape.x + Math.cos(a + (Math.PI * 4) / 3) * r;
      const y3 = shape.y + Math.sin(a + (Math.PI * 4) / 3) * r;
      p.triangle(x1, y1, x2, y2, x3, y3);
      break;
    }
    case 'line': {
      const half = s * 0.5;
      const dx = Math.cos(shape.angle) * half;
      const dy = Math.sin(shape.angle) * half;
      p.line(shape.x - dx, shape.y - dy, shape.x + dx, shape.y + dy);
      break;
    }
    case 'point':
      p.point(shape.x, shape.y);
      break;
    case 'rect':
    default:
      p.rect(shape.x, shape.y, s, s);
      break;
  }
}

async function init() {
  try {
    const data = await fetchPiece(ref);
    const cfg = normalizeConfig(data?.config);

    hideMsg();

    const sketch = (p) => {
      let shapes = [];
      let bgImage = null;

      p.preload = () => {
        if (cfg.bgImageUrl) {
          const wrappedBg = wrapWithCorsProxy(cfg.bgImageUrl);
          p.loadImage(
            wrappedBg,
            (img) => { bgImage = img; },
            () => { bgImage = null; }
          );
        }
      };

      p.setup = () => {
        const { width, height } = getRenderSize();
        const canvas = p.createCanvas(width, height);
        canvas.parent(wrap);
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
        p.rectMode(p.CENTER);
        p.ellipseMode(p.CENTER);
        shapes = buildShapeInstances(p, cfg);
      };

      p.windowResized = () => {
        const { width, height } = getRenderSize();
        p.resizeCanvas(width, height);
        shapes = buildShapeInstances(p, cfg);
      };

      window.addEventListener('eap:layout', p.windowResized);

      p.draw = () => {
        if (bgImage) {
          p.background(bgImage);
        } else {
          p.background(cfg.bg || '#000000');
        }

        for (const shape of shapes) {
          applyStyle(p, shape);
          drawShape(p, shape);
        }
      };
    };

    // Create a new p5 instance (instance mode avoids global collisions)
    // eslint-disable-next-line no-new
    new window.p5(sketch);
  } catch (err) {
    showMsg(`Error loading piece.\n\n${err?.message || String(err)}\n\nIf you see “// assets/…”, your /api route is not returning JSON. Confirm the API is running and reachable at /api/pieces/{id}.`);
  }
}

init();
