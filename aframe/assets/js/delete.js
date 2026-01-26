// assets/js/delete.js

import { API_ENDPOINTS } from './constants.js';

const pieceRefEl = document.querySelector("#pieceRef");
const adminKeyEl = document.querySelector("#adminKey");
const confirmEl = document.querySelector("#confirmText");
const form = document.querySelector("#deleteForm");

const msgBox = document.querySelector("#msgBox");
const lookupBtn = document.querySelector("#lookupBtn");
const lookupPanel = document.querySelector("#lookupPanel");
const lookupJson = document.querySelector("#lookupJson");

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

function getQueryId() {
  const params = new URLSearchParams(location.search);
  return params.get("id");
}

const prefill = getQueryId();
if (prefill) pieceRefEl.value = prefill;

async function lookup(ref) {
  clearMsg();
  lookupPanel.classList.add("d-none");
  lookupJson.textContent = "";

  const res = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(ref)}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    setMsg(`Lookup failed (${res.status}). ${text ? "Response: " + text : ""}`, "warning");
    return;
  }
  const data = await res.json().catch(() => null);
  lookupJson.textContent = JSON.stringify(data, null, 2);
  lookupPanel.classList.remove("d-none");
}

lookupBtn.addEventListener("click", async () => {
  const ref = (pieceRefEl.value || "").trim();
  if (!ref) return setMsg("Enter a Piece ID or slug first.", "warning");
  await lookup(ref);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const ref = (pieceRefEl.value || "").trim();
  const adminKey = (adminKeyEl.value || "").trim();
  const confirmText = (confirmEl.value || "").trim();

  if (!ref) return setMsg("Piece ID/slug is required.", "warning");
  if (!adminKey) return setMsg("Admin key is required.", "warning");
  if (confirmText !== "DELETE") return setMsg('Type "DELETE" exactly to confirm.', "warning");

  setMsg("Fetching piece data before deletion...", "info");

  // First, fetch the piece to get configuration backup BEFORE deletion
  let pieceData = null;
  try {
    const lookupRes = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(ref)}`, {
      headers: { "X-Admin-Key": adminKey }
    });
    if (lookupRes.ok) {
      pieceData = await lookupRes.json().catch(() => null);
    }
  } catch (err) {
    // Continue with deletion even if lookup fails
  }

  setMsg("Deleting...", "warning");

  const res = await fetch(`${API_ENDPOINTS.PIECES}/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": adminKey }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(data.error || `Delete failed (${res.status})`, "danger");
    return;
  }

  lookupPanel.classList.add("d-none");

  // Build configuration summary for backup (if we got the data)
  let successMsg = "OK Piece permanently deleted. All data has been removed from the database. The slug is now available for reuse.";

  if (pieceData && pieceData.config) {
    const cfg = pieceData.config;
    let configSummary = "CONFIG DELETED PIECE BACKUP (copy for your records):\n\n";
    configSummary += `PIECE INFO\n`;
    configSummary += `- ID: ${pieceData.id || 'N/A'}\n`;
    configSummary += `- Slug: ${pieceData.slug || 'N/A'}\n\n`;
    configSummary += "BACKGROUND\n";
    configSummary += `- Color: ${cfg.bg || '#000000'}\n`;
    configSummary += `- Image URL: ${cfg.bgImageUrl || '(none)'}\n\n`;
    configSummary += "SHAPES\n";
    if (cfg.shapes && Array.isArray(cfg.shapes)) {
      cfg.shapes.forEach((shape) => {
        configSummary += `- ${shape.type ? shape.type.toUpperCase() : 'UNKNOWN'}\n`;
        configSummary += `  - Number of shapes: ${shape.count || 0}\n`;
        configSummary += `  - Size: ${shape.size || 1}\n`;
        configSummary += `  - Base color: ${shape.palette?.baseColor || '#ffffff'}\n`;
        configSummary += `  - Texture URL: ${shape.textureUrl || '(none)'}\n`;
      });
    }

    successMsg += ` <details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">View Deleted Piece Backup</summary><pre style="margin-top:8px;background:rgba(0,0,0,0.35);padding:12px;border-radius:8px;white-space:pre-wrap;font-size:0.85em;">${configSummary}</pre></details>`;
  }

  setMsg(successMsg, "success");
});
