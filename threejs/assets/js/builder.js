// assets/js/builder.js

import { LIMITS, SHAPES, API_ENDPOINTS, ALLOWED_IMAGE_EXTENSIONS, BASE_PATH, RECAPTCHA } from './constants.js';
import { getRecaptchaToken } from './recaptcha.js';
import { createViewer } from './viewer-core.js';

// -------------------------
// DOM helpers
// -------------------------
const $ = (sel) => document.querySelector(sel);

// Form elements
const form = $("#builderForm");
const msgBox = $("#msgBox");
const resultPanel = $("#resultPanel");
const linksRow = $("#linksRow");
const generateBtn = $("#generateBtn");
const resetBtn = $("#resetBtn");

const slugEl = $("#slug");
const bgColorEl = $("#bgColor");
const bgImageUrlEl = $("#bgImageUrl");
const emailEl = $("#email");

// Live preview elements - initialize after DOM is ready
let previewViewer = null;

function initPreview() {
  const previewWrap = document.getElementById("previewWrap");
  const previewMsg = document.getElementById("previewMsg");
  
  if (previewWrap && !previewViewer) {
    previewViewer = createViewer({ wrap: previewWrap, msg: previewMsg });
    if (previewViewer) {
      previewViewer.setMessage("Waiting for preview data...");
      // Send initial preview after a short delay
      setTimeout(() => {
        updatePreviewFromForm({ applyAutoMinimum: false });
      }, 100);
    }
  }
}

function sendPreviewConfig(config, message = null) {
  if (!previewViewer) {
    // Try to initialize if not already done
    initPreview();
    if (!previewViewer) return;
  }

  if (message) {
    previewViewer.setMessage(message);
  } else {
    previewViewer.clearMessage();
  }

  if (config) {
    previewViewer.renderConfig(config).catch((err) => {
      if (previewViewer) {
        previewViewer.setMessage(`Error rendering preview: ${err?.message || err}`);
      }
    });
  } else if (!message) {
    previewViewer.setMessage("No configuration provided.");
  }
}

// -------------------------
// Messaging
// -------------------------
function setMsg(text, kind = "info") {
  if (!msgBox) return;
  msgBox.classList.remove("d-none", "alert-info", "alert-success", "alert-danger", "alert-warning", "alert-secondary");
  msgBox.classList.add(`alert-${kind}`);
  msgBox.textContent = text;
  msgBox.classList.remove("d-none");
}

function clearMsg() {
  if (!msgBox) return;
  msgBox.classList.add("d-none");
  msgBox.textContent = "";
}

// -------------------------
// Validation helpers
// -------------------------
function normalizeSlug(s) {
  s = (s || "").toLowerCase().trim();
  s = s.replace(/[^a-z0-9\-]+/g, "-");
  s = s.replace(/\-+/g, "-");
  s = s.replace(/^\-+|\-+$/g, "");
  if (s.length > LIMITS.SLUG_MAX_LENGTH) s = s.slice(0, LIMITS.SLUG_MAX_LENGTH);
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

  const ok = ALLOWED_IMAGE_EXTENSIONS.some(ext => path.endsWith(ext));

  if (!ok) {
    const allowed = ALLOWED_IMAGE_EXTENSIONS.join(', ');
    return `URL must end in one of: ${allowed}`;
  }
  if (u.length > LIMITS.URL_MAX_LENGTH) return `URL too long (max ${LIMITS.URL_MAX_LENGTH} chars)`;
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

function buildConfigFromForm({ applyAutoMinimum = false } = {}) {
  const bg = getVal("bgColor");
  if (!isHexColor(bg)) return { error: "Background color must be a valid hex color." };

  const bgImageUrl = getVal("bgImageUrl");
  const bgErr = validateImageUrl(bgImageUrl);
  if (bgErr) return { error: `Background image URL: ${bgErr}` };

  let total = 0;
  const shapes = SHAPES.map((s) => {
    const count = Math.max(LIMITS.SHAPE_COUNT_MIN, Math.min(LIMITS.SHAPE_COUNT_MAX, getInt(s.countId)));
    const size = Math.max(LIMITS.SIZE_MIN, Math.min(LIMITS.SIZE_MAX, getFloat(s.sizeId)));
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

  if (applyAutoMinimum && total <= 0) {
    const boxDef = SHAPES.find((x) => x.type === "box");
    if (boxDef) {
      const boxCountEl = $(`#${boxDef.countId}`);
      if (boxCountEl) boxCountEl.value = "1";
      const boxShape = shapes.find((x) => x.type === "box");
      if (boxShape) boxShape.count = 1;
      total = 1;
      updateBadges();
    }
  }

  if (total > LIMITS.TOTAL_INSTANCES_MAX) {
    return { error: `Total instances across all shapes must be ${LIMITS.TOTAL_INSTANCES_MAX} or less.` };
  }

  for (const s of shapes) {
    if (s.textureUrl) {
      const err = validateImageUrl(s.textureUrl);
      if (err) return { error: `${s.type} texture URL: ${err}` };
    }
  }

  return {
    config: {
      version: 2,
      bg,
      bgImageUrl: bgImageUrl || "",
      cameraZ: 10,
      rotationSpeed: 0.01,
      shapes
    },
    total
  };
}

// -------------------------
// Badge updates (EXACT copy from edit.js)
// -------------------------
function updateBadges() {
  let total = 0;

  for (const s of SHAPES) {
    const countEl = document.getElementById(s.countId);
    const sizeEl = document.getElementById(s.sizeId);
    const count = countEl ? parseInt(countEl.value, 10) || 0 : 0;
    const size = sizeEl ? parseFloat(sizeEl.value) || 0 : 0;

    const countVal = document.getElementById(s.countValId);
    const sizeVal = document.getElementById(s.sizeValId);

    if (countVal) countVal.textContent = String(count);
    if (sizeVal) sizeVal.textContent = Number.isFinite(size) ? size.toFixed(1) : "0.0";

    total += count;
  }

  const totalBadgeEl = document.getElementById("totalBadge");
  if (totalBadgeEl) {
    totalBadgeEl.textContent = String(total);
    if (total > LIMITS.TOTAL_INSTANCES_MAX) {
      totalBadgeEl.classList.add("text-danger");
    } else {
      totalBadgeEl.classList.remove("text-danger");
    }
  }
}

// -------------------------
// Live preview updates (EXACT copy from edit.js)
// -------------------------
let previewDebounce = null;

function updatePreviewFromForm({ applyAutoMinimum = false } = {}) {
  // Ensure preview is initialized
  if (!previewViewer) {
    initPreview();
    if (!previewViewer) return;
  }
  
  const result = buildConfigFromForm({ applyAutoMinimum });

  if (result.error) {
    sendPreviewConfig(null, result.error);
  } else if (result.total <= 0) {
    sendPreviewConfig(result.config, "Add at least one shape to see the preview.");
  } else {
    sendPreviewConfig(result.config);
  }
}

function schedulePreviewUpdate() {
  // Ensure preview is initialized
  if (!previewViewer) {
    initPreview();
  }
  if (previewDebounce) clearTimeout(previewDebounce);
  previewDebounce = setTimeout(() => updatePreviewFromForm({ applyAutoMinimum: false }), 200);
}

// Wire all form inputs to update badges and preview (EXACT copy from edit.js)
function wireFormListeners() {
  // Wire sliders to update badges immediately
  for (const s of SHAPES) {
    const countSlider = document.getElementById(s.countId);
    const sizeSlider = document.getElementById(s.sizeId);
    const countBadge = document.getElementById(s.countValId);
    const sizeBadge = document.getElementById(s.sizeValId);
    
    // Count slider - update badge on every change
    if (countSlider && countBadge) {
      const updateCount = function() {
        const val = parseInt(this.value, 10) || 0;
        countBadge.textContent = String(val);
        updateBadges();
        schedulePreviewUpdate();
      };
      countSlider.addEventListener("input", updateCount);
      countSlider.addEventListener("change", updateCount);
      // Also trigger on mousemove for better responsiveness
      countSlider.addEventListener("mousemove", function(e) {
        if (e.buttons === 1) updateCount.call(this);
      });
    }
    
    // Size slider - update badge on every change
    if (sizeSlider && sizeBadge) {
      const updateSize = function() {
        const val = parseFloat(this.value) || 0;
        sizeBadge.textContent = Number.isFinite(val) ? val.toFixed(1) : "0.0";
        updateBadges();
        schedulePreviewUpdate();
      };
      sizeSlider.addEventListener("input", updateSize);
      sizeSlider.addEventListener("change", updateSize);
      // Also trigger on mousemove for better responsiveness
      sizeSlider.addEventListener("mousemove", function(e) {
        if (e.buttons === 1) updateSize.call(this);
      });
    }
    
    // Color picker
    const colorEl = document.getElementById(s.colorId);
    if (colorEl) {
      colorEl.addEventListener("input", schedulePreviewUpdate);
      colorEl.addEventListener("change", schedulePreviewUpdate);
    }
    
    // Texture URL input
    const texEl = document.getElementById(s.texId);
    if (texEl) {
      texEl.addEventListener("input", schedulePreviewUpdate);
      texEl.addEventListener("change", schedulePreviewUpdate);
    }
  }
  
  // Background color
  if (bgColorEl) {
    bgColorEl.addEventListener("input", schedulePreviewUpdate);
    bgColorEl.addEventListener("change", schedulePreviewUpdate);
  }
  
  // Background image URL
  if (bgImageUrlEl) {
    bgImageUrlEl.addEventListener("input", schedulePreviewUpdate);
    bgImageUrlEl.addEventListener("change", schedulePreviewUpdate);
  }
}

// Wire listeners when DOM is ready (EXACT copy from edit.js)
function initFormListeners() {
  wireFormListeners();
  // Force initial badge update
  updateBadges();
  // Try to send initial preview (will retry if preview not ready)
  setTimeout(() => {
    updatePreviewFromForm({ applyAutoMinimum: false });
  }, 500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFormListeners);
} else {
  initFormListeners();
}

// -------------------------
// Slug availability checking
// -------------------------
let slugCheckTimeout = null;
let lastCheckedSlug = "";
let isSlugAvailable = true;

// Create feedback element for slug availability
function ensureSlugFeedback() {
  if (document.getElementById("slugFeedback")) return;
  if (!slugEl) return;

  const feedback = document.createElement("div");
  feedback.id = "slugFeedback";
  feedback.className = "small mt-1";
  feedback.style.minHeight = "20px";

  // Insert after the form-text div
  const formText = slugEl.parentElement.querySelector(".form-text");
  if (formText) {
    formText.after(feedback);
  } else {
    slugEl.parentElement.appendChild(feedback);
  }
}

ensureSlugFeedback();

async function checkSlugAvailability(slug) {
  const slugFeedback = document.getElementById("slugFeedback");

  if (!slug || !slugFeedback) {
    if (slugFeedback) slugFeedback.innerHTML = "";
    isSlugAvailable = true;
    return;
  }

  // Don't check the same slug twice in a row
  if (slug === lastCheckedSlug) return;
  lastCheckedSlug = slug;

  slugFeedback.innerHTML = '<span class="text-secondary">⟳ Checking availability...</span>';

  try {
    const res = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });

    if (res.status === 404) {
      // Slug is available (piece not found)
      isSlugAvailable = true;
      slugFeedback.innerHTML = '<span class="text-success fw-semibold">✓ Available</span>';
    } else if (res.ok) {
      // Slug is taken (piece exists)
      isSlugAvailable = false;
      slugFeedback.innerHTML = '<span class="text-danger fw-semibold">✗ Already taken - please choose a different slug</span>';
    } else {
      // Unknown error (connection issue, server error, etc.)
      slugFeedback.innerHTML = '<span class="text-warning">⚠ Could not verify availability</span>';
      isSlugAvailable = true; // Allow submission anyway
    }
  } catch (err) {
    slugFeedback.innerHTML = '<span class="text-warning">⚠ Network error - could not check availability</span>';
    isSlugAvailable = true; // Allow submission anyway
  }
}

function debouncedSlugCheck() {
  if (slugCheckTimeout) clearTimeout(slugCheckTimeout);

  const slug = normalizeSlug(slugEl?.value || "");

  if (!slug) {
    const slugFeedback = document.getElementById("slugFeedback");
    if (slugFeedback) slugFeedback.innerHTML = "";
    isSlugAvailable = true;
    lastCheckedSlug = "";
    return;
  }

  slugCheckTimeout = setTimeout(() => {
    checkSlugAvailability(slug);
  }, 500); // 500ms debounce - waits for user to stop typing
}

// Normalize slug on blur + check availability
slugEl?.addEventListener("blur", () => {
  const normalized = normalizeSlug(slugEl.value);
  slugEl.value = normalized;

  if (normalized) {
    // Immediately check availability when user leaves the field
    checkSlugAvailability(normalized);
  } else {
    // Clear feedback if slug is empty
    const slugFeedback = document.getElementById("slugFeedback");
    if (slugFeedback) slugFeedback.innerHTML = "";
    isSlugAvailable = true;
    lastCheckedSlug = "";
  }
});

// Check availability while typing (debounced)
slugEl?.addEventListener("input", debouncedSlugCheck);

// -------------------------
// Reset button
// -------------------------
resetBtn?.addEventListener("click", () => {
  form?.reset();

  if (bgColorEl) bgColorEl.value = "#000000";

  for (const s of SHAPES) {
    const c = document.getElementById(s.countId);
    const z = document.getElementById(s.sizeId);
    const col = document.getElementById(s.colorId);
    const tex = document.getElementById(s.texId);

    if (c) c.value = "0";
    if (z) z.value = "1";
    if (col) col.value = "#ffffff";
    if (tex) tex.value = "";
  }

  if (bgImageUrlEl) bgImageUrlEl.value = "";
  if (slugEl) slugEl.value = "";
  if (emailEl) emailEl.value = "";

  // Clear slug availability feedback
  const slugFeedback = document.getElementById("slugFeedback");
  if (slugFeedback) slugFeedback.innerHTML = "";
  isSlugAvailable = true;
  lastCheckedSlug = "";
  if (slugCheckTimeout) clearTimeout(slugCheckTimeout);

  clearMsg();

  if (resultPanel) resultPanel.classList.add("d-none");
  if (linksRow) linksRow.innerHTML = "";

  const adminKeyPlain = document.getElementById("adminKeyPlain");
  const embedSlugCode = document.getElementById("embedSlugCode");
  const embedIdCode = document.getElementById("embedIdCode");

  if (adminKeyPlain) adminKeyPlain.textContent = "";
  if (embedSlugCode) embedSlugCode.value = "";
  if (embedIdCode) embedIdCode.value = "";

  const openEmbedSlugBtn = document.getElementById("openEmbedSlugBtn");
  const openEmbedIdBtn = document.getElementById("openEmbedIdBtn");
  openEmbedSlugBtn?.removeAttribute("href");
  openEmbedIdBtn?.removeAttribute("href");

  updateBadges();
  updatePreviewFromForm({ applyAutoMinimum: false });
});

// -------------------------
// Output rendering
// -------------------------
function buildIframe(srcUrl) {
  return `<iframe src="${srcUrl}" width="100%" height="600" style="border:0;border-radius:12px;overflow:hidden" loading="lazy" allowfullscreen></iframe>`;
}

function renderOutput({ id, slug, adminKey, fallbackSlug }) {
  const base = location.origin + BASE_PATH;

  // Prefer server-returned slug, else fallback to requested slug
  const finalSlug = (slug || fallbackSlug || "").trim();

  const slugUrl = finalSlug ? `${base}/embed.html?id=${encodeURIComponent(finalSlug)}` : "";
  const idUrl = `${base}/embed.html?id=${encodeURIComponent(String(id))}`;

  const viewerSlugUrl = finalSlug ? `${base}/view.html?id=${encodeURIComponent(finalSlug)}` : "";
  const viewerIdUrl = `${base}/view.html?id=${encodeURIComponent(String(id))}`;

  // Make admin key visibly readable
  const adminKeyPlain = document.getElementById("adminKeyPlain");
  if (adminKeyPlain) {
    adminKeyPlain.textContent = adminKey || "(missing admin key)";
  }

  // Embed codes
  const embedSlugCode = document.getElementById("embedSlugCode");
  const embedIdCode = document.getElementById("embedIdCode");
  if (embedSlugCode) embedSlugCode.value = finalSlug ? buildIframe(slugUrl) : "(no slug available)";
  if (embedIdCode) embedIdCode.value = buildIframe(idUrl);

  // Open buttons (embed)
  const openEmbedSlugBtn = document.getElementById("openEmbedSlugBtn");
  const openEmbedIdBtn = document.getElementById("openEmbedIdBtn");
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

  // Quick links row
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
  const copyAdminKeyBtn = document.getElementById("copyAdminKeyBtn");
  const copyEmbedSlugBtn = document.getElementById("copyEmbedSlugBtn");
  const copyEmbedIdBtn = document.getElementById("copyEmbedIdBtn");

  if (copyAdminKeyBtn) {
    copyAdminKeyBtn.onclick = async () => {
      const text = adminKey || "";
      if (!text) return;
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
    };
  }

  if (copyEmbedSlugBtn) {
    copyEmbedSlugBtn.onclick = async () => {
      const text = embedSlugCode?.value || "";
      if (!text) return;
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
    };
  }

  if (copyEmbedIdBtn) {
    copyEmbedIdBtn.onclick = async () => {
      const text = embedIdCode?.value || "";
      if (!text) return;
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
    };
  }
}

// -------------------------
// Submit handler
// -------------------------
if (!form) {
  setMsg('builderForm not found. Ensure your <form> has id="builderForm".', "danger");
} else {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    if (resultPanel) resultPanel.classList.add("d-none");
    if (linksRow) linksRow.innerHTML = "";

    const adminKeyPlain = document.getElementById("adminKeyPlain");
    const embedSlugCode = document.getElementById("embedSlugCode");
    const embedIdCode = document.getElementById("embedIdCode");

    if (adminKeyPlain) adminKeyPlain.textContent = "";
    if (embedSlugCode) embedSlugCode.value = "";
    if (embedIdCode) embedIdCode.value = "";

    const openEmbedSlugBtn = document.getElementById("openEmbedSlugBtn");
    const openEmbedIdBtn = document.getElementById("openEmbedIdBtn");
    openEmbedSlugBtn?.removeAttribute("href");
    openEmbedIdBtn?.removeAttribute("href");

    // slug (optional)
    const slugRaw = getVal("slug");
    const slugNormalized = normalizeSlug(slugRaw);

    // Prevent submission if user provided a slug that is already taken
    if (slugNormalized && !isSlugAvailable) {
      setMsg("⚠️ The slug you entered is already taken. Please choose a different slug or leave it blank to auto-generate.", "warning");
      if (slugEl) {
        slugEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        slugEl.focus();
        slugEl.select();
      }
      return;
    }

    // email (required)
    const email = getVal("email");
    if (!email || email.length === 0) {
      setMsg("⚠️ Email address is required.", "warning");
      if (emailEl) {
        emailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        emailEl.focus();
      }
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMsg("⚠️ Please enter a valid email address.", "warning");
      if (emailEl) {
        emailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        emailEl.focus();
      }
      return;
    }

    const configResult = buildConfigFromForm({ applyAutoMinimum: true });
    if (configResult.error) {
      const isLimitError = configResult.error.includes("Total instances");
      setMsg(configResult.error, isLimitError ? "danger" : "warning");
      sendPreviewConfig(null, configResult.error);
      return;
    }

    updatePreviewFromForm({ applyAutoMinimum: true });

    const payload = {
      slug: slugNormalized || "",
      email: email,
      visibility: "public",
      config: configResult.config
    };

    if (generateBtn) generateBtn.disabled = true;
    setMsg("Creating…", "warning");

    try {
      let recaptchaToken = "";
      try {
        recaptchaToken = await getRecaptchaToken(RECAPTCHA.ACTION_CREATE);
      } catch (err) {
        setMsg(err?.message || "reCAPTCHA failed to load. Please refresh and try again.", "danger");
        if (generateBtn) generateBtn.disabled = false;
        return;
      }

      const res = await fetch(API_ENDPOINTS.PIECES, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Recaptcha-Token": recaptchaToken
        },
        body: JSON.stringify(payload)
      });

      // If server returns non-JSON, capture text for debugging
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "Server returned non-JSON response", raw: text.slice(0, 300) };
      }

      if (!res.ok) {
        // Special handling for slug conflicts (409)
        if (res.status === 409 && data.error && data.error.includes("Slug")) {
          setMsg(`⚠️ ${data.error} Your form data has been preserved - just change the slug above and try again.`, "warning");
          if (slugEl) {
            slugEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            slugEl.focus();
            slugEl.select();
          }
        } else {
          setMsg(data.error || `Create failed (${res.status})`, "danger");
        }
        if (generateBtn) generateBtn.disabled = false;
        return;
      }

      // Validate expected fields
      const createdId = data?.id;
      const createdSlug = (data?.slug || "").toString().trim();
      const createdKey = (data?.adminKey || "").toString().trim();

      if (!createdId) {
        setMsg("Create succeeded, but response is missing an id. Check /api/pieces response.", "danger");
        if (generateBtn) generateBtn.disabled = false;
        return;
      }

      // Build configuration summary for backup
      let configSummary = "📋 CONFIGURATION BACKUP (copy for your records):\n\n";
      configSummary += "BACKGROUND\n";
      configSummary += `• Color: ${payload.config.bg}\n`;
      configSummary += `• Image URL: ${payload.config.bgImageUrl || '(none)'}\n\n`;
      configSummary += "SHAPES\n";
      payload.config.shapes.forEach((shape) => {
        configSummary += `• ${shape.type.toUpperCase()}\n`;
        configSummary += `  - Number of shapes: ${shape.count}\n`;
        configSummary += `  - Size: ${shape.size}\n`;
        configSummary += `  - Base color: ${shape.palette.baseColor}\n`;
        configSummary += `  - Texture URL: ${shape.textureUrl || '(none)'}\n`;
      });

      setMsg(`Created successfully. <details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">View Configuration Backup</summary><pre style="margin-top:8px;background:rgba(0,0,0,0.35);padding:12px;border-radius:8px;white-space:pre-wrap;font-size:0.85em;">${configSummary}</pre></details>`, "success");
      if (resultPanel) resultPanel.classList.remove("d-none");

      renderOutput({
        id: createdId,
        slug: createdSlug,
        adminKey: createdKey,
        fallbackSlug: slugNormalized
      });

    } catch (err) {
      setMsg(err?.message || "Create failed", "danger");
    } finally {
      if (generateBtn) generateBtn.disabled = false;
    }
  });
}
