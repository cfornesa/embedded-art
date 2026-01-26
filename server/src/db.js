const mysql = require('mysql2/promise');
const {
  DB_HOST,
  DB_NAME,
  DB_USER,
  DB_PASS,
} = require('./config');
const { LIMITS } = require('./constants');

let pool;
let schemaEnsured = false;

function requireDbConfig() {
  if (!DB_HOST || !DB_NAME || !DB_USER) {
    throw new Error('Missing MySQL configuration. Set DB_HOST, DB_NAME, and DB_USER.');
  }
}

async function getPool() {
  if (!pool) {
    requireDbConfig();
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      connectTimeout: LIMITS.DB_TIMEOUT_SECONDS * 1000,
    });
  }
  return pool;
}

async function ensureSchema() {
  if (schemaEnsured) return;
  const poolRef = await getPool();
  await poolRef.execute(`
    CREATE TABLE IF NOT EXISTS pieces (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      slug VARCHAR(60) NOT NULL,
      visibility VARCHAR(12) NOT NULL DEFAULT 'public',
      admin_key VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      config_json LONGTEXT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_slug (slug),
      INDEX idx_visibility (visibility),
      INDEX idx_created_at (created_at),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [columns] = await poolRef.query("SHOW COLUMNS FROM pieces LIKE 'email'");
  if (Array.isArray(columns) && columns.length === 0) {
    await poolRef.execute("ALTER TABLE pieces ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT ''");
  }

  schemaEnsured = true;
}

async function dbHealth() {
  try {
    const poolRef = await getPool();
    await ensureSchema();
    await poolRef.query('SELECT 1');
    return { ok: true, driver: 'mysql' };
  } catch (error) {
    return {
      ok: false,
      driver: 'none',
      error: error.message || 'MySQL connection failed',
    };
  }
}

async function dbDebugInfo() {
  const safeCfg = {
    DB_HOST: DB_HOST || '',
    DB_NAME: DB_NAME ? 'set' : 'unset',
    DB_USER: DB_USER ? 'set' : 'unset',
    DB_PASS: DB_PASS ? 'set' : 'unset',
  };

  return {
    env: {
      is_replit: Boolean(process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPL_OWNER),
      node_version: process.version,
    },
    config: {
      forced_driver: 'mysql',
      sanitized: safeCfg,
    },
    decision: await dbHealth(),
  };
}

async function mysqlDebugInfo() {
  const poolRef = await getPool();
  await ensureSchema();

  const [versionRows] = await poolRef.query('SELECT VERSION() as version');
  const [connRows] = await poolRef.query('SELECT CONNECTION_ID() as connection_id');

  const vars = [
    'max_allowed_packet',
    'wait_timeout',
    'interactive_timeout',
    'character_set_server',
    'collation_server',
    'innodb_strict_mode',
    'sql_mode',
  ];

  const variables = {};
  for (const variable of vars) {
    try {
      const [rows] = await poolRef.query('SHOW VARIABLES LIKE ?', [variable]);
      variables[variable] = rows?.[0]?.Value ?? 'unknown';
    } catch (error) {
      variables[variable] = `error: ${error.message}`;
    }
  }

  return {
    driver: 'mysql',
    server_version: versionRows?.[0]?.version || 'unknown',
    connection_id: connRows?.[0]?.connection_id || 'unknown',
    variables,
  };
}

module.exports = {
  getPool,
  ensureSchema,
  dbHealth,
  dbDebugInfo,
  mysqlDebugInfo,
};
