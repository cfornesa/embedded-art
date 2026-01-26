const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
const { LIMITS } = require('./constants');
const Logger = require('./logger');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data));
}

function checkRateLimit(req, res, options = {}) {
  if (process.env.REPL_ID) {
    return true;
  }

  const maxRequests = options.maxRequests ?? LIMITS.RATE_LIMIT_MAX_REQUESTS;
  const windowSeconds = options.windowSeconds ?? LIMITS.RATE_LIMIT_WINDOW_SECONDS;

  const cacheDir = path.join(DATA_DIR, 'rate_limits');
  try {
    ensureDir(cacheDir);
  } catch (error) {
    Logger.warning('rate_limit_cache_not_writable', { dir: cacheDir, error: error.message }, req);
    return true;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' && forwarded.length > 0)
    ? forwarded.split(',')[0].trim()
    : (req.ip || 'unknown');
  const cacheFile = path.join(cacheDir, `${Buffer.from(ip).toString('hex')}.json`);
  const now = Math.floor(Date.now() / 1000);

  let data = readJson(cacheFile, { count: 0, window_start: now });
  if (now - data.window_start >= windowSeconds) {
    data = { count: 0, window_start: now };
  }

  data.count += 1;

  if (data.count > maxRequests) {
    const retryAfter = windowSeconds - (now - data.window_start);

    Logger.warning('rate_limit_exceeded', {
      ip,
      count: data.count,
      limit: maxRequests,
      retry_after: retryAfter,
    }, req);

    res.set('Retry-After', String(retryAfter));
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(data.window_start + windowSeconds));
    res.status(429).json({
      error: 'Rate limit exceeded. Try again later.',
      retry_after: retryAfter,
    });
    return false;
  }

  writeJson(cacheFile, data);

  res.set('X-RateLimit-Limit', String(maxRequests));
  res.set('X-RateLimit-Remaining', String(maxRequests - data.count));
  res.set('X-RateLimit-Reset', String(data.window_start + windowSeconds));

  return true;
}

module.exports = {
  checkRateLimit,
};
