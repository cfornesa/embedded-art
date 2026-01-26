// assets/js/recaptcha.js

import { API_ENDPOINTS } from './constants.js';

let siteKeyPromise = null;
let readyPromise = null;

async function fetchSiteKey() {
  if (siteKeyPromise) return siteKeyPromise;
  siteKeyPromise = (async () => {
    const res = await fetch(API_ENDPOINTS.RECAPTCHA_SITE_KEY, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "reCAPTCHA site key unavailable");
    }
    const data = await res.json().catch(() => ({}));
    const key = (data.siteKey || "").toString().trim();
    if (!key) throw new Error("reCAPTCHA site key missing");
    return key;
  })();
  return siteKeyPromise;
}

function loadScript(siteKey) {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
      return;
    }

    const existing = document.querySelector("script[data-recaptcha-v3]");
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
          window.grecaptcha.ready(() => resolve(window.grecaptcha));
        } else {
          reject(new Error("reCAPTCHA failed to initialize"));
        }
      });
      existing.addEventListener("error", () => reject(new Error("reCAPTCHA failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaV3 = "1";
    script.onload = () => {
      if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
        window.grecaptcha.ready(() => resolve(window.grecaptcha));
      } else {
        reject(new Error("reCAPTCHA failed to initialize"));
      }
    };
    script.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(script);
  });

  return readyPromise;
}

export async function getRecaptchaToken(action) {
  const siteKey = await fetchSiteKey();
  await loadScript(siteKey);

  return await new Promise((resolve, reject) => {
    try {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    } catch (err) {
      reject(err);
    }
  });
}
