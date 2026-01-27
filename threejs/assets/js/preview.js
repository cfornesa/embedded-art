import { createViewer } from "./viewer-core.js";

const wrap = document.querySelector("#wrap");
const msg = document.querySelector("#msg");

const viewer = createViewer({ wrap, msg });
viewer.setMessage("Waiting for preview data...");

const previewChannel = ("BroadcastChannel" in window) ? new BroadcastChannel("eap-threejs-preview") : null;

function applyPayload(payload) {
  if (!payload || payload.type !== "preview:config") return;

  if (payload.message) {
    viewer.setMessage(payload.message);
  } else {
    viewer.clearMessage();
  }

  if (payload.config) {
    viewer.renderConfig(payload.config).catch(err => {
      viewer.setMessage(`Error rendering: ${err.message}`);
    });
  } else if (!payload.message) {
    viewer.setMessage("No configuration provided.");
  }
}

// Listen for messages from parent window
window.addEventListener("message", (event) => {
  applyPayload(event.data || {});
});

// Listen for BroadcastChannel updates
if (previewChannel) {
  previewChannel.addEventListener("message", (event) => {
    applyPayload(event.data || {});
  });
}

// Listen for storage updates (fallback for cross-window sync)
window.addEventListener("storage", (event) => {
  if (event.key !== "eap-threejs-preview") return;
  if (!event.newValue) return;
  try {
    const payload = JSON.parse(event.newValue);
    applyPayload(payload);
  } catch (err) {
    // Ignore malformed JSON
  }
});

// Apply last stored config immediately if available
try {
  const cached = localStorage.getItem("eap-threejs-preview");
  if (cached) {
    const payload = JSON.parse(cached);
    applyPayload(payload);
  }
} catch (err) {
  // Ignore storage errors
}

// Notify parent that we're ready
function notifyReady() {
  try {
    // Try multiple times with different origins
    window.parent.postMessage({ type: "preview:ready" }, "*");
    // Also try with specific origin if we can determine it
    try {
      if (window.parent.location) {
        window.parent.postMessage({ type: "preview:ready" }, window.parent.location.origin);
      }
    } catch (e) {
      // Cross-origin, can't access - that's fine, wildcard should work
    }
  } catch (err) {
    // Ignore errors
  }
}

// Send ready notification multiple times to ensure parent receives it
function initPreview() {
  notifyReady();
  setTimeout(notifyReady, 50);
  setTimeout(notifyReady, 200);
  setTimeout(notifyReady, 500);
}

// Send ready notification when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPreview);
} else {
  initPreview();
}
