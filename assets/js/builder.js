// assets/js/builder.js

// -------------------------
// Safe DOM helpers
// -------------------------
const $ = (sel) => document.querySelector(sel);

function ensureEl(id, tag, parent, className = "") {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement(tag);
  el.id = id;
  if (className) el.className = className;
  (parent || document.body).appendChild(el);
  return el;
}

// -------------------------
// Grab core elements (guarded)
// -------------------------
const form = $("#builderForm");
const msgBox = $("#msgBox");
const resultPanel = $("#resultPanel");
const resultJson = $("#resultJson"); // will be hidden/unused
const linksRow = $("#linksRow");
const generateBtn = $("#generateBtn");
const resetBtn = $("#resetBtn");

const slugEl = $("#slug");
const bgColorEl = $("#bgColor");
const bgImageUrlEl = $("#bgImageUrl");
const totalBadge = $("#totalBadge");

// Output fields
let adminKeyPlain = $("#adminKeyPlain");
let embedSlugCode = $("#embedSlugCode");
let embedIdCode = $("#embedIdCode");

let copyAdminKeyBtn = $("#copyAdminKeyBtn");
let copyEmbedSlugBtn = $("#copyEmbedSlugBtn");
let copyEmbedIdBtn = $("#copyEmbedIdBtn");

let openEmbedSlugBtn = $("#openEmbedSlugBtn");
let openEmbedIdBtn = $("#openEmbedIdBtn");

// Optional (only if your HTML has them)
let openViewerSlugBtn = $("#openViewerSlugBtn");
let openViewerIdBtn = $("#openViewerIdBtn");

// -------------------------
// If builder.html structure changed, prevent null crashes
// Create a minimal output UI if missing.
// -------------------------
function ensureResultUI() {
  if (!form) return;

  // Message box fallback
  if (!msgBox) {
    const box = ensureEl("msgBox", "div", form.parentElement, "alert d-none mt-3");
    box.classList.add("alert-info");
  }

  // Result panel fallback
  let panel = document.getElementById("resultPanel");
  if (!panel) {
    panel = ensureEl("resultPanel", "div", form.parentElement, "card mt-3 d-none");
    panel.innerHTML = `
      <div class="card-body">
        <h2 class="h6 mb-3 text-light fw-semibold">Output</h2>

        <div class="mb-3">
          <div class="form-label text-light">Admin key</div>
          <div id="adminKeyPlain" style="
            display:inline-block;
            padding:8px 10px;
            border-radius:12px;
            background:rgba(255,255,255,0.10);
            border:1px solid rgba(255,255,255,0.18);
            color:#fff;
            word-break:break-all;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
            font-size:0.95rem;
          "></div>
          <div class="mt-2 d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-light btn-sm" type="button" id="copyAdminKeyBtn">Copy admin key</button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label text-light" for="embedSlugCode">Iframe embed code (slug)</label>
          <textarea class="form-control" rows="3" id="embedSlugCode" readonly></textarea>
          <div class="mt-2 d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-light btn-sm" type="button" id="copyEmbedSlugBtn">Copy</button>
            <a class="btn btn-outline-light btn-sm" id="openEmbedSlugBtn" target="_blank" rel="noopener">Open embed (slug)</a>
          </div>
        </div>

        <div class="mb-2">
          <label class="form-label text-light" for="embedIdCode">Iframe embed code (id)</label>
          <textarea class="form-control" rows="3" id="embedIdCode" readonly></textarea>
          <div class="mt-2 d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-light btn-sm" type="button" id="copyEmbedIdBtn">Copy</button>
            <a class="btn btn-outline-light btn-sm" id="openEmbedIdBtn" target="_blank" rel="noopener">Open embed (id)</a>
          </div>
        </div>

        <div class="mt-3 d-flex gap-2 flex-wrap" id="linksRow"></div>
      </div>
    `;
  }

  // Re-bind pointers to output elements (important!)
  adminKeyPlain = $("#adminKeyPlain");
  embedSlugCode = $("#embedSlugCode");
  embedIdCode = $("#embedIdCode");

  copyAdminKeyBtn = $("#copyAdminKeyBtn");
  copyEmbedSlugBtn = $("#copyEmbedSlugBtn");
  copyEmbedIdBtn = $("#copyEmbedIdBtn");

  openEmbedSlugBtn = $("#openEmbedSlugBtn");
  openEmbedIdBtn = $("#openEmbedIdBtn");

  openViewerSlugBtn = $("#openViewerSlugBtn"); // optional
  openViewerIdBtn = $("#openViewerIdBtn");     // optional

  // Hide raw JSON panel (we will not use it)
  if (resultJson) resultJson.textContent = "";
  const rj = document.getElementById("resultJson");
  if (rj) rj.classList.add("d-none");
}
ensureResultUI();

// -------------------------
// Shapes map (IDs must match builder.html)
// -------------------------
const SHAPES = [
  { type: "box",    countId: "boxCount",    sizeId: "boxSize",    colorId: "boxColor",    texId: "boxTex",    countValId: "boxCountVal",    sizeValId: "boxSizeVal" },
  { type: "sphere", countId: "sphereCount", sizeId: "sphereSize", colorId: "sphereColor", texId: "sphereTex", countValId: "sphereCountVal", sizeValId: "sphereSizeVal" },
  { type: "cone",   countId: "coneCount",   sizeId: "coneSize",   colorId: "coneColor",   texId: "coneTex",   countValId: "coneCountVal",   sizeValId: "coneSizeVal" },
  { type: "torus",  countId: "torusCount",  sizeId: "torusSize",  colorId: "torusColor",  texId: "torusTex",  countValId: "torusCountVal",  sizeValId: "torusSizeVal" }
];

// -------------------------
// Messaging
// -------------------------
function setMsg(text, kind = "info") {
  const box = $("#msgBox") || msgBox;
  if (!box) return;

  box.classList.remove(
    "d-none",
    "alert-info",
    "alert-success",
    "alert-danger",
    "alert-warning",
    "alert-secondary"
  );
  box.classList.add(`alert-${kind}`);
  box.textContent = text;
  box.classList.remove("d-none");
}

function clearMsg() {
  const box = $("#msgBox") || msgBox;
  if (!box) return;
  box.classList.add("d-none");
  box.textContent = "";
}

// -------------------------
// Validation helpers
// -------------------------
function normalizeSlug(s) {
  s = (s || "").toLowerCase().trim();
  s = s.replace(/[^a-z0-9\-]+/g, "-");
  s = s.replace(/\-+/g, "-");
  s = s.replace(/^\-+|\-+$/g, "");
  if (s.length > 60) s = s.slice(0, 60);
  return s;
}

function isHexColor(c) {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
}

function validateImageUrl(url) {
  if (!url) return null;

  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return "URL must start with http:// or https://";

  let path = "";
  try {
    const parsed = new URL(u);
    path = (parsed.pathname || "").toLowerCase();
  } catch {
    return "Invalid URL format";
  }

  const ok =
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp");

  if (!ok) return "URL must end in .png, .jpg, .jpeg, or .webp";
  if (u.length > 2048) return "URL too long";
  return null;
}

function getInt(id) {
  const el = $(`#${id}`);
  return Number(el?.value || 0) | 0;
}

function getFloat(id) {
  const el = $(`#${id}`);
  const v = Number(el?.value || 0);
  return Number.isFinite(v) ? v : 0;
}

function getVal(id) {
  const el = $(`#${id}`);
  return (el?.value || "").toString().trim();
}

async function copyToClipboard(text) {
  const t = String(text || "");
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    setMsg("Copied to clipboard.", "success");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setMsg("Copied to clipboard.", "success");
  }
}

// -------------------------
// Badge + per-field readouts (fix: guard totalBadge)
// -------------------------
function updateBadges() {
  let total = 0;

  for (const s of SHAPES) {
    const count = getInt(s.countId);
    const size = getFloat(s.sizeId);

    const countVal = $(`#${s.countValId}`);
    const sizeVal = $(`#${s.sizeValId}`);

    if (countVal) countVal.textContent = String(count);
    if (sizeVal) sizeVal.textContent = Number.isFinite(size) ? size.toFixed(1) : "0.0";

    total += count;
  }

  if (totalBadge) {
    totalBadge.textContent = String(total);
    if (total > 40) totalBadge.classList.add("text-danger");
    else totalBadge.classList.remove("text-danger");
  }
}

// Wire range listeners
for (const s of SHAPES) {
  const c = $(`#${s.countId}`);
  const z = $(`#${s.sizeId}`);
  c?.addEventListener("input", updateBadges);
  z?.addEventListener("input", updateBadges);
}
updateBadges();

// Normalize slug on blur (guard)
slugEl?.addEventListener("blur", () => {
  slugEl.value = normalizeSlug(slugEl.value);
});

// -------------------------
// Reset (guard everything)
// -------------------------
resetBtn?.addEventListener("click", () => {
  form?.reset();

  if (bgColorEl) bgColorEl.value = "#000000";

  for (const s of SHAPES) {
    const c = $(`#${s.countId}`);
    const z = $(`#${s.sizeId}`);
    const col = $(`#${s.colorId}`);
    const tex = $(`#${s.texId}`);

    if (c) c.value = "0";
    if (z) z.value = "1";
    if (col) col.value = "#ffffff";
    if (tex) tex.value = "";
  }

  if (bgImageUrlEl) bgImageUrlEl.value = "";
  if (slugEl) slugEl.value = "";

  clearMsg();

  const rp = $("#resultPanel") || resultPanel;
  rp?.classList.add("d-none");

  if (linksRow) linksRow.innerHTML = "";

  if (adminKeyPlain) adminKeyPlain.textContent = "";
  if (embedSlugCode) embedSlugCode.value = "";
  if (embedIdCode) embedIdCode.value = "";

  openEmbedSlugBtn?.removeAttribute("href");
  openEmbedIdBtn?.removeAttribute("href");
  openViewerSlugBtn?.removeAttribute("href");
  openViewerIdBtn?.removeAttribute("href");

  updateBadges();
});

// -------------------------
// Output rendering
// -------------------------
function buildIframe(srcUrl) {
  return `<iframe src="${srcUrl}" width="100%" height="600" style="border:0;border-radius:12px;overflow:hidden" loading="lazy" allowfullscreen></iframe>`;
}

function renderOutput({ id, slug, adminKey, fallbackSlug }) {
  ensureResultUI(); // rebind in case DOM changed

  const base = location.origin;

  // Prefer server-returned slug, else fallback to requested slug
  const finalSlug = (slug || fallbackSlug || "").trim();

  const slugUrl = finalSlug ? `${base}/embed.html?id=${encodeURIComponent(finalSlug)}` : "";
  const idUrl = `${base}/embed.html?id=${encodeURIComponent(String(id))}`;

  const viewerSlugUrl = finalSlug ? `${base}/view.html?id=${encodeURIComponent(finalSlug)}` : "";
  const viewerIdUrl = `${base}/view.html?id=${encodeURIComponent(String(id))}`;

  // Make admin key visibly readable
  if (adminKeyPlain) {
    adminKeyPlain.textContent = adminKey || "(missing admin key)";
    adminKeyPlain.style.background = "rgba(255,255,255,0.10)";
    adminKeyPlain.style.border = "1px solid rgba(255,255,255,0.18)";
    adminKeyPlain.style.color = "#ffffff";
    adminKeyPlain.style.padding = "8px 10px";
    adminKeyPlain.style.borderRadius = "12px";
    adminKeyPlain.style.display = "inline-block";
    adminKeyPlain.style.wordBreak = "break-all";
  }

  // Embed codes
  if (embedSlugCode) embedSlugCode.value = finalSlug ? buildIframe(slugUrl) : "(no slug available)";
  if (embedIdCode) embedIdCode.value = buildIframe(idUrl);

  // Open buttons (embed)
  if (openEmbedSlugBtn) {
    if (finalSlug) {
      openEmbedSlugBtn.href = slugUrl;
      openEmbedSlugBtn.classList.remove("disabled");
      openEmbedSlugBtn.setAttribute("aria-disabled", "false");
    } else {
      openEmbedSlugBtn.removeAttribute("href");
      openEmbedSlugBtn.classList.add("disabled");
      openEmbedSlugBtn.setAttribute("aria-disabled", "true");
    }
  }

  if (openEmbedIdBtn) openEmbedIdBtn.href = idUrl;

  // Optional viewer buttons (only if they exist in HTML)
  if (openViewerSlugBtn) {
    if (finalSlug) {
      openViewerSlugBtn.href = viewerSlugUrl;
      openViewerSlugBtn.classList.remove("disabled");
      openViewerSlugBtn.setAttribute("aria-disabled", "false");
    } else {
      openViewerSlugBtn.removeAttribute("href");
      openViewerSlugBtn.classList.add("disabled");
      openViewerSlugBtn.setAttribute("aria-disabled", "true");
    }
  }
  if (openViewerIdBtn) openViewerIdBtn.href = viewerIdUrl;

  // Quick links row (NO delete link here)
  if (linksRow) {
    linksRow.innerHTML = "";

    const mkLinkBtn = (href, label) => {
      const a = document.createElement("a");
      a.className = "btn btn-outline-light btn-sm";
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = label;
      return a;
    };

    if (finalSlug) {
      linksRow.appendChild(mkLinkBtn(slugUrl, "Open embed (slug)"));
      if (viewerSlugUrl) linksRow.appendChild(mkLinkBtn(viewerSlugUrl, "Open viewer (slug)"));
    }

    linksRow.appendChild(mkLinkBtn(idUrl, "Open embed (id)"));
    if (viewerIdUrl) linksRow.appendChild(mkLinkBtn(viewerIdUrl, "Open viewer (id)"));
  }

  // Copy handlers
  if (copyAdminKeyBtn) copyAdminKeyBtn.onclick = () => copyToClipboard(adminKey || "");
  if (copyEmbedSlugBtn) copyEmbedSlugBtn.onclick = () => copyToClipboard(embedSlugCode?.value || "");
  if (copyEmbedIdBtn) copyEmbedIdBtn.onclick = () => copyToClipboard(embedIdCode?.value || "");
}

// -------------------------
// Submit handler (fixes total=0 behavior + no raw JSON)
// -------------------------
if (!form) {
  setMsg('builderForm not found. Ensure your <form> has id="builderForm".', "danger");
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();
    ensureResultUI();

    const rp = $("#resultPanel") || resultPanel;
    rp?.classList.add("d-none");

    if (linksRow) linksRow.innerHTML = "";
    if (adminKeyPlain) adminKeyPlain.textContent = "";
    if (embedSlugCode) embedSlugCode.value = "";
    if (embedIdCode) embedIdCode.value = "";
    openEmbedSlugBtn?.removeAttribute("href");
    openEmbedIdBtn?.removeAttribute("href");
    openViewerSlugBtn?.removeAttribute("href");
    openViewerIdBtn?.removeAttribute("href");

    // slug (optional)
    const slugRaw = getVal("slug");
    const slugNormalized = normalizeSlug(slugRaw);

    // global bg
    const bg = getVal("bgColor");
    if (!isHexColor(bg)) return setMsg("Background color must be a valid hex color.", "warning");

    // bg image url
    const bgImageUrl = getVal("bgImageUrl");
    const bgErr = validateImageUrl(bgImageUrl);
    if (bgErr) return setMsg(`Background image URL: ${bgErr}`, "warning");

    // shapes
    let total = 0;
    const shapes = SHAPES.map((s) => {
      const count = Math.max(0, Math.min(10, getInt(s.countId)));
      const size = Math.max(0.1, Math.min(10, getFloat(s.sizeId)));
      const baseColor = getVal(s.colorId);
      const textureUrl = getVal(s.texId);

      total += count;

      return {
        type: s.type,
        count,
        size,
        palette: { baseColor: isHexColor(baseColor) ? baseColor : "#ffffff" },
        textureUrl: textureUrl || ""
      };
    });

    // FIX: Do NOT block when total==0. Auto-set boxCount = 1 and proceed.
    if (total <= 0) {
      const boxDef = SHAPES.find((x) => x.type === "box");
      if (boxDef) {
        const boxCountEl = $(`#${boxDef.countId}`);
        if (boxCountEl) boxCountEl.value = "1";
        // update model too
        const boxShape = shapes.find((x) => x.type === "box");
        if (boxShape) boxShape.count = 1;
        total = 1;
        updateBadges();
      }
    }

    if (total > 40) return setMsg("Total instances across all shapes must be 40 or less.", "danger");

    // validate texture URLs
    for (const s of shapes) {
      if (s.textureUrl) {
        const err = validateImageUrl(s.textureUrl);
        if (err) return setMsg(`${s.type} texture URL: ${err}`, "warning");
      }
    }

    const payload = {
      slug: slugNormalized || "", // user-controlled (optional)
      visibility: "public",
      config: {
        version: 2,
        bg,
        bgImageUrl: bgImageUrl || "",
        cameraZ: 10,
        rotationSpeed: 0.01,
        shapes
      }
    };

    if (generateBtn) generateBtn.disabled = true;
    setMsg("Creating…", "warning");

    try {
      const res = await fetch("/api/pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // If server returns non-JSON, capture text for debugging without breaking UI
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "Server returned non-JSON response", raw: text.slice(0, 300) };
      }

      if (!res.ok) {
        setMsg(data.error || `Create failed (${res.status})`, "danger");
        return;
      }

      // Validate expected fields so we don’t “render nothing”
      const createdId = data?.id;
      const createdSlug = (data?.slug || "").toString().trim();
      const createdKey = (data?.adminKey || "").toString().trim();

      if (!createdId) {
        setMsg("Create succeeded, but response is missing an id. Check /api/pieces response.", "danger");
        return;
      }

      setMsg("Created successfully.", "success");
      rp?.classList.remove("d-none");

      renderOutput({
        id: createdId,
        slug: createdSlug,
        adminKey: createdKey,
        fallbackSlug: slugNormalized
      });

      // IMPORTANT: Do not show raw JSON output
      if (resultJson) {
        resultJson.textContent = "";
        resultJson.classList.add("d-none");
      }
    } catch (err) {
      setMsg(err?.message || "Create failed", "danger");
    } finally {
      if (generateBtn) generateBtn.disabled = false;
    }
  });
}
