const crypto = require('crypto');
const express = require('express');

const { BASE_PATH, ALLOWED_ORIGINS, ENABLE_DEBUG_ENDPOINTS } = require('../config');
const { LIMITS } = require('../constants');
const Logger = require('../logger');
const { checkRateLimit } = require('../rateLimit');
const {
  isNumericId,
  validateVisibility,
  normalizeSlug,
  generateSlug,
  generateAdminKey,
  validateEmail,
  validateConfig,
} = require('../validation');
const { getPool, ensureSchema, dbHealth, dbDebugInfo, mysqlDebugInfo } = require('../db');
const { getRecaptchaConfig, verifyRecaptcha } = require('../recaptcha');
const {
  sendPieceCreatedEmail,
  sendPieceDeletedEmail,
} = require('../email');

const router = express.Router();

function applyCors(req, res, next) {
  const origin = req.headers.origin || '';
  const allowAny = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes('*');

  if (allowAny || ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', allowAny ? '*' : origin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Recaptcha-Token');
    res.set('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

function buildBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const basePath = BASE_PATH && BASE_PATH !== '/' ? BASE_PATH : '';
  return `${proto}://${host}${basePath}`;
}

function handleValidationError(res, error) {
  res.status(400).json({ error: error.message || 'Invalid request' });
}

async function requireRecaptcha(req, res, expectedAction) {
  const token = String(req.get('X-Recaptcha-Token') || '');
  if (!token) {
    res.status(400).json({ error: 'Missing reCAPTCHA token' });
    return false;
  }

  const config = getRecaptchaConfig();
  if (!config.siteKey || !config.secretKey) {
    res.status(500).json({
      error: 'reCAPTCHA is not configured. Set RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY.',
    });
    return false;
  }

  try {
    const result = await verifyRecaptcha({
      token,
      expectedAction,
      remoteIp: req.ip,
    });

    if (!result.ok) {
      Logger.warning('recaptcha_failed', {
        reason: result.reason || 'unknown',
        score: result.score ?? null,
        action: result.action ?? null,
        errors: result.errors ?? null,
      }, req);
      res.status(403).json({ error: 'reCAPTCHA verification failed' });
      return false;
    }
  } catch (error) {
    Logger.warning('recaptcha_error', { error: error.message || 'unknown' }, req);
    res.status(502).json({ error: 'reCAPTCHA verification failed' });
    return false;
  }

  return true;
}

async function getPieceByRef(pool, ref) {
  if (isNumericId(ref)) {
    const [rows] = await pool.execute(
      'SELECT id, slug, visibility, admin_key, email, config_json, created_at FROM pieces WHERE id = ? LIMIT 1',
      [Number.parseInt(ref, 10)]
    );
    return rows[0] || null;
  }

  const [rows] = await pool.execute(
    'SELECT id, slug, visibility, admin_key, email, config_json, created_at FROM pieces WHERE slug = ? LIMIT 1',
    [ref]
  );
  return rows[0] || null;
}

router.use(applyCors);

router.get('/health', async (req, res) => {
  res.json(await dbHealth());
});

router.get('/debug/db', async (req, res) => {
  if (!ENABLE_DEBUG_ENDPOINTS) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(await dbDebugInfo());
});

router.get('/debug/mysql', async (req, res) => {
  if (!ENABLE_DEBUG_ENDPOINTS) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const info = await mysqlDebugInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message || 'MySQL debug failed' });
  }
});

router.get('/recaptcha/site-key', (req, res) => {
  const config = getRecaptchaConfig();
  if (!config.siteKey) {
    res.status(500).json({ error: 'reCAPTCHA site key is not configured' });
    return;
  }

  res.json({ siteKey: config.siteKey });
});

router.post('/pieces', async (req, res) => {
  if (!checkRateLimit(req, res)) return;

  if (!(await requireRecaptcha(req, res, 'create_piece'))) return;

  try {
    const body = req.body || {};
    if (!body.config || typeof body.config !== 'object') {
      throw new Error('Missing config');
    }

    if (!body.email || typeof body.email !== 'string') {
      throw new Error('Email is required');
    }

    validateConfig(body.config);

    const email = validateEmail(body.email);
    const visibility = validateVisibility(body.visibility || 'public');
    const requestedSlug = normalizeSlug(body.slug || '');
    const adminKey = generateAdminKey();

    const pool = await getPool();
    await ensureSchema();

    let slug = requestedSlug ? requestedSlug : generateSlug();

    if (requestedSlug) {
      const [rows] = await pool.execute('SELECT id FROM pieces WHERE slug = ? LIMIT 1', [slug]);
      if (rows.length > 0) {
        Logger.warning('slug_conflict_user_provided', { slug, ip: req.ip }, req);
        res.status(409).json({ error: `Slug '${slug}' is already taken. Please choose a different slug.` });
        return;
      }
    } else {
      for (let i = 0; i < LIMITS.SLUG_RETRY_ATTEMPTS; i += 1) {
        const [rows] = await pool.execute('SELECT id FROM pieces WHERE slug = ? LIMIT 1', [slug]);
        if (rows.length === 0) break;
        slug = generateSlug();
      }
      const [rows] = await pool.execute('SELECT id FROM pieces WHERE slug = ? LIMIT 1', [slug]);
      if (rows.length > 0) {
        Logger.error('slug_generation_exhausted', { attempts: LIMITS.SLUG_RETRY_ATTEMPTS, ip: req.ip }, req);
        res.status(500).json({ error: 'Unable to generate unique slug. Please try again.' });
        return;
      }
    }

    const configJson = JSON.stringify(body.config);

    const [result] = await pool.execute(
      'INSERT INTO pieces (slug, visibility, admin_key, email, config_json) VALUES (?, ?, ?, ?, ?)',
      [slug, visibility, adminKey, email, configJson]
    );

    const pieceId = Number(result.insertId);
    const baseUrl = buildBaseUrl(req);

    let emailSent = false;
    try {
      emailSent = await sendPieceCreatedEmail({
        toEmail: email,
        pieceId,
        pieceSlug: slug,
        adminKey,
        config: body.config,
        baseUrl,
      });
    } catch (error) {
      Logger.warning('email_send_failed', { error: error.message }, req);
    }

    Logger.audit('piece_created', {
      id: pieceId,
      slug,
      visibility,
      email,
      email_sent: emailSent,
      ip: req.ip,
    }, req);

    res.json({
      id: pieceId,
      slug,
      visibility,
      adminKey,
      emailSent,
    });
  } catch (error) {
    Logger.warning('validation_error', { message: error.message }, req);
    handleValidationError(res, error);
  }
});

router.get('/pieces/:ref', async (req, res) => {
  try {
    const pool = await getPool();
    await ensureSchema();

    const ref = String(req.params.ref);
    const piece = await getPieceByRef(pool, ref);
    if (!piece) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const visibility = String(piece.visibility || 'public');
    const configJson = String(piece.config_json || '');

    if (visibility === 'public') {
      const etag = crypto.createHash('md5').update(configJson).digest('hex');
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
      res.set('ETag', `"${etag}"`);

      if (req.headers['if-none-match'] === `"${etag}"`) {
        res.status(304).end();
        return;
      }
    } else {
      res.set('Cache-Control', 'private, no-cache');
    }

    res.json({
      id: Number(piece.id),
      slug: String(piece.slug),
      visibility,
      config: JSON.parse(configJson),
    });
  } catch (error) {
    Logger.error('database_error', { message: error.message }, req);
    res.status(500).json({ error: 'Database error' });
  }
});

router.patch('/pieces/:ref', async (req, res) => {
  const adminKey = String(req.get('X-Admin-Key') || '');
  if (!adminKey) {
    res.status(401).json({ error: 'Missing admin key' });
    return;
  }

  try {
    const visibility = validateVisibility(req.body?.visibility || '');

    const pool = await getPool();
    await ensureSchema();

    const ref = String(req.params.ref);
    const piece = await getPieceByRef(pool, ref);
    if (!piece) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (String(piece.admin_key) !== adminKey) {
      Logger.warning('invalid_admin_key_patch', { ref }, req);
      res.status(403).json({ error: 'Invalid admin key' });
      return;
    }

    if (isNumericId(ref)) {
      await pool.execute('UPDATE pieces SET visibility = ? WHERE id = ?', [visibility, Number.parseInt(ref, 10)]);
    } else {
      await pool.execute('UPDATE pieces SET visibility = ? WHERE slug = ?', [visibility, ref]);
    }

    Logger.audit('piece_visibility_updated', { ref, visibility }, req);

    res.json({ ok: true, visibility });
  } catch (error) {
    Logger.warning('validation_error', { message: error.message }, req);
    handleValidationError(res, error);
  }
});

router.put('/pieces/:ref', async (req, res) => {
  const adminKey = String(req.get('X-Admin-Key') || '');
  if (!adminKey) {
    res.status(401).json({ error: 'Missing admin key' });
    return;
  }

  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    if (!req.body.config || typeof req.body.config !== 'object') {
      res.status(400).json({ error: 'Missing or invalid config' });
      return;
    }

    validateConfig(req.body.config);

    const newConfig = req.body.config;
    const newVisibility = req.body.visibility
      ? validateVisibility(req.body.visibility)
      : undefined;

    const pool = await getPool();
    await ensureSchema();

    const ref = String(req.params.ref);
    const piece = await getPieceByRef(pool, ref);

    if (!piece) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (String(piece.admin_key) !== adminKey) {
      Logger.warning('invalid_admin_key_update', { ref }, req);
      res.status(403).json({ error: 'Invalid admin key' });
      return;
    }

    const visibility = newVisibility || String(piece.visibility);
    const configJson = JSON.stringify(newConfig);

    Logger.info('update_attempt', {
      ref,
      is_numeric: isNumericId(ref),
      new_config_size: configJson.length,
      new_visibility: visibility,
      old_config_size: String(piece.config_json || '').length,
      old_visibility: String(piece.visibility || ''),
    }, req);

    if (isNumericId(ref)) {
      const [result] = await pool.execute(
        'UPDATE pieces SET config_json = ?, visibility = ? WHERE id = ?',
        [configJson, visibility, Number.parseInt(ref, 10)]
      );
      if (result.affectedRows === 0) {
        Logger.error('update_failed_no_rows_affected', { ref }, req);
        res.status(500).json({ error: 'Update failed: no rows affected' });
        return;
      }
    } else {
      const [result] = await pool.execute(
        'UPDATE pieces SET config_json = ?, visibility = ? WHERE slug = ?',
        [configJson, visibility, ref]
      );
      if (result.affectedRows === 0) {
        Logger.error('update_failed_no_rows_affected', { ref }, req);
        res.status(500).json({ error: 'Update failed: no rows affected' });
        return;
      }
    }

    const verify = await getPieceByRef(pool, ref);
    const dbConfigMatches = verify && String(verify.config_json) === configJson;
    const dbVisibilityMatches = verify && String(verify.visibility) === visibility;

    Logger.info('update_successful', {
      ref,
      config_size: configJson.length,
      db_config_matches: dbConfigMatches,
      db_visibility_matches: dbVisibilityMatches,
      verification: verify ? 'found' : 'not_found',
    }, req);

    if (!dbConfigMatches || !dbVisibilityMatches) {
      Logger.error('update_verification_mismatch', {
        ref,
        config_matches: dbConfigMatches,
        visibility_matches: dbVisibilityMatches,
      }, req);
      res.status(500).json({ error: 'Update verification failed: data mismatch after write' });
      return;
    }

    const emailSent = false;

    Logger.audit('piece_updated', {
      id: Number(piece.id),
      slug: String(piece.slug),
      ref,
      visibility,
      email: String(piece.email || ''),
      email_sent: emailSent,
    }, req);

    res.json({
      ok: true,
      id: Number(piece.id),
      slug: String(piece.slug),
      visibility,
      config: newConfig,
      created_at: String(piece.created_at),
    });
  } catch (error) {
    Logger.warning('validation_error', { message: error.message }, req);
    handleValidationError(res, error);
  }
});

router.delete('/pieces/:ref', async (req, res) => {
  const adminKey = String(req.get('X-Admin-Key') || '');
  if (!adminKey) {
    res.status(401).json({ error: 'Missing admin key' });
    return;
  }

  try {
    if (!(await requireRecaptcha(req, res, 'delete_piece'))) return;

    const pool = await getPool();
    await ensureSchema();

    const ref = String(req.params.ref);
    const piece = await getPieceByRef(pool, ref);

    if (!piece) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (String(piece.admin_key) !== adminKey) {
      Logger.warning('invalid_admin_key_delete', { ref }, req);
      res.status(403).json({ error: 'Invalid admin key' });
      return;
    }

    let config = {};
    try {
      config = JSON.parse(String(piece.config_json || '{}')) || {};
    } catch {
      config = {};
    }

    let emailSent = false;
    if (piece.email) {
      try {
        emailSent = await sendPieceDeletedEmail({
          toEmail: String(piece.email),
          pieceId: Number(piece.id),
          pieceSlug: String(piece.slug),
          config,
        });
      } catch (error) {
        Logger.warning('email_send_failed', { error: error.message }, req);
      }
    }

    if (isNumericId(ref)) {
      await pool.execute('DELETE FROM pieces WHERE id = ?', [Number.parseInt(ref, 10)]);
    } else {
      await pool.execute('DELETE FROM pieces WHERE slug = ?', [ref]);
    }

    Logger.audit('piece_deleted', {
      id: Number(piece.id),
      slug: String(piece.slug),
      ref,
      visibility: String(piece.visibility),
      email: String(piece.email || ''),
      email_sent: emailSent,
      permanent: true,
    }, req);

    res.json({ ok: true, deleted: true, emailSent });
  } catch (error) {
    Logger.error('unexpected_error', { message: error.message }, req);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
