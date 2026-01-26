const https = require('https');

const {
  RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY,
  RECAPTCHA_MIN_SCORE,
} = require('./config');

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

function getRecaptchaConfig() {
  return {
    siteKey: RECAPTCHA_SITE_KEY,
    secretKey: RECAPTCHA_SECRET_KEY,
    minScore: RECAPTCHA_MIN_SCORE,
  };
}

function postForm(url, formData) {
  const body = new URLSearchParams(formData).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('reCAPTCHA verification timeout'));
    });
    req.write(body);
    req.end();
  });
}

async function verifyRecaptcha({ token, expectedAction, remoteIp }) {
  const config = getRecaptchaConfig();
  if (!config.secretKey) {
    return { ok: false, reason: 'not-configured' };
  }

  const payload = {
    secret: config.secretKey,
    response: token,
  };
  if (remoteIp) {
    payload.remoteip = remoteIp;
  }

  const response = await postForm(VERIFY_URL, payload);
  if (!response.body) {
    return { ok: false, reason: 'no-response' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(response.body);
  } catch (error) {
    return { ok: false, reason: 'invalid-json' };
  }

  const success = Boolean(parsed.success);
  const score = Number.parseFloat(parsed.score || 0);
  const action = String(parsed.action || '');
  const errors = parsed['error-codes'] || [];

  if (!success) {
    return {
      ok: false,
      reason: 'verification-failed',
      errors,
      score,
      action,
    };
  }

  if (expectedAction && action !== expectedAction) {
    return {
      ok: false,
      reason: 'action-mismatch',
      score,
      action,
    };
  }

  const minScore = Number(config.minScore || 0.5);
  if (score < minScore) {
    return {
      ok: false,
      reason: 'low-score',
      score,
      action,
      minScore,
    };
  }

  return {
    ok: true,
    score,
    action,
    hostname: String(parsed.hostname || ''),
  };
}

module.exports = {
  getRecaptchaConfig,
  verifyRecaptcha,
};
