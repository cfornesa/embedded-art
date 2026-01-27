// assets/js/edit.js

import { LIMITS, SHAPES, API_ENDPOINTS, ALLOWED_IMAGE_EXTENSIONS } from './constants.js';
import { createViewer } from './viewer-core.js';

// -------------------------
// DOM helpers
// -------------------------
const $ = (sel) => document.querySelector(sel);

// Auth section
const authSection = $("#authSection");
const authForm = $("#authForm");
const authMsg = $("#authMsg");
const pieceRefEl = $("#pieceRef");
const adminKeyEl = $("#adminKey");
const loadBtn = $("#loadBtn");

// Editor section
const editorSection = $("#editorSection");
const editorForm = $("#editorForm");
const editorMsg = $("#editorMsg");
const pieceInfo = $("#pieceInfo");
const saveBtn = $("#saveBtn");
const resetBtn = $("#resetBtn");
const cancelEditBtn = $("#cancelEditBtn");

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
        updatePreviewFromForm();
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

// Form fields
const bgColorEl = $("#bgColor");
const bgImageUrlEl = $("#bgImageUrl");
const totalBadge = $("#totalBadge");

// -------------------------
// State
// -------------------------
let currentPieceRef = "";
let currentAdminKey = "";
let originalData = null; // Store original piece data for reset
let saveInProgress = false; // Track if a save is currently in progress

// -------------------------
// Messaging
// -------------------------
function setAuthMsg(text, kind = "info") {
  if (!authMsg) return;
  authMsg.classList.remove("d-none", "alert-info", "alert-success", "alert-danger", "alert-warning");
  authMsg.classList.add(`alert-${kind}`);
  authMsg.textContent = text;
  authMsg.classList.remove("d-none");
}

function clearAuthMsg() {
  if (!authMsg) return;
  authMsg.classList.add("d-none");
  authMsg.textContent = "";
}

function setEditorMsg(text, kind = "info") {
  if (!editorMsg) return;
  editorMsg.classList.remove("d-none", "alert-info", "alert-success", "alert-danger", "alert-warning");
  editorMsg.classList.add(`alert-${kind}`);
  editorMsg.textContent = text;
  editorMsg.classList.remove("d-none");
}

function clearEditorMsg() {
  if (!editorMsg) return;
  editorMsg.classList.add("d-none");
  editorMsg.textContent = "";
}

// -------------------------
// Validation helpers
// -------------------------
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

function buildConfigFromForm() {
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
// Badge updates
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
// Live preview updates
// -------------------------
let previewDebounce = null;

function updatePreviewFromForm() {
  // Ensure preview is initialized
  if (!previewViewer) {
    initPreview();
    if (!previewViewer) return;
  }
  
  const result = buildConfigFromForm();

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
  previewDebounce = setTimeout(() => updatePreviewFromForm(), 200);
}

// Wire all form inputs to update badges and preview
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

// Wire listeners when DOM is ready
function initFormListeners() {
  wireFormListeners();
  // Force initial badge update
  updateBadges();
  // Try to send initial preview (will retry if preview not ready)
  setTimeout(() => {
    updatePreviewFromForm();
  }, 500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFormListeners);
} else {
  initFormListeners();
}

// -------------------------
// Populate form with piece data
// -------------------------
function populateForm(pieceData) {
  if (!pieceData || !pieceData.config) return;

  const config = pieceData.config;

  // Background
  if (bgColorEl && config.bg) bgColorEl.value = config.bg;
  if (bgImageUrlEl) bgImageUrlEl.value = config.bgImageUrl || "";

  // Shapes
  if (config.shapes && Array.isArray(config.shapes)) {
    for (const shapeData of config.shapes) {
      const shapeType = shapeData.type;
      const shapeDef = SHAPES.find(s => s.type === shapeType);
      if (!shapeDef) continue;

      // Set count
      const countEl = $(`#${shapeDef.countId}`);
      if (countEl) countEl.value = String(shapeData.count || 0);

      // Set size
      const sizeEl = $(`#${shapeDef.sizeId}`);
      if (sizeEl) sizeEl.value = String(shapeData.size || 1);

      // Set color
      const colorEl = $(`#${shapeDef.colorId}`);
      if (colorEl && shapeData.palette && shapeData.palette.baseColor) {
        colorEl.value = shapeData.palette.baseColor;
      }

      // Set texture
      const texEl = $(`#${shapeDef.texId}`);
      if (texEl) texEl.value = shapeData.textureUrl || "";
    }
  }

  updateBadges();
  updatePreviewFromForm();
}

// -------------------------
// Auth form handler
// -------------------------
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthMsg();

    const ref = pieceRefEl?.value.trim() || "";
    const key = adminKeyEl?.value.trim() || "";

    if (!ref || !key) {
      setAuthMsg("Please enter both piece ID/slug and admin key.", "warning");
      return;
    }

    if (loadBtn) loadBtn.disabled = true;
    setAuthMsg("Loading piece...", "info");

    try {
      const res = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(ref)}`, {
        cache: "no-store",
        headers: {
          "X-Admin-Key": key
        }
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setAuthMsg("Invalid admin key. Please check and try again.", "danger");
        } else if (res.status === 404) {
          setAuthMsg("Piece not found. Please check the ID/slug and try again.", "danger");
        } else {
          setAuthMsg(data.error || `Load failed (${res.status})`, "danger");
        }
        return;
      }

      // Success - store data and switch to editor
      currentPieceRef = ref;
      currentAdminKey = key;
      originalData = data;

      // Update piece info display
      if (pieceInfo) {
        const displayRef = data.slug ? `${data.slug} (ID: ${data.id})` : `ID: ${data.id}`;
        pieceInfo.textContent = displayRef;
      }

      // Populate form with data
      populateForm(data);

      // Show editor, hide auth
      if (authSection) authSection.classList.add("d-none");
      if (editorSection) editorSection.classList.remove("d-none");
      clearAuthMsg();

    } catch (err) {
      setAuthMsg(err?.message || "Load failed", "danger");
    } finally {
      if (loadBtn) loadBtn.disabled = false;
    }
  });
}

// -------------------------
// Cancel edit button
// -------------------------
if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    // Clear state
    currentPieceRef = "";
    currentAdminKey = "";
    originalData = null;

    // Reset auth form
    if (pieceRefEl) pieceRefEl.value = "";
    if (adminKeyEl) adminKeyEl.value = "";

    // Show auth, hide editor
    if (authSection) authSection.classList.remove("d-none");
    if (editorSection) editorSection.classList.add("d-none");

    clearAuthMsg();
    clearEditorMsg();
  });
}

// -------------------------
// Reset button (revert to original)
// -------------------------
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (!originalData) {
      setEditorMsg("No original data available to reset.", "warning");
      return;
    }

    populateForm(originalData);
    setEditorMsg("Form reset to original values.", "info");
    setTimeout(() => clearEditorMsg(), 3000);
  });
}

// -------------------------
// Save form handler
// -------------------------
if (editorForm) {
  editorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearEditorMsg();

    if (!currentPieceRef || !currentAdminKey) {
      setEditorMsg("Missing piece reference or admin key.", "danger");
      return;
    }

    const configResult = buildConfigFromForm();
    if (configResult.error) {
      const isLimitError = configResult.error.includes("Total instances");
      setEditorMsg(configResult.error, isLimitError ? "danger" : "warning");
      queuePreviewPayload({
        type: "preview:config",
        message: configResult.error,
        config: null
      });
      return;
    }

    updatePreviewFromForm();

    const payload = {
      config: configResult.config
    };

    if (saveInProgress) {
      setEditorMsg("Another save is already in progress. Please wait.", "warning");
      return;
    }

    saveInProgress = true;
    if (saveBtn) saveBtn.disabled = true;
    setEditorMsg("Saving changes...", "info");

    try {
      const res = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(currentPieceRef)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": currentAdminKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setEditorMsg("Invalid admin key. Changes not saved.", "danger");
        } else {
          setEditorMsg(data.error || `Save failed (${res.status})`, "danger");
        }
        saveInProgress = false;
        if (saveBtn) saveBtn.disabled = false;
        return;
      }

      // Success - update original data with new data
      originalData = data;

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

      setEditorMsg(`✓ Changes saved successfully! <details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">View Configuration Backup</summary><pre style="margin-top:8px;background:rgba(0,0,0,0.35);padding:12px;border-radius:8px;white-space:pre-wrap;font-size:0.85em;">${configSummary}</pre></details>`, "success");

      // Auto-clear success message after 15 seconds (longer due to config details)
      setTimeout(() => clearEditorMsg(), 15000);

    } catch (err) {
      setEditorMsg(err?.message || "Save failed", "danger");
    } finally {
      saveInProgress = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}
