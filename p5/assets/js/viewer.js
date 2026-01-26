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
    cameraZ: typeof cfg.cameraZ === 'number' ? cfg.cameraZ : 10,
    rotationSpeed: typeof cfg.rotationSpeed === 'number' ? cfg.rotationSpeed : 0.01,
    shapes
  };
}

function buildShapeInstances(p, cfg, textureMap) {
  const instances = [];
  const minDim = Math.min(p.width, p.height);
  const spread = minDim * 0.35;
  const baseScale = minDim * 0.06;

  cfg.shapes.forEach((shape) => {
    const count = Math.max(0, Number.parseInt(shape?.count ?? 0, 10) || 0);
    const size = clamp(Number(shape?.size ?? 1), 0.1, 10) * baseScale;
    const baseColor = shape?.palette?.baseColor || '#ffffff';
    const textureUrl = (shape?.textureUrl || '').trim();
    const texture = textureUrl ? textureMap.get(textureUrl) : null;

    for (let i = 0; i < count; i += 1) {
      instances.push({
        type: (shape?.type || 'box').toLowerCase(),
        size,
        color: jitterColor(p, baseColor),
        texture,
        position: {
          x: (Math.random() - 0.5) * spread,
          y: (Math.random() - 0.5) * spread,
          z: (Math.random() - 0.5) * spread
        },
        rotation: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2
        },
        spin: {
          x: (Math.random() - 0.5) * cfg.rotationSpeed,
          y: (Math.random() - 0.5) * cfg.rotationSpeed,
          z: (Math.random() - 0.5) * cfg.rotationSpeed
        }
      });
    }
  });

  return instances;
}

function drawShape(p, shape) {
  const s = shape.size;
  switch (shape.type) {
    case 'sphere':
      p.sphere(s * 0.6, 24, 16);
      break;
    case 'cone':
      p.cone(s * 0.45, s * 1.1, 24, 1);
      break;
    case 'torus':
      p.torus(s * 0.45, s * 0.18, 24, 24);
      break;
    case 'box':
    default:
      p.box(s, s, s);
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
      const textureMap = new Map();
      let bgImage = null;

      const textureUrls = new Set();
      cfg.shapes.forEach((shape) => {
        if (shape?.textureUrl) textureUrls.add(shape.textureUrl);
      });

      p.preload = () => {
        if (cfg.bgImageUrl) {
          const wrappedBg = wrapWithCorsProxy(cfg.bgImageUrl);
          p.loadImage(
            wrappedBg,
            (img) => { bgImage = img; },
            () => { bgImage = null; }
          );
        }

        textureUrls.forEach((url) => {
          const wrapped = wrapWithCorsProxy(url);
          p.loadImage(
            wrapped,
            (img) => { textureMap.set(url, img); },
            () => { textureMap.set(url, null); }
          );
        });
      };

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
        canvas.parent(wrap);
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
        p.noStroke();
        shapes = buildShapeInstances(p, cfg, textureMap);
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        if (bgImage) {
          p.background(bgImage);
        } else {
          p.background(cfg.bg || '#000000');
        }

        p.ambientLight(90);
        p.directionalLight(255, 255, 255, 0.6, 1, 0.4);

        if (typeof p.orbitControl === 'function') {
          p.orbitControl();
        }

        for (const shape of shapes) {
          p.push();
          p.translate(shape.position.x, shape.position.y, shape.position.z);
          shape.rotation.x += shape.spin.x;
          shape.rotation.y += shape.spin.y;
          shape.rotation.z += shape.spin.z;
          p.rotateX(shape.rotation.x);
          p.rotateY(shape.rotation.y);
          p.rotateZ(shape.rotation.z);

          if (shape.texture) {
            p.texture(shape.texture);
          } else {
            p.ambientMaterial(shape.color);
          }

          drawShape(p, shape);
          p.pop();
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
