// assets/js/builder.js

const form = document.querySelector("#builderForm");
const msgBox = document.querySelector("#msgBox");
const resultPanel = document.querySelector("#resultPanel");
const linksRow = document.querySelector("#linksRow");
const generateBtn = document.querySelector("#generateBtn");
const resetBtn = document.querySelector("#resetBtn");

const slugEl = document.querySelector("#slug");
const bgColorEl = document.querySelector("#bgColor");
const bgImageUrlEl = document.querySelector("#bgImageUrl");
const totalBadge = document.querySelector("#totalBadge");

// Output fields
const adminKeyPlain = document.querySelector("#adminKeyPlain");
const embedSlugCode = document.querySelector("#embedSlugCode");
const embedIdCode = document.querySelector("#embedIdCode");

const copyAdminKeyBtn = document.querySelector("#copyAdminKeyBtn");
const copyEmbedSlugBtn = document.querySelector("#copyEmbedSlugBtn");
const copyEmbedIdBtn = document.querySelector("#copyEmbedIdBtn");

const openEmbedSlugBtn = document.querySelector("#openEmbedSlugBtn");
const openEmbedIdBtn = document.querySelector("#openEmbedIdBtn");

const SHAPES = [
  { type: "box",    countId: "boxCount",    sizeId: "boxSize",    colorId: "boxColor",    texId: "boxTex",    countValId: "boxCountVal",    sizeValId: "boxSizeVal" },
  { type: "sphere", countId: "sphereCount", sizeId: "sphereSize", colorId: "sphereColor", texId: "sphereTex", countValId: "sphereCountVal", sizeValId: "sphereSizeVal" },
  { type: "cone",   countId: "coneCount",   sizeId: "coneSize",   colorId: "coneColor",   texId: "coneTex",   countValId: "coneCountVal",   sizeValId: "coneSizeVal" },
  { type: "torus",  countId: "torusCount",  sizeId: "torusSize",  colorId: "torusColor",  texId: "torusTex",  countValId: "torusCountVal",  sizeValId: "torusSizeVal" }
];

function setMsg(text, kind = "info") {
  msgBox.classList.remove("d-none", "alert-info", "alert-success", "alert-danger", "alert-warning", "alert-secondary");
  msgBox.classList.add(`alert-${kind}`);
  msgBox.textContent = text;
  msgBox.classList.remove("d-none");
}

function clearMsg() {
  msgBox.classList.add("d-none");
  msgBox.textContent = "";
}

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
  const el = document.querySelector(`#${id}`);
  return Number(el?.value || 0) | 0;
}

function getFloat(id) {
  const el = document.querySelector(`#${id}`);
  const v = Number(el?.value || 0);
  return Number.isFinite(v) ? v : 0;
}

function getVal(id) {
  const el = document.querySelector(`#${id}`);
  return (el?.value || "").toString().trim();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setMsg("Copied to clipboard.", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setMsg("Copied to clipboard.", "success");
  }
}

function updateBadges() {
  let total = 0;

  for (const s of SHAPES) {
    const count = getInt(s.countId);
    const size = getFloat(s.sizeId);

    const countVal = document.querySelector(`#${s.countValId}`);
    const sizeVal = document.querySelector(`#${s.sizeValId}`);

    if (countVal) countVal.textContent = String(count);
    if (sizeVal) sizeVal.textContent = size.toFixed(1);

    total += count;
  }

  totalBadge.textContent = String(total);
  if (total > 40) totalBadge.classList.add("text-danger");
  else totalBadge.classList.remove("text-danger");
}

for (const s of SHAPES) {
  const c = document.querySelector(`#${s.countId}`);
  const z = document.querySelector(`#${s.sizeId}`);
  c?.addEventListener("input", updateBadges);
  z?.addEventListener("input", updateBadges);
}
updateBadges();

slugEl.addEventListener("blur", () => {
  slugEl.value = normalizeSlug(slugEl.value);
});

resetBtn.addEventListener("click", () => {
  form.reset();

  bgColorEl.value = "#000000";
  for (const s of SHAPES) {
    document.querySelector(`#${s.countId}`).value = "0";
    document.querySelector(`#${s.sizeId}`).value = "1";
    document.querySelector(`#${s.colorId}`).value = "#ffffff";
    document.querySelector(`#${s.texId}`).value = "";
  }
  bgImageUrlEl.value = "";
  slugEl.value = "";

  clearMsg();
  resultPanel.classList.add("d-none");
  linksRow.innerHTML = "";
  adminKeyPlain.textContent = "";
  embedSlugCode.value = "";
  embedIdCode.value = "";
  openEmbedSlugBtn.removeAttribute("href");
  openEmbedIdBtn.removeAttribute("href");

  updateBadges();
});

function buildIframe(srcUrl) {
  return `<iframe src="${srcUrl}" width="100%" height="600" style="border:0;" loading="lazy" allowfullscreen></iframe>`;
}

function renderOutput({ id, slug, adminKey }) {
  const base = location.origin;
  const slugUrl = slug ? `${base}/embed.html?id=${encodeURIComponent(slug)}` : "";
  const idUrl = `${base}/embed.html?id=${encodeURIComponent(String(id))}`;

  // Admin key: plain text
  adminKeyPlain.textContent = adminKey || "";

  // Embed codes
  embedSlugCode.value = slug ? buildIframe(slugUrl) : "(no slug available)";
  embedIdCode.value = buildIframe(idUrl);

  // Open buttons
  if (slug) {
    openEmbedSlugBtn.href = slugUrl;
    openEmbedSlugBtn.classList.remove("disabled");
    openEmbedSlugBtn.setAttribute("aria-disabled", "false");
  } else {
    openEmbedSlugBtn.removeAttribute("href");
    openEmbedSlugBtn.classList.add("disabled");
    openEmbedSlugBtn.setAttribute("aria-disabled", "true");
  }

  openEmbedIdBtn.href = idUrl;

  // Quick links
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

  if (slug) linksRow.appendChild(mkLinkBtn(slugUrl, "Open embed (slug)"));
  linksRow.appendChild(mkLinkBtn(idUrl, "Open embed (id)"));

  const del = document.createElement("a");
  del.className = "btn btn-outline-light btn-sm";
  del.href = `${base}/delete.html?id=${encodeURIComponent(String(id))}`;
  del.textContent = "Open delete page";
  linksRow.appendChild(del);

  // Copy handlers
  copyAdminKeyBtn.onclick = () => copyToClipboard(adminKey || "");
  copyEmbedSlugBtn.onclick = () => copyToClipboard(embedSlugCode.value || "");
  copyEmbedIdBtn.onclick = () => copyToClipboard(embedIdCode.value || "");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  resultPanel.classList.add("d-none");
  linksRow.innerHTML = "";
  adminKeyPlain.textContent = "";
  embedSlugCode.value = "";
  embedIdCode.value = "";
  openEmbedSlugBtn.removeAttribute("href");
  openEmbedIdBtn.removeAttribute("href");

  const slugRaw = getVal("slug");
  const slug = normalizeSlug(slugRaw);

  const bg = getVal("bgColor");
  if (!isHexColor(bg)) return setMsg("Background color must be a valid hex color.", "warning");

  const bgImageUrl = getVal("bgImageUrl");
  const bgErr = validateImageUrl(bgImageUrl);
  if (bgErr) return setMsg(`Background image URL: ${bgErr}`, "warning");

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

  if (total <= 0) return setMsg("Set at least one shape count above 0.", "warning");
  if (total > 40) return setMsg("Total instances across all shapes must be 40 or less.", "danger");

  for (const s of shapes) {
    if (s.textureUrl) {
      const err = validateImageUrl(s.textureUrl);
      if (err) return setMsg(`${s.type} texture URL: ${err}`, "warning");
    }
  }

  const payload = {
    slug: slug || "",
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

  generateBtn.disabled = true;
  setMsg("Creating…", "warning");

  try {
    const res = await fetch("/api/pieces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || `Create failed (${res.status})`, "danger");
      return;
    }

    setMsg("Created successfully.", "success");
    resultPanel.classList.remove("d-none");

    renderOutput({
      id: data.id,
      slug: data.slug,
      adminKey: data.adminKey
    });
  } catch (err) {
    setMsg(err?.message || "Create failed", "danger");
  } finally {
    generateBtn.disabled = false;
  }
});
