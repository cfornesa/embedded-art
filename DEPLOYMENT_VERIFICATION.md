# Deployment Verification Checklist

This document verifies that the application is correctly configured for both Replit and Hostinger deployments.

## File Structure

```
/embedded-art/
├── app/
│   └── lib/
│       └── config.php              # Shared configuration (SMTP, DB, CORS)
├── threejs/                        # Main application directory
│   ├── .htaccess                   # Apache routing (Hostinger only)
│   ├── api/
│   │   ├── index.php               # API endpoint handler
│   │   └── image-proxy.php         # CORS proxy for images
│   ├── app/
│   │   ├── data/                   # SQLite database (Replit)
│   │   └── lib/
│   │       ├── base_path.php       # BASE_PATH constant
│   │       ├── constants.php       # PHP constants
│   │       ├── db.php              # Database connection
│   │       ├── logger.php          # Logging
│   │       ├── piece.php           # Piece validation & email
│   │       └── rate_limit.php      # Rate limiting
│   ├── assets/
│   │   └── js/
│   │       ├── builder.js          # Creation form
│   │       ├── constants.js        # JavaScript constants (BASE_PATH)
│   │       ├── delete.js           # Deletion form
│   │       ├── edit.js             # Edit form
│   │       └── viewer.js           # 3D viewer
│   ├── builder.html                # Creation page
│   ├── delete.html                 # Deletion page
│   ├── edit.html                   # Edit page
│   ├── embed.html                  # Embeddable viewer
│   ├── index.php                   # Redirects to builder.html
│   ├── test_email.php              # Email diagnostic tool
│   └── view.html                   # Viewer page
└── router.php                      # PHP built-in server router (Replit only)
```

## Configuration Verification

### 1. BASE_PATH Configuration

**File: `/threejs/app/lib/base_path.php`**
```php
const BASE_PATH = '/threejs';
```

**File: `/threejs/assets/js/constants.js`**
```javascript
export const BASE_PATH = '/threejs';
```

✅ Both files must have matching BASE_PATH values.

### 2. Config File Loading

All application files load from: `/app/lib/config.php`

**Files loading config:**
- `/threejs/api/index.php` → `../../app/lib/config.php`
- `/threejs/app/lib/db.php` → `../../../app/lib/config.php`
- `/threejs/app/lib/piece.php` → `../../../app/lib/config.php`

✅ All paths resolve to shared config file at repository root.

### 3. API Routing

**Replit (router.php):**
- Request: `/threejs/api/pieces/piece-1`
- router.php strips `/threejs` prefix
- api/index.php receives: `/api/pieces/piece-1`

**Hostinger (.htaccess):**
- Request: `/threejs/api/pieces/piece-1`
- .htaccess rewrites to: `/threejs/api/index.php`
- api/index.php receives: `/threejs/api/pieces/piece-1`
- api/index.php strips `/threejs` prefix
- Processes: `/api/pieces/piece-1`

✅ Both environments correctly route to `/api/pieces/piece-1`

## Deployment Instructions

### Replit Deployment

1. **Ensure router.php exists** at repository root
2. **Verify .replit configuration:**
   ```
   run = "php -S 0.0.0.0:8000 -t . router.php"
   ```
3. **Configure SMTP in `/app/lib/config.php`:**
   ```php
   'SMTP_HOST' => 'smtp.gmail.com',
   'SMTP_USER' => 'your-email@gmail.com',
   'SMTP_PASS' => 'your-app-password',
   ```
4. **Database:** Automatically uses SQLite at `/threejs/app/data/pieces.sqlite`

### Hostinger Deployment

1. **Upload entire repository** to hosting directory
2. **Set document root** to repository root (not /threejs/)
3. **Configure MySQL in `/app/lib/config.php`:**
   ```php
   'DB_DRIVER' => 'mysql',
   'DB_HOST' => 'localhost',
   'DB_NAME' => 'your_database',
   'DB_USER' => 'your_username',
   'DB_PASS' => 'your_password',
   ```
4. **Email:** PHP `mail()` works natively (no SMTP config needed if domain email configured)
5. **Verify .htaccess:** Ensure `/threejs/.htaccess` is uploaded and working

## Testing Checklist

### ✅ Basic Functionality
- [ ] Homepage loads: `/threejs/index.php` or `/threejs/builder.html`
- [ ] Create piece: Fill form, submit, receive admin key
- [ ] View piece: `/threejs/view.html?id=piece-slug`
- [ ] Edit piece: `/threejs/edit.html` with admin key
- [ ] Delete piece: `/threejs/delete.html` with admin key

### ✅ API Endpoints
- [ ] GET `/threejs/api/health` → Returns database status
- [ ] GET `/threejs/api/pieces/{slug}` → Returns piece configuration
- [ ] POST `/threejs/api/pieces` → Creates new piece
- [ ] PUT `/threejs/api/pieces/{slug}` → Updates piece (with admin key)
- [ ] DELETE `/threejs/api/pieces/{slug}` → Deletes piece (with admin key)

### ✅ Email Notifications
- [ ] Create piece → Receive email with admin key
- [ ] Edit piece → Receive email with updated configuration
- [ ] Delete piece → Receive email confirming deletion

Run email diagnostic: `php threejs/test_email.php`

### ✅ CORS & External Images
- [ ] External images load via CORS proxy
- [ ] Same-origin images load directly
- [ ] Fallback to proxy on CORS failure

### ✅ Database
- [ ] **Replit:** SQLite file created at `/threejs/app/data/pieces.sqlite`
- [ ] **Hostinger:** MySQL connection successful
- [ ] Pieces persist after creation
- [ ] Edits persist immediately

## Troubleshooting

### Issue: 404 on API Requests

**Symptom:** `{"error":"Not found"}` when viewing pieces

**Solution:**
1. Verify BASE_PATH in `api/index.php` matches your deployment
2. Check `.htaccess` is uploaded and working (Hostinger)
3. Verify `router.php` is in `.replit` command (Replit)

### Issue: No Emails Sent

**Symptom:** Pieces created but no email received

**Solution:**
1. Run `php threejs/test_email.php`
2. Configure SMTP in `/app/lib/config.php`
3. For Gmail: Use App Password, not regular password

### Issue: Database Connection Failed

**Symptom:** 500 errors, pieces not saving

**Solution Replit:**
1. Verify `/threejs/app/data/` directory exists and is writable
2. Check SQLite extension is enabled

**Solution Hostinger:**
1. Verify MySQL credentials in `/app/lib/config.php`
2. Check database exists and user has permissions
3. Test connection: `/threejs/api/health`

### Issue: External Images Not Loading

**Symptom:** Textures show as black/missing

**Solution:**
1. Check browser console for CORS errors
2. Verify CORS proxy is working: `/threejs/api/image-proxy.php`
3. Ensure image URLs are valid and accessible

## Security Checklist

- [x] `/app/lib/config.php` in `.gitignore` (credentials protected)
- [x] `/app` directory blocked by `.htaccess` (cannot be accessed via web)
- [x] Rate limiting enabled on POST endpoints
- [x] Admin keys are 64-char secure random strings
- [x] SQL injection prevention via PDO prepared statements
- [x] XSS prevention via proper HTML escaping
- [x] CORS configured for allowed origins only
- [x] Path traversal protection in router.php

## Performance Optimization

- [x] ETag caching for public pieces (1 hour TTL)
- [x] must-revalidate ensures immediate edit visibility
- [x] Texture anisotropy limited to reasonable values
- [x] API responses use proper HTTP caching headers
- [x] Static assets can be cached aggressively

## Version Information

- PHP Version: 7.4+ required
- Three.js Version: 0.160.0
- Database: SQLite (Replit) / MySQL (Hostinger)
- Web Server: PHP built-in (Replit) / Apache (Hostinger)
