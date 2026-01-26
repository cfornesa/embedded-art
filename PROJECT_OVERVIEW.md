# Project Overview (Node + Express)

This project is a Node.js (Express) API with multiple static frontends:
- `threejs/` (main)
- `aframe/`
- `p5/`
- `c2/`

## Core Components

- **API**: `server/src/routes/api.js`
- **Server**: `server/src/server.js`
- **DB**: `server/src/db.js` (MySQL)
- **Email**: `server/src/email.js`
- **reCAPTCHA**: `server/src/recaptcha.js`
- **Image Proxy**: `server/src/imageProxy.js`

## Data Flow

1. Builder submits config to `POST /api/pieces` with reCAPTCHA token.
2. API validates config, inserts row in MySQL, returns ID/slug/admin key.
3. Viewer loads via `GET /api/pieces/:id`.
4. Delete uses `DELETE /api/pieces/:id` with admin key + reCAPTCHA.

## Notes

- All runtime config is in `server/.env`.
- There is no PHP or SQLite in the current stack.
