import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { basePath } from "./constants.js";

export function createViewer({ wrap, msg } = {}) {
  const noop = () => {};

  if (!wrap) {
    return {
      renderPiece: async () => {},
      renderConfig: async () => {},
      setMessage: noop,
      clearMessage: noop
    };
  }

  const messageEl = msg || null;

  function setMessage(text) {
    if (!messageEl) return;
    if (!text) {
      messageEl.textContent = "";
      messageEl.style.display = "none";
      return;
    }
    messageEl.style.display = "block";
    messageEl.textContent = text;
  }

  function clearMessage() {
    setMessage("");
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

  function getRenderSize() {
    const rect = wrap.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height))
    };
  }

  const scene = new THREE.Scene();
  const initialSize = getRenderSize();
  const camera = new THREE.PerspectiveCamera(60, initialSize.width / initialSize.height, 0.1, 2000);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(initialSize.width, initialSize.height);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  wrap.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 8, 6);
  scene.add(dir);

  function handleResize() {
    const { width, height } = getRenderSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }

  window.addEventListener("resize", handleResize);
  window.addEventListener("eap:layout", handleResize);

  let meshes = [];
  let rotationSpeed = 0.01;

  function clearMeshes() {
    for (const m of meshes) {
      scene.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.material.dispose();
    }
    meshes = [];
  }

  function wrapWithCorsProxy(url) {
    if (!url || typeof url !== "string") return url;

    try {
      const imageUrl = new URL(url, window.location.href);
      const isSameOrigin = imageUrl.origin === window.location.origin;

      if (isSameOrigin) {
        return url;
      }

      return `${basePath("/api/image-proxy")}?url=${encodeURIComponent(url)}`;
    } catch (e) {
      return `${basePath("/api/image-proxy")}?url=${encodeURIComponent(url)}`;
    }
  }

  async function loadTextureFromUrl(url, useProxy = false) {
    const urlToLoad = useProxy ? wrapWithCorsProxy(url) : url;
    const isProxied = urlToLoad !== url;

    return new Promise((resolve, reject) => {
      const timeoutDuration = isProxied ? 15000 : 10000;
      const timeout = setTimeout(() => {
        reject(new Error(`Texture loading timed out (${timeoutDuration / 1000}s): ${url}`));
      }, timeoutDuration);

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";

      loader.load(
        urlToLoad,
        (t) => {
          clearTimeout(timeout);
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
          reject(new Error(`Texture failed to load from ${url}: ${err?.message || "Unknown error"}`));
        }
      );
    });
  }

  async function loadTextureWithAutoProxy(url) {
    try {
      const imageUrl = new URL(url, window.location.href);
      const isSameOrigin = imageUrl.origin === window.location.origin;

      if (isSameOrigin) {
        return await loadTextureFromUrl(url, false);
      }

      try {
        return await loadTextureFromUrl(url, false);
      } catch (directError) {
        return await loadTextureFromUrl(url, true);
      }
    } catch (e) {
      throw new Error(`Failed to load texture from ${url}: ${e.message}`);
    }
  }

  async function renderConfig(config, { label } = {}) {
    if (!config) {
      clearMeshes();
      setMessage("No configuration provided.");
      return;
    }

    clearMeshes();

    renderer.setClearColor(new THREE.Color(config.bg || "#000000"), 1);
    scene.background = null;

    if (config.bgImageUrl) {
      try {
        const bgTexture = await loadTextureWithAutoProxy(config.bgImageUrl);
        if (bgTexture && bgTexture.image) {
          scene.background = bgTexture;
        } else {
          scene.background = null;
        }
      } catch (err) {
        scene.background = null;
      }
    }

    camera.position.z = config.cameraZ || 10;
    rotationSpeed = config.rotationSpeed ?? 0.01;

    if (Array.isArray(config.shapes)) {
      for (const s of config.shapes) {
        const type = s.type || "box";
        const count = Number(s.count || 0) | 0;
        if (count <= 0) continue;

        const geom = makeGeometry(type, Number(s.size || 1));
        let texture = null;

        if (s.textureUrl) {
          try {
            texture = await loadTextureWithAutoProxy(s.textureUrl);
          } catch (err) {
            texture = null;
          }
        } else if (s.textureDataUrl) {
          try {
            texture = await loadTextureWithAutoProxy(s.textureDataUrl);
          } catch (err) {
            texture = null;
          }
        }

        for (let i = 0; i < count; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: jitterColor(s.palette?.baseColor || "#ffffff"),
            roughness: 0.7,
            metalness: 0.1,
            transparent: true,
            opacity: Math.random() * 0.65 + 0.35
          });

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
      }

      if (label) setMessage(label);
      return;
    }

    const geom = makeGeometry(config.shapeType, config.uniformSize || 1);

    let texture = null;
    if (config.textureUrl) {
      try {
        texture = await loadTextureWithAutoProxy(config.textureUrl);
      } catch (err) {
        texture = null;
      }
    } else if (config.textureDataUrl) {
      try {
        texture = await loadTextureWithAutoProxy(config.textureDataUrl);
      } catch (err) {
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

    if (label) setMessage(label);
  }

  async function renderPiece(piece) {
    if (!piece) {
      setMessage("Missing piece data.");
      return;
    }

    if (piece.visibility === "deleted") {
      setMessage("This piece was deleted.");
      renderer.setClearColor(0x111111, 1);
      clearMeshes();
      scene.background = null;
      return;
    }

    const label = piece.slug ? `Piece: ${piece.slug}` : `Piece #${piece.id}`;
    await renderConfig(piece.config || {}, { label });
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

  animate();

  return {
    renderPiece,
    renderConfig,
    setMessage,
    clearMessage
  };
}
