# Hostinger Deployment Checklist

## Repository Structure

This repository supports multiple subprojects. The 3D art application is located in the `/threejs/` folder:

```
/
├── threejs/           # 3D Art Application
│   ├── api/
│   ├── app/
│   ├── assets/
│   ├── builder.html
│   └── ...
├── other-project/     # (future subprojects)
└── README.md
```

## Pre-Deployment

- [ ] Create MySQL database in cPanel
- [ ] Note down database credentials:
  - Host: usually `localhost`
  - Database name: e.g., `u123456_artdb`
  - Username: e.g., `u123456_artuser`
  - Password: (from cPanel)

## Step 1: Upload Files

Via FTP or Git, upload all files to `public_html/` except:
- `threejs/app/data/` (SQLite files - not needed)
- `threejs/test_improvements.php` (test file)
- `.git/` (if using FTP)

Your `public_html` should contain:
```
public_html/
├── threejs/
│   ├── .htaccess
│   ├── api/
│   ├── app/
│   ├── assets/
│   ├── builder.html
│   ├── index.php
│   └── ...
└── (other subprojects)
```

## Step 2: Create config.php

**File:** `threejs/app/lib/config.php`

**IMPORTANT:** This file contains sensitive credentials. Never commit it to git! It's already in `.gitignore`.

```php
<?php
return [
  // ================================
  // DATABASE (REQUIRED)
  // ================================
  'DB_DRIVER' => 'mysql',
  'DB_HOST' => 'localhost',  // Try 'localhost' first, then '127.0.0.1' if issues
  'DB_NAME' => 'u123456_artdb',  // Your database name from cPanel
  'DB_USER' => 'u123456_artuser',  // Your database user from cPanel
  'DB_PASS' => 'your_secure_password',  // Your database password

  // ================================
  // EMAIL (OPTIONAL)
  // ================================
  // On Hostinger shared hosting, PHP mail() works by default.
  // You only need SMTP if you want to use an external email service.

  // Option 1: Use Hostinger's mail() (default) - NO SMTP CONFIG NEEDED
  // Just leave the SMTP settings commented out

  // Option 2: Use external SMTP (Gmail, SendGrid, etc.)
  // Uncomment these lines and add your credentials:
  // 'SMTP_HOST' => 'smtp.gmail.com',
  // 'SMTP_PORT' => 587,
  // 'SMTP_USER' => 'your-email@gmail.com',
  // 'SMTP_PASS' => 'your-app-password',

  // ================================
  // CORS (OPTIONAL)
  // ================================
  // Defaults to '*' (allow all origins) if not set.
  // For production, set specific allowed origins (comma-separated string):
  // 'ALLOWED_ORIGINS' => 'https://yourdomain.com,https://www.yourdomain.com',

  // ================================
  // DEBUG ENDPOINTS (OPTIONAL)
  // ================================
  // Enable /api/debug/db endpoint for troubleshooting:
  // 'ENABLE_DEBUG_ENDPOINTS' => '1',
];
```

**Important:** Set file permissions to restrict access:
```bash
chmod 600 threejs/app/lib/config.php  # Only owner can read
```

**Note:** All configuration (database, SMTP, CORS, debug) is now in config.php. No code changes needed between Replit and Hostinger!

## Step 3: Verify BASE_PATH Configuration

The application is configured to run from the `/threejs/` subdirectory. Verify these files have the correct setting:

**PHP** (`threejs/app/lib/base_path.php`):
```php
const BASE_PATH = '/threejs';
```

**JavaScript** (`threejs/assets/js/constants.js`):
```javascript
export const BASE_PATH = '/threejs';
```

## Step 4: Verify .htaccess

Ensure `.htaccess` is uploaded to `threejs/`:
```apache
RewriteEngine On

# Security: block /app from being served
RewriteRule ^app/ - [F,L]

# Allow direct access to image-proxy.php (self-hosted CORS proxy)
RewriteRule ^api/image-proxy\.php$ - [L]

# Pretty API routes: /api/* -> /api/index.php
RewriteRule ^api/(.*)$ api/index.php [L,QSA]

# Disable directory listing
Options -Indexes
```

## Step 5: Test Database Connection

Visit: `https://yourdomain.com/threejs/api/health`

**Expected response:**
```json
{
  "ok": true,
  "driver": "mysql"
}
```

**If you see:**
```json
{
  "ok": true,
  "driver": "sqlite",
  "note": "mysql_failed_fallback_sqlite"
}
```
→ MySQL credentials are wrong or MySQL not reachable, but app still works via SQLite

## Step 6: Verify Schema Created

The schema is created automatically on first connection.

To verify via MySQL CLI:
```sql
SHOW TABLES;
-- Should show: pieces

DESCRIBE pieces;
-- Should show all columns including indexes
```

## Step 7: Test API Endpoints

```bash
# Health check
curl https://yourdomain.com/threejs/api/health

# Create a test piece
curl -X POST https://yourdomain.com/threejs/api/pieces \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-piece",
    "visibility": "public",
    "config": {
      "version": 2,
      "bg": "#000000",
      "shapes": [
        {
          "type": "box",
          "count": 5,
          "size": 1.5,
          "palette": {"baseColor": "#ff0000"},
          "textureUrl": ""
        }
      ]
    }
  }'

# Retrieve the piece
curl https://yourdomain.com/threejs/api/pieces/test-piece
```

## Step 8: Test Builder UI

1. Visit: `https://yourdomain.com/threejs/builder.html`
2. Create a test piece
3. Save the admin key
4. Test embed URLs
5. Test delete functionality

## Step 9: Monitor Logs

Check PHP error log for any issues:
```bash
tail -f /path/to/error_log
```

Look for structured JSON logs from Logger class.

## Step 10: Security Hardening (Optional)

### Force HTTPS (add to threejs/.htaccess):
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Block sensitive files:
```apache
<FilesMatch "\.(env|log|sql|sqlite)$">
  Require all denied
</FilesMatch>
```

---

## Troubleshooting

### Issue: API returns HTML instead of JSON
**Cause:** .htaccess not working
**Fix:**
1. Check mod_rewrite is enabled
2. Allow .htaccess overrides in Apache config
3. Test fallback URL: `/threejs/api/index.php/pieces/1`

### Issue: MySQL connection fails
**Symptom:** `driver: "sqlite"` with fallback note
**Fix:**
1. Verify credentials in config.php
2. Try `DB_HOST => '127.0.0.1'` instead of `localhost`
3. Check MySQL user permissions
4. Test connection: `mysql -h localhost -u user -p database`

### Issue: Rate limiting not working
**Symptom:** Can submit >10 requests/minute
**Cause:** threejs/app/data/rate_limits not writable
**Fix:** `chmod 775 threejs/app/data/rate_limits`

### Issue: Pieces not being created
**Check:**
1. Database connection: `/threejs/api/health`
2. Error logs: Look for validation errors
3. Browser console: Check for CORS errors
4. Try manual curl to isolate frontend vs backend

---

## Platform Differences

The code is **100% platform-agnostic**. All differences are configured via environment variables or `config.php`:

| Configuration | Replit | Hostinger |
|---------------|--------|-----------|
| **Base Path** | `/threejs` | `/threejs` |
| **Database** | SQLite (auto-fallback) | MySQL via config.php |
| **SMTP** | config.php or env vars | config.php or env vars |
| **CORS** | Defaults to `*` | Set ALLOWED_ORIGINS in config.php |
| **Debug endpoints** | Set ENABLE_DEBUG_ENDPOINTS=1 | Set ENABLE_DEBUG_ENDPOINTS=1 |
| **File permissions** | Auto | Manual (`chmod`) |

**No code changes needed between platforms!** Just configure via config.php or environment variables.

---

## Rollback Procedure

If issues occur:

1. **Restore previous code** via FTP/Git
2. **Restore database:**
   ```bash
   mysql -u user -p database < backup.sql
   ```
3. **Check error_log** for root cause
4. **Test in Replit first** before re-deploying

---

## Success Criteria

- [ ] `/threejs/api/health` returns `"driver": "mysql"`
- [ ] Builder can create pieces at `/threejs/builder.html`
- [ ] Viewer displays pieces correctly
- [ ] Delete functionality works
- [ ] Rate limiting active (test with 11 quick requests)
- [ ] No errors in error_log
- [ ] CORS allows your domain
- [ ] HTTPS enforced (if configured)

---

**The code is 100% platform-agnostic and requires ZERO code changes between Replit and Hostinger.** All platform-specific configuration is handled via environment variables or config.php. The same exact codebase runs on both platforms.
