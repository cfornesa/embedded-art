const { ENABLE_DEBUG_LOGGING } = require('./config');

function baseRequestContext(req) {
  if (!req) return {};
  return {
    method: req.method,
    uri: req.originalUrl || req.url,
    ip: req.headers['x-forwarded-for'] || req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  };
}

function log(level, message, context = {}, req = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    request: baseRequestContext(req),
  };

  // Keep JSON on one line for log ingestion.
  console.log(JSON.stringify(entry));
}

const Logger = {
  info(message, context = {}, req = null) {
    log('INFO', message, context, req);
  },
  warning(message, context = {}, req = null) {
    log('WARNING', message, context, req);
  },
  error(message, context = {}, req = null) {
    log('ERROR', message, context, req);
  },
  audit(message, context = {}, req = null) {
    log('AUDIT', message, context, req);
  },
  debug(message, context = {}, req = null) {
    if (ENABLE_DEBUG_LOGGING || process.env.REPL_ID) {
      log('DEBUG', message, context, req);
    }
  },
};

module.exports = Logger;
