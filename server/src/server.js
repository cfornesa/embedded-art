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
app.use('/aframe/api', apiRouter);
app.use('/p5/api', apiRouter);
app.use('/c2/api', apiRouter);

// Image proxy
app.get('/api/image-proxy', imageProxyHandler);
app.get(`${BASE_PATH}/api/image-proxy`, imageProxyHandler);
app.get('/aframe/api/image-proxy', imageProxyHandler);
app.get('/p5/api/image-proxy', imageProxyHandler);
app.get('/c2/api/image-proxy', imageProxyHandler);

// Block direct access to server-side/legacy paths.
app.use((req, res, next) => {
  if (req.path.startsWith(`${BASE_PATH}/app`)) {
    res.status(403).send('Forbidden');
    return;
  }
  if (req.path.startsWith('/aframe/app')) {
    res.status(403).send('Forbidden');
    return;
  }
  if (req.path.startsWith('/p5/app')) {
    res.status(403).send('Forbidden');
    return;
  }
  if (req.path.startsWith('/c2/app')) {
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

const rootDir = path.join(__dirname, '..', '..');

// Serve project overview without the .html suffix
app.get(['/project_overview', '/project_overview/'], (req, res) => {
  res.sendFile(path.join(rootDir, 'project_overview.html'));
});

// Shared theme assets
app.use('/shared', express.static(path.join(rootDir, 'shared'), { index: false }));

// Serve static Three.js app
const threejsDir = path.join(rootDir, 'threejs');
app.use(BASE_PATH, express.static(threejsDir, { index: false }));

// Redirect /aframe to its builder
app.get('/aframe', (req, res) => {
  res.redirect(302, '/aframe/builder.html');
});
app.get('/aframe/', (req, res) => {
  res.redirect(302, '/aframe/builder.html');
});

// Redirect /p5 to its builder
app.get('/p5', (req, res) => {
  res.redirect(302, '/p5/builder.html');
});
app.get('/p5/', (req, res) => {
  res.redirect(302, '/p5/builder.html');
});

// Serve static A-Frame app
const aframeDir = path.join(rootDir, 'aframe');
app.use('/aframe', express.static(aframeDir, { index: false }));

// Serve static p5 app
const p5Dir = path.join(rootDir, 'p5');
app.use('/p5', express.static(p5Dir, { index: false }));

// Redirect /c2 to its builder
app.get('/c2', (req, res) => {
  res.redirect(302, '/c2/builder.html');
});
app.get('/c2/', (req, res) => {
  res.redirect(302, '/c2/builder.html');
});

// Serve static c2 app
const c2Dir = path.join(rootDir, 'c2');
app.use('/c2', express.static(c2Dir, { index: false }));

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
