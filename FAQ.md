# Frequently Asked Questions (Node + Express)

## 1. Does DELETE permanently remove pieces from the database?

**Yes — it is a hard delete.** The record is removed from MySQL immediately.

In the API route (`server/src/routes/api.js`), after admin key validation, the row is deleted with a `DELETE FROM pieces` query. The slug becomes immediately available for reuse.

**Implications:**
- Viewer/embed returns 404 after deletion
- Slug is freed immediately
- Recovery is not possible

## 2. Will this work on Hostinger and locally?

**Yes, as long as Node.js and MySQL are available.**

- Local: run the Express server (`server/src/server.js`) and point it at your MySQL instance.
- Hostinger: use a plan that supports Node.js or a VPS.

There is no PHP or SQLite fallback in this version.

## 3. Why am I getting `Missing MySQL configuration`?

Set these in `server/.env`:
- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

## 4. Why is create/delete failing with reCAPTCHA?

Ensure you have:
- `RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`

Also confirm the client can reach `/api/recaptcha/site-key` and that the domain is whitelisted in your Google reCAPTCHA settings.
