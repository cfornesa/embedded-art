# Embedded Art Platform (Node + Express)

A 3D art piece creation and embedding platform with a Node.js (Express) API and static frontends (Three.js, A-Frame, p5, and c2). Users can create customizable scenes, then embed them anywhere via iframe.

Default app path: `https://yourdomain.com/threejs/builder.html`

## Table of Contents

- Architecture Overview
- System Requirements
- Installation
- Configuration
- Project Structure
- API Documentation
- Database Schema
- Security Notes
- Troubleshooting

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 Client Layer                         │
│  builder.html  |  embed.html  |  delete.html         │
│  (UI)          |  (Viewer)    |  (Admin UI)          │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ HTTP/JSON
                  │
┌─────────────────▼───────────────────────────────────┐
│              API Layer (Express)                     │
│  server/src/routes/api.js                             │
└─────────────────┬───────────────────────────────────┘
                  │
                  │
┌─────────────────▼───────────────────────────────────┐
│               Data Layer (MySQL)                     │
│  server/src/db.js                                    │
└─────────────────────────────────────────────────────┘
```

Key design notes:
- Stateless API (auth via admin keys)
- Client-side rendering (Three.js/A-Frame/p5/c2)
- MySQL-backed storage
- Self-hosted image proxy for texture privacy

---

## System Requirements

- Node.js 18+
- MySQL 8.0+
- Modern browser with ES6 module support and WebGL

---

## Installation

### Development (local)

1. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

4. Open the builder:
   ```
   http://localhost:3000/threejs/builder.html
   ```

---

## Configuration

All configuration is via `server/.env` (loaded by `dotenv`).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_PATH` | `/threejs` | Base path for the Three.js frontend |
| `DB_HOST` | - | MySQL hostname |
| `DB_NAME` | - | MySQL database name |
| `DB_USER` | - | MySQL username |
| `DB_PASS` | - | MySQL password |
| `ALLOWED_ORIGINS` | `*` | CORS allow list (comma-separated) |
| `ENABLE_DEBUG_ENDPOINTS` | `0` | Enable `/api/debug/*` endpoints |
| `ENABLE_DEBUG_LOGGING` | `0` | Verbose API logging |
| `SMTP_HOST` | - | SMTP host for email |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password |
| `RECAPTCHA_SITE_KEY` | - | reCAPTCHA v3 site key |
| `RECAPTCHA_SECRET_KEY` | - | reCAPTCHA v3 secret key |
| `RECAPTCHA_MIN_SCORE` | `0.5` | Minimum score required for create/delete |

### reCAPTCHA v3
- Required for piece creation and deletion.
- Client fetches the site key from `/api/recaptcha/site-key` and sends tokens in `X-Recaptcha-Token`.
- Server validates token, action, and score.

---

## Project Structure

```
/
├── server/                 # Node/Express API
│   ├── src/
│   │   ├── routes/api.js    # REST API
│   │   ├── db.js            # MySQL access + schema
│   │   ├── email.js         # SMTP/mail logic
│   │   ├── recaptcha.js     # reCAPTCHA verification
│   │   └── server.js        # Express app
│   └── .env.example
├── threejs/                # Main frontend (Three.js)
├── aframe/                 # A-Frame frontend
├── p5/                     # p5 frontend
├── c2/                     # c2 frontend
└── README.md
```

---

## API Documentation

Base: `/api`

### `POST /api/pieces`
Create a new piece.

Request body:
```json
{
  "slug": "my-art-piece",
  "email": "user@example.com",
  "visibility": "public",
  "config": {
    "version": 2,
    "bg": "#000000",
    "bgImageUrl": "",
    "cameraZ": 10,
    "rotationSpeed": 0.01,
    "shapes": []
  }
}
```

Headers:
- `Content-Type: application/json`
- `X-Recaptcha-Token: <token>`

### `GET /api/pieces/{id|slug}`
Retrieve a piece by ID or slug.

### `PATCH /api/pieces/{id|slug}`
Update visibility (soft delete).

Headers:
- `X-Admin-Key: <admin_key>`

Body:
```json
{ "visibility": "deleted" }
```

### `DELETE /api/pieces/{id|slug}`
Hard delete a piece.

Headers:
- `X-Admin-Key: <admin_key>`
- `X-Recaptcha-Token: <token>`

### `GET /api/recaptcha/site-key`
Returns the public reCAPTCHA site key.

### `GET /api/image-proxy`
Self-hosted CORS proxy for textures. Query param: `url`.

---

## Database Schema (MySQL)

```sql
CREATE TABLE pieces (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Security Notes

- Admin keys are required for edit/delete.
- reCAPTCHA v3 protects create/delete endpoints.
- Image proxy blocks private IPs and validates file types.

---

## Troubleshooting

- `Missing MySQL configuration`: set `DB_HOST`, `DB_NAME`, `DB_USER`.
- `reCAPTCHA site key is not configured`: set `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`.
- `Delete failed (403)`: check admin key and reCAPTCHA token.
