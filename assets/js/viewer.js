import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const wrap = document.querySelector("#wrap");
const msg = document.querySelector("#msg");

function showMsg(text) {
  msg.style.display = "block";
  msg.textContent = text;
}

showMsg("Loading viewer…");

const params = new URLSearchParams(location.search);
const ref = params.get("id"); // numeric id OR slug
if (!ref) {
  showMsg("Missing ?id=");
  throw new Error("Missing id");
}

/**
 * Try both API styles:
 *  - /api/pieces/{ref}           (pretty route)
 *  - /api/index.php/pieces/{ref} (works without rewrites)
 */
async function fetchPiece(ref) {
  const candidates = [
    `/api/pieces/${encodeURIComponent(ref)}`,
    `/api/index.php/pieces/${encodeURIComponent(ref)}`
  ];

  let lastErr = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });

      // If it’s not OK, read text for debugging but keep it short
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Not available (${res.status}). ${txt ? txt.slice(0, 160) : ""}`.trim());
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        // Not JSON -> avoid res.json() crash, show a useful snippet
        const txt = await res.text().catch(() => "");
        const snippet = (txt || "").slice(0, 200);
        throw new Error(
          `API did not return JSON from ${url}.\n` +
          `Content-Type: ${ct || "(missing)"}\n` +
          `First bytes: ${snippet || "(empty response)"}`
        );
      }

      return await res.json();
    } catch (e) {
      lastErr = e;
      // try next candidate
    }
  }

  throw lastErr || new Error("Failed to fetch piece");
}

function makeGeometry(type, size) {
  const s = size;
  switch (type) {
    case "sphere": return new THREE.SphereGeometry(s * 0.5, 24, 16);
    case "cone": return new THREE.ConeGeometry(s * 0.5, s * 1.1, 24);
    case "torus": return new THREE.TorusGeometry(s * 0.45, s * 0.15, 16, 40);
    case "box":
    default: return new THREE.BoxGeometry(s, s, s);
  }
}

function jitterColor(baseHex) {
  const c = new THREE.Color(baseHex || "#ffffff");
  const hsl = {};
  c.getHSL(hsl);
  hsl.l = Math.min(0.85, Math.max(0.15, hsl.l + (Math.random() - 0.5) * 0.25));
  hsl.s = Math.min(1.0, Math.max(0.2, hsl.s + (Math.random() - 0.5) * 0.2));
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

function randomPos(range = 10) {
  return (Math.random() - 0.5) * 0.4 * range;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 8, 6);
scene.add(dir);

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

let meshes = [];
let rotationSpeed = 0.01;

function clear() {
  for (const m of meshes) {
    scene.remove(m);
    if (m.material?.map) m.material.map.dispose();
    m.material.dispose();
  }
  meshes = [];
}

/**
 * Wrap cross-origin image URLs with CORS proxy to enable texture loading.
 * Same-origin images are returned as-is (no proxy needed).
 */
function wrapWithCorsProxy(url) {
  if (!url || typeof url !== 'string') return url;

  try {
    const imageUrl = new URL(url, window.location.href);
    const isSameOrigin = imageUrl.origin === window.location.origin;

    // Same-origin images don't need proxy
    if (isSameOrigin) {
      return url;
    }

    // Wrap cross-origin images with CORS proxy
    // This allows loading images from any source without CORS restrictions
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  } catch (e) {
    // If URL parsing fails, wrap it anyway to be safe
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
}

async function loadTextureFromUrl(url, useProxy = false) {
  // Determine if we should use proxy
  const urlToLoad = useProxy ? wrapWithCorsProxy(url) : url;
  const isProxied = urlToLoad !== url;

  if (isProxied) {
    console.log(`Using CORS proxy for: ${url}`);
  }

  return new Promise((resolve, reject) => {
    // Timeout: 10s for direct load, 15s for proxy (proxy is slower)
    const timeoutDuration = isProxied ? 15000 : 10000;
    const timeout = setTimeout(() => {
      reject(new Error(`Texture loading timed out (${timeoutDuration/1000}s): ${url}`));
    }, timeoutDuration);

    const loader = new THREE.TextureLoader();
    // Enable CORS for all cross-origin requests
    loader.crossOrigin = 'anonymous';

    loader.load(
      urlToLoad,
      (t) => {
        clearTimeout(timeout);
        // Validate that we got a real texture object
        if (!t || !t.image) {
          reject(new Error(`Invalid texture object received from ${url}`));
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        resolve(t);
      },
      undefined,
      (err) => {
        clearTimeout(timeout);
        // Provide more detailed error information
        reject(new Error(`Texture failed to load from ${url}: ${err?.message || 'Unknown error'}`));
      }
    );
  });
}

/**
 * Try loading texture, with automatic proxy fallback on CORS failure.
 * First attempts direct load (faster for CORS-enabled images),
 * then retries with CORS proxy if it fails.
 */
async function loadTextureWithAutoProxy(url) {
  try {
    const imageUrl = new URL(url, window.location.href);
    const isSameOrigin = imageUrl.origin === window.location.origin;

    // Same-origin images always work without proxy
    if (isSameOrigin) {
      console.log(`Loading same-origin image: ${url}`);
      return await loadTextureFromUrl(url, false);
    }

    // Try cross-origin image without proxy first (faster if CORS-enabled)
    console.log(`Trying direct load for: ${url}`);
    try {
      return await loadTextureFromUrl(url, false);
    } catch (directError) {
      // Direct load failed - likely CORS issue, retry with proxy
      console.log(`Direct load failed, retrying with CORS proxy: ${url}`);
      return await loadTextureFromUrl(url, true);
    }
  } catch (e) {
    // URL parsing failed or proxy load failed - give up
    throw new Error(`Failed to load texture from ${url}: ${e.message}`);
  }
}

async function buildFromPiece(piece) {
  console.log("=== Building piece ===");
  console.log("Piece ID:", piece.id);
  console.log("Piece slug:", piece.slug);
  console.log("Piece data:", piece);

  if (piece.visibility === "deleted") {
    showMsg("This piece was deleted.");
    renderer.setClearColor(0x111111, 1);
    clear();
    return;
  }

  const config = piece.config || {};
  console.log("Config:", config);
  clear();

  // Set background color first (fallback if image fails to load)
  renderer.setClearColor(new THREE.Color(config.bg || "#000000"), 1);

  // Load background image if provided
  if (config.bgImageUrl) {
    try {
      console.log("Loading background image:", config.bgImageUrl);
      const bgTexture = await loadTextureWithAutoProxy(config.bgImageUrl);
      console.log("Background texture loaded, object:", bgTexture);
      console.log("Texture.image exists?", !!bgTexture?.image);
      console.log("Texture.image value:", bgTexture?.image);
      // Validate texture before applying
      if (bgTexture && bgTexture.image) {
        scene.background = bgTexture;
        console.log("✓ Background image loaded successfully and applied");
      } else {
        console.warn("✗ Invalid background texture object (no image property), using background color");
        console.warn("Texture object keys:", bgTexture ? Object.keys(bgTexture) : 'null');
        scene.background = null;
      }
    } catch (err) {
      console.warn("✗ Failed to load background image, using background color:", err.message);
      console.warn("Error stack:", err.stack);
      // Keep using the background color as fallback
      scene.background = null;
    }
  } else {
    console.log("No background image URL provided, using solid color");
    // No background image - use solid color
    scene.background = null;
  }

  camera.position.z = config.cameraZ || 10;
  rotationSpeed = config.rotationSpeed ?? 0.01;

  // Multi-shape support (config.shapes[])
  if (Array.isArray(config.shapes)) {
    for (const s of config.shapes) {
      const type = s.type || "box";
      const count = Number(s.count || 0) | 0;
      if (count <= 0) continue;

      const geom = makeGeometry(type, Number(s.size || 1));
      let texture = null;

      // Load texture with error handling - fall back to base color if texture fails
      if (s.textureUrl) {
        try {
          console.log(`Loading texture for ${type}:`, s.textureUrl);
          texture = await loadTextureWithAutoProxy(s.textureUrl);
          console.log(`Texture object for ${type}:`, texture);
          console.log(`Texture.image exists for ${type}?`, !!texture?.image);
          console.log(`✓ Texture loaded successfully for ${type}`);
        } catch (err) {
          console.warn(`✗ Failed to load texture for ${type}, falling back to base color:`, s.textureUrl, err.message);
          // Continue without texture - will use base color
          texture = null;
        }
      } else if (s.textureDataUrl) {
        try {
          console.log(`Loading data texture for ${type}`);
          texture = await loadTextureWithAutoProxy(s.textureDataUrl);
          console.log(`Data texture object for ${type}:`, texture);
          console.log(`Data texture.image exists for ${type}?`, !!texture?.image);
          console.log(`✓ Data texture loaded successfully for ${type}`);
        } catch (err) {
          console.warn(`✗ Failed to load data texture for ${type}, falling back to base color:`, err.message);
          // Continue without texture - will use base color
          texture = null;
        }
      } else {
        console.log(`No texture URL for ${type}, using base color`);
      }

      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: jitterColor(s.palette?.baseColor || "#ffffff"),
          roughness: 0.7,
          metalness: 0.1,
          transparent: true,
          opacity: Math.random() * 0.65 + 0.35
        });

        // Only apply texture if it's a valid texture object with an image
        if (texture && texture.image) {
          if (i === 0) console.log(`Applying texture to ${type} material (count: ${count})`);
          mat.map = texture;
          mat.color.set("#ffffff");
          mat.needsUpdate = true;
        } else {
          if (i === 0) console.log(`Using base color for ${type} (no valid texture)`);
        }

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(randomPos(10), randomPos(10), randomPos(10));
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);
        meshes.push(mesh);
      }
    }

    showMsg(piece.slug ? `Piece: ${piece.slug}` : `Piece #${piece.id}`);
    return;
  }

  // Legacy single-shape support
  const geom = makeGeometry(config.shapeType, config.uniformSize || 1);

  let texture = null;
  // Load texture with error handling - fall back to base color if texture fails
  if (config.textureUrl) {
    try {
      console.log("Loading legacy texture:", config.textureUrl);
      texture = await loadTextureWithAutoProxy(config.textureUrl);
      console.log("✓ Legacy texture loaded successfully");
    } catch (err) {
      console.warn("✗ Failed to load legacy texture, falling back to base color:", config.textureUrl, err.message);
      // Continue without texture - will use base color
      texture = null;
    }
  } else if (config.textureDataUrl) {
    try {
      console.log("Loading legacy data texture");
      texture = await loadTextureWithAutoProxy(config.textureDataUrl);
      console.log("✓ Legacy data texture loaded successfully");
    } catch (err) {
      console.warn("✗ Failed to load legacy data texture, falling back to base color:", err.message);
      // Continue without texture - will use base color
      texture = null;
    }
  }

  const count = config.count || 20;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: jitterColor(config.palette?.baseColor || "#ffffff"),
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: Math.random() * 0.65 + 0.35
    });

    // Only apply texture if it's a valid texture object with an image
    if (texture && texture.image) {
      mat.map = texture;
      mat.color.set("#ffffff");
      mat.needsUpdate = true;
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(randomPos(10), randomPos(10), randomPos(10));
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    scene.add(mesh);
    meshes.push(mesh);
  }

  showMsg(piece.slug ? `Piece: ${piece.slug}` : `Piece #${piece.id}`);
}

function animate() {
  requestAnimationFrame(animate);
  for (const m of meshes) {
    m.rotation.x += rotationSpeed;
    m.rotation.y -= rotationSpeed;
  }
  controls.update();
  renderer.render(scene, camera);
}

fetchPiece(ref)
  .then((piece) => buildFromPiece(piece))
  .catch((err) => {
    // If this is embedded, show a clean message instead of a JSON parse crash
    showMsg(`Error loading piece.\n\n${err?.message || String(err)}\n\nIf you see “// assets/…”, your /api route is not returning JSON. This viewer will also try /api/index.php/pieces/{id} automatically.`);
  });

animate();
