// assets/js/delete.js

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

  const res = await fetch(`/api/pieces/${encodeURIComponent(ref)}`, { cache: "no-store" });
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

  setMsg("Deleting…", "warning");

  const res = await fetch(`/api/pieces/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": adminKey }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(data.error || `Delete failed (${res.status})`, "danger");
    return;
  }

  lookupPanel.classList.add("d-none");
  setMsg("✓ Piece permanently deleted. All data has been removed from the database. The slug is now available for reuse.", "success");
});
