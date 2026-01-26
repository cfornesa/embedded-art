const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const FETCH_TIMEOUT = 10_000;
const CACHE_DURATION = 3600;

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
}

function isPrivateIp(ip) {
  const ipType = net.isIP(ip);
  if (ipType === 4) return isPrivateIpv4(ip);
  if (ipType === 6) return isPrivateIpv6(ip);
  return true;
}

async function validateUrlIpAddress(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;

  if (!host) {
    return { valid: false, error: 'Invalid URL - no host' };
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      return { valid: false, error: 'Access to internal resources not allowed' };
    }
    return { valid: true, error: null };
  }

  const records = await dns.lookup(host, { all: true });
  if (!records || records.length === 0) {
    return { valid: false, error: 'Could not resolve hostname' };
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      return { valid: false, error: 'Access to internal resources not allowed' };
    }
  }

  return { valid: true, error: null };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImageWithSafeRedirects(url, maxRedirects = 3) {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const response = await fetchWithTimeout(currentUrl, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'ImageProxy/1.0',
      },
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      redirectCount += 1;
      if (redirectCount > maxRedirects) {
        return { success: false, error: 'Too many redirects', httpCode: response.status };
      }

      const location = response.headers.get('location');
      if (!location) {
        return { success: false, error: 'Redirect without Location header', httpCode: response.status };
      }

      const nextUrl = new URL(location, currentUrl).toString();
      const nextScheme = new URL(nextUrl).protocol.replace(':', '');
      if (!['http', 'https'].includes(nextScheme)) {
        return { success: false, error: 'Invalid redirect protocol', httpCode: response.status };
      }

      const validation = await validateUrlIpAddress(nextUrl);
      if (!validation.valid) {
        return { success: false, error: `Redirect blocked: ${validation.error}`, httpCode: response.status };
      }

      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      return { success: false, error: `Failed to fetch image (HTTP ${response.status})`, httpCode: response.status };
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    return {
      success: true,
      data,
      contentType: response.headers.get('content-type') || '',
      httpCode: response.status,
    };
  }

  return { success: false, error: 'Too many redirects', httpCode: 0 };
}

function detectImageContentType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.slice(0, 8).equals(pngHeader)) return 'image/png';

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';

  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

async function imageProxyHandler(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: "Missing 'url' parameter" });
    return;
  }

  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (!['http', 'https'].includes(scheme)) {
    res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
    return;
  }

  const extension = (parsed.pathname.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    res.status(400).json({ error: `Invalid image type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` });
    return;
  }

  try {
    const validation = await validateUrlIpAddress(parsed.toString());
    if (!validation.valid) {
      res.status(403).json({ error: validation.error });
      return;
    }

    const result = await fetchImageWithSafeRedirects(parsed.toString(), 3);
    if (!result.success || !result.data) {
      res.status(502).json({ error: result.error || 'Failed to fetch image' });
      return;
    }

    if (result.data.length > MAX_IMAGE_SIZE) {
      res.status(413).json({ error: `Image too large (max ${MAX_IMAGE_SIZE / 1024 / 1024} MB)` });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    let contentTypeLower = (result.contentType || '').split(';')[0].trim().toLowerCase();

    if (!allowedTypes.includes(contentTypeLower)) {
      const detected = detectImageContentType(result.data);
      if (!detected || !allowedTypes.includes(detected)) {
        res.status(400).json({ error: 'URL does not point to a valid image' });
        return;
      }
      contentTypeLower = detected;
    }

    const etag = crypto.createHash('md5').update(result.data).digest('hex');
    res.set('Content-Type', contentTypeLower);
    res.set('Content-Length', String(result.data.length));
    res.set('Cache-Control', `public, max-age=${CACHE_DURATION}`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('ETag', `"${etag}"`);

    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === `"${etag}"`) {
      res.status(304).end();
      return;
    }

    res.status(200).send(result.data);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch image' });
  }
}

module.exports = {
  imageProxyHandler,
};
