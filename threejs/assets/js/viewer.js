import { basePath } from "./constants.js";
import { createViewer } from "./viewer-core.js";

const wrap = document.querySelector("#wrap");
const msg = document.querySelector("#msg");

const viewer = createViewer({ wrap, msg });
viewer.setMessage("Loading viewer...");

const params = new URLSearchParams(location.search);
const ref = params.get("id"); // numeric id OR slug
if (!ref) {
  viewer.setMessage("Missing ?id=");
  throw new Error("Missing id");
}

async function fetchPiece(ref) {
  const url = `${basePath("/api/pieces")}/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Not available (${res.status}). ${txt ? txt.slice(0, 160) : ""}`.trim());
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    const snippet = (txt || "").slice(0, 200);
    throw new Error(
      `API did not return JSON from ${url}.\n` +
      `Content-Type: ${ct || "(missing)"}\n` +
      `First bytes: ${snippet || "(empty response)"}`
    );
  }

  return await res.json();
}

fetchPiece(ref)
  .then((piece) => viewer.renderPiece(piece))
  .catch((err) => {
    viewer.setMessage(
      `Error loading piece.\n\n${err?.message || String(err)}\n\nIf you see “// assets/…”, your /api route is not returning JSON. Confirm the API is running and reachable at /api/pieces/{id}.`
    );
  });
