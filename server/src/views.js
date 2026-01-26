const viewRegistry = [
  {
    slug: 'threejs',
    label: 'Three.js Viewer',
    path: '/threejs/view.html',
    description: 'WebGL view for saved 3D pieces.',
    status: 'active',
  },
  {
    slug: 'p5',
    label: 'p5.js Viewer',
    path: '/p5/view.html',
    description: 'p5.js view for saved pieces.',
    status: 'active',
  },
  {
    slug: 'aframe',
    label: 'A-Frame Viewer',
    path: '/aframe/view.html',
    description: 'A-Frame view for saved 3D pieces.',
    status: 'active',
  },
];

function renderHome(views) {
  const sampleId = 'piece-abcdef';
  const cards = views.map((view) => {
    const href = `${view.path}?id=${sampleId}`;
    const status = view.status === 'placeholder' ? 'Coming soon' : 'Live';
    return `
      <article class="card">
        <h2>${view.label}</h2>
        <p>${view.description}</p>
        <div class="meta">
          <span class="pill">/${view.slug}</span>
          <span class="pill">${status}</span>
        </div>
        <a class="link" href="${href}">Open view</a>
      </article>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Embedded Art Platform</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f1ea;
      --ink: #1a1a1a;
      --accent: #d77d2d;
      --card: #ffffff;
      --muted: #666;
      --border: #e3d9cc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
      background: radial-gradient(circle at top, #fff7e8 0%, var(--bg) 45%, #f0ebe1 100%);
      color: var(--ink);
    }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 56px 20px 72px;
    }
    header {
      margin-bottom: 32px;
    }
    h1 {
      font-size: clamp(2rem, 3vw, 3rem);
      margin: 0 0 12px;
      letter-spacing: -0.02em;
    }
    header p {
      max-width: 720px;
      margin: 0;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--muted);
    }
    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-top: 28px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 12px 24px rgba(26, 26, 26, 0.08);
    }
    .card h2 {
      margin: 0 0 8px;
      font-size: 1.2rem;
    }
    .card p {
      margin: 0 0 12px;
      color: var(--muted);
      line-height: 1.5;
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .pill {
      background: #f7efe4;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .link {
      text-decoration: none;
      color: var(--accent);
      font-weight: 600;
    }
    .slug-note {
      margin-top: 24px;
      padding: 16px 18px;
      border-radius: 14px;
      border: 1px dashed var(--border);
      background: #fffaf2;
      color: var(--muted);
      font-size: 0.95rem;
    }
    code { font-family: "JetBrains Mono", Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Embedded Art Platform</h1>
      <p>Start with the Three.js view, then add new renderers by registering a new slug in the view registry. Each view keeps the same <code>?id=slug</code> structure so existing links continue to work.</p>
    </header>
    <section class="grid">
      ${cards}
    </section>
    <div class="slug-note">
      Example link format: <code>/threejs/view.html?id=piece-abcdef</code> or <code>/p5/view.html?id=piece-abcdef</code>.
    </div>
  </main>
</body>
</html>`;
}

function renderViewLanding(view, req) {
  const sampleId = req.query.id ? String(req.query.id) : 'piece-abcdef';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${view.label}</title>
  <style>
    :root { --bg: #0e0d0b; --ink: #f2f2f2; --accent: #d77d2d; }
    body { margin: 0; font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif; background: var(--bg); color: var(--ink); }
    main { max-width: 900px; margin: 0 auto; padding: 64px 20px; }
    h1 { margin: 0 0 12px; }
    p { color: #c7c7c7; line-height: 1.6; }
    .panel { margin-top: 24px; padding: 18px; border-radius: 14px; background: rgba(255,255,255,0.08); }
    a { color: var(--accent); text-decoration: none; }
    code { font-family: "JetBrains Mono", Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>${view.label}</h1>
    <p>${view.description}</p>
    <div class="panel">
      <p>This placeholder keeps the slug structure intact. Use <code>?id=${sampleId}</code> to fetch the piece configuration when you wire up the renderer.</p>
      <p><a href="/">Back to home</a></p>
    </div>
  </main>
</body>
</html>`;
}

function registerViewRoutes(app) {
  for (const view of viewRegistry) {
    if (view.path === '/threejs/view.html' || view.path === '/aframe/view.html' || view.path === '/p5/view.html') continue;
    app.get([view.path, `${view.path}/`], (req, res) => {
      res.type('html').send(renderViewLanding(view, req));
    });
  }
}

module.exports = {
  viewRegistry,
  renderHome,
  renderViewLanding,
  registerViewRoutes,
};
