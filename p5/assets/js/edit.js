// assets/js/edit.js

import { LIMITS, SHAPES, API_ENDPOINTS, ALLOWED_IMAGE_EXTENSIONS } from './constants.js';

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

function getBool(id) {
  const el = $(`#${id}`);
  return Boolean(el?.checked);
}

// -------------------------
// Badge updates
// -------------------------
function updateBadges() {
  let total = 0;

  for (const s of SHAPES) {
    const count = getInt(s.countId);
    const size = getFloat(s.sizeId);
    const strokeWeight = s.strokeWeightId ? getFloat(s.strokeWeightId) : null;

    const countVal = $(`#${s.countValId}`);
    const sizeVal = $(`#${s.sizeValId}`);
    const strokeWeightVal = s.strokeWeightValId ? $(`#${s.strokeWeightValId}`) : null;

    if (countVal) countVal.textContent = String(count);
    if (sizeVal) sizeVal.textContent = Number.isFinite(size) ? String(Math.round(size)) : "0";
    if (strokeWeightVal && Number.isFinite(strokeWeight)) {
      strokeWeightVal.textContent = String(Math.round(strokeWeight));
    }

    total += count;
  }

  if (totalBadge) {
    totalBadge.textContent = String(total);
    if (total > LIMITS.TOTAL_INSTANCES_MAX) totalBadge.classList.add("text-danger");
    else totalBadge.classList.remove("text-danger");
  }
}

// Wire range listeners
for (const s of SHAPES) {
  const c = $(`#${s.countId}`);
  const z = $(`#${s.sizeId}`);
  const w = s.strokeWeightId ? $(`#${s.strokeWeightId}`) : null;
  c?.addEventListener("input", updateBadges);
  z?.addEventListener("input", updateBadges);
  w?.addEventListener("input", updateBadges);
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
      const shapeType = String(shapeData.type || '').toLowerCase();
      const shapeDef = SHAPES.find(s => s.type === shapeType);
      if (!shapeDef) continue;

      // Set count
      const countEl = $(`#${shapeDef.countId}`);
      if (countEl) countEl.value = String(shapeData.count || 0);

      // Set size
      const sizeEl = $(`#${shapeDef.sizeId}`);
      if (sizeEl) sizeEl.value = String(shapeData.size || 1);

      // Set fill
      const fillToggle = shapeDef.fillToggleId ? $(`#${shapeDef.fillToggleId}`) : null;
      const fillEl = shapeDef.fillId ? $(`#${shapeDef.fillId}`) : null;
      if (fillToggle) {
        fillToggle.checked = shapeData?.fill?.enabled ?? Boolean(shapeData?.palette?.baseColor);
      }
      if (fillEl) {
        fillEl.value = shapeData?.fill?.color || shapeData?.palette?.baseColor || "#ffffff";
      }

      // Set stroke
      const strokeToggle = shapeDef.strokeToggleId ? $(`#${shapeDef.strokeToggleId}`) : null;
      const strokeEl = shapeDef.strokeId ? $(`#${shapeDef.strokeId}`) : null;
      if (strokeToggle) {
        strokeToggle.checked = shapeData?.stroke?.enabled ?? false;
      }
      if (strokeEl) {
        strokeEl.value = shapeData?.stroke?.color || "#000000";
      }
      const strokeWeightEl = shapeDef.strokeWeightId ? $(`#${shapeDef.strokeWeightId}`) : null;
      if (strokeWeightEl && Number.isFinite(shapeData?.stroke?.weight)) {
        strokeWeightEl.value = String(shapeData.stroke.weight);
      }
    }
  }

  updateBadges();
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

    // Validate background color
    const bg = getVal("bgColor");
    if (!isHexColor(bg)) {
      setEditorMsg("Background color must be a valid hex color.", "warning");
      return;
    }

    // Validate background image URL
    const bgImageUrl = getVal("bgImageUrl");
    const bgErr = validateImageUrl(bgImageUrl);
    if (bgErr) {
      setEditorMsg(`Background image URL: ${bgErr}`, "warning");
      return;
    }

    // Build shapes array
    let total = 0;
    const shapes = SHAPES.map((s) => {
      const count = Math.max(LIMITS.SHAPE_COUNT_MIN, Math.min(LIMITS.SHAPE_COUNT_MAX, getInt(s.countId)));
      const sizeMin = Number.isFinite(s.sizeMin) ? s.sizeMin : LIMITS.SIZE_MIN;
      const sizeMax = Number.isFinite(s.sizeMax) ? s.sizeMax : LIMITS.SIZE_MAX;
      const size = Math.max(sizeMin, Math.min(sizeMax, getFloat(s.sizeId)));

      const fillEnabled = s.supportsFill ? getBool(s.fillToggleId) : false;
      const fillColor = s.supportsFill ? getVal(s.fillId) : "#ffffff";
      const strokeEnabled = s.supportsStroke ? getBool(s.strokeToggleId) : true;
      const strokeColor = s.supportsStroke ? getVal(s.strokeId) : "#000000";
      const strokeWeight = s.strokeWeightId
        ? Math.max(LIMITS.STROKE_WEIGHT_MIN, Math.min(LIMITS.STROKE_WEIGHT_MAX, getFloat(s.strokeWeightId)))
        : null;

      total += count;

      return {
        type: s.type,
        count,
        size,
        fill: {
          enabled: Boolean(fillEnabled),
          color: isHexColor(fillColor) ? fillColor : "#ffffff"
        },
        stroke: {
          enabled: Boolean(strokeEnabled),
          color: isHexColor(strokeColor) ? strokeColor : "#000000",
          weight: Number.isFinite(strokeWeight) ? strokeWeight : null
        }
      };
    });

    if (total > LIMITS.TOTAL_INSTANCES_MAX) {
      setEditorMsg(`Total instances across all shapes must be ${LIMITS.TOTAL_INSTANCES_MAX} or less.`, "danger");
      return;
    }

    const payload = {
      config: {
        version: 3,
        bg,
        bgImageUrl: bgImageUrl || "",
        shapes
      }
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
        configSummary += `  - Size/Length: ${shape.size}\n`;
        configSummary += `  - Fill: ${shape.fill?.enabled ? shape.fill.color : '(none)'}\n`;
        if (shape.stroke?.enabled) {
          configSummary += `  - Stroke: ${shape.stroke.color} (weight ${shape.stroke.weight ?? 1})\n`;
        } else {
          configSummary += `  - Stroke: (none)\n`;
        }
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
