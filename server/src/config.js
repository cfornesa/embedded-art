const path = require('path');

const BASE_PATH = process.env.BASE_PATH || '/threejs';
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

const DB_HOST = process.env.DB_HOST || '';
const DB_NAME = process.env.DB_NAME || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASS = process.env.DB_PASS || '';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ENABLE_DEBUG_ENDPOINTS = process.env.ENABLE_DEBUG_ENDPOINTS === '1';
const ENABLE_DEBUG_LOGGING = process.env.ENABLE_DEBUG_LOGGING === '1';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

module.exports = {
  BASE_PATH,
  PORT,
  DB_HOST,
  DB_NAME,
  DB_USER,
  DB_PASS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  ALLOWED_ORIGINS,
  ENABLE_DEBUG_ENDPOINTS,
  ENABLE_DEBUG_LOGGING,
  DATA_DIR,
};
