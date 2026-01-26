# Hostinger Deployment Checklist (Node + Express)

This project now runs as a Node.js (Express) application. The API lives in `server/` and the frontends are static assets under `threejs/`, `aframe/`, `p5/`, and `c2/`.

## Pre‑Deployment

- [ ] Create a MySQL database in hPanel
- [ ] Note the DB credentials (host, name, user, password)
- [ ] Confirm your Hostinger plan supports Node.js (or use a VPS)

## Step 1: Upload Files

Upload the repository to `public_html/` (or your chosen app directory). The static frontends should live next to the `server/` folder.

```
public_html/
├── server/
├── threejs/
├── aframe/
├── p5/
├── c2/
└── README.md
```

## Step 2: Configure Environment

Create `server/.env` based on `server/.env.example`:

```dotenv
PORT=3000
BASE_PATH=/threejs
DB_HOST=localhost
DB_NAME=your_database
DB_USER=your_user
DB_PASS=your_password
ALLOWED_ORIGINS=*

# Optional SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# reCAPTCHA v3 (required for create/delete)
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
RECAPTCHA_MIN_SCORE=0.5
```

## Step 3: Install Dependencies

From the `server/` directory:

```bash
npm install
```

## Step 4: Start the Server

If you use Hostinger’s Node.js app panel:
- **App root:** `server`
- **Start file:** `src/server.js`

Or run manually:
```bash
node src/server.js
```

## Step 5: Verify API

- Health check: `https://yourdomain.com/api/health`
- reCAPTCHA key: `https://yourdomain.com/api/recaptcha/site-key`
- Image proxy: `https://yourdomain.com/api/image-proxy?url=https://example.com/image.jpg`

## Step 6: Verify Frontend

- Builder: `https://yourdomain.com/threejs/builder.html`
- Delete: `https://yourdomain.com/threejs/delete.html`
- Viewer: `https://yourdomain.com/threejs/view.html?id=your-slug`

---

Notes:
- The server also serves the `aframe`, `p5`, and `c2` frontends at `/aframe`, `/p5`, `/c2`.
- The API is shared across all frontends.
