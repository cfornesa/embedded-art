const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');

const { BASE_PATH, PORT } = require('./config');
const apiRouter = require('./routes/api');
const { imageProxyHandler } = require('./imageProxy');
const { viewRegistry, renderHome, registerViewRoutes } = require('./views');

const app = express();

app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/', (req, res) => {
  res.type('html').send(renderHome(viewRegistry));
});

registerViewRoutes(app);

// API routes (support both /api and /threejs/api)
app.use('/api', apiRouter);
app.use(`${BASE_PATH}/api`, apiRouter);

// Image proxy (legacy .php path)
app.get('/api/image-proxy.php', imageProxyHandler);
app.get(`${BASE_PATH}/api/image-proxy.php`, imageProxyHandler);

// Block direct access to server-side PHP/app files.
app.use((req, res, next) => {
  if (req.path.startsWith(`${BASE_PATH}/app`)) {
    res.status(403).send('Forbidden');
    return;
  }
  if (req.path.endsWith('.php')) {
    res.status(403).send('Forbidden');
    return;
  }
  next();
});

// Redirect base path to builder
app.get(`${BASE_PATH}`, (req, res) => {
  res.redirect(302, `${BASE_PATH}/builder.html`);
});
app.get(`${BASE_PATH}/`, (req, res) => {
  res.redirect(302, `${BASE_PATH}/builder.html`);
});

// Serve static Three.js app
const threejsDir = path.join(__dirname, '..', '..', 'threejs');
app.use(BASE_PATH, express.static(threejsDir, { index: false }));

// JSON parse errors
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  next(err);
});

app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith(`${BASE_PATH}/api`)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Node server listening on http://localhost:${PORT}`);
});
