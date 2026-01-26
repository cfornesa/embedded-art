# Deployment Verification (Node + Express)

Use this checklist after deploying the Node server.

## API Checks

- `GET /api/health` → `{ "ok": true, "driver": "mysql" }`
- `GET /api/recaptcha/site-key` → `{ "siteKey": "..." }`
- `GET /api/pieces/:id` → returns JSON when a piece exists

## Image Proxy

- `GET /api/image-proxy?url=https://example.com/image.jpg` should return an image response

## Frontend Checks

- `https://yourdomain.com/threejs/builder.html` loads
- Create a piece → succeeds with reCAPTCHA
- Delete a piece → succeeds with admin key + reCAPTCHA

## Logs

If you see errors:
- Check `server/.env` values
- Ensure MySQL is reachable
- Confirm reCAPTCHA keys and allowed domains
