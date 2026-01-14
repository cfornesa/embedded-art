# Embedded Art Platform

A 3D art piece creation and embedding platform built with PHP backend and Three.js frontend. Users can create customizable 3D scenes with multiple geometric shapes, textures, and colors, then embed them anywhere via iframe.

## Repository Structure

This repository supports multiple subprojects. The 3D art application is located in the `/threejs/` folder:

```
/
├── threejs/              # 3D Art Application (main project)
│   ├── api/              # PHP API endpoints
│   ├── app/              # Backend libraries
│   ├── assets/           # Frontend JavaScript
│   ├── builder.html      # Main builder UI
│   └── ...
├── other-project/        # (future subprojects can go here)
├── README.md             # This file
└── HOSTINGER_DEPLOYMENT.md
```

**Access the app at:** `https://yourdomain.com/threejs/builder.html`

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development Guidelines](#development-guidelines)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Multi-Tier Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Client Layer                        │
│  builder.html  │  embed.html  │  delete.html        │
│  (Bootstrap UI) │ (Three.js)   │ (Admin UI)         │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ HTTP/JSON
                  │
┌─────────────────▼───────────────────────────────────┐
│              API Layer (PHP)                         │
│  api/index.php - RESTful routing & HTTP handling    │
└─────────────────┬───────────────────────────────────┘
                  │
                  │
┌─────────────────▼───────────────────────────────────┐
│           Business Logic Layer                       │
│  app/lib/piece.php - Validation & business rules    │
│  app/lib/db.php    - Database abstraction           │
└─────────────────┬───────────────────────────────────┘
                  │
                  │
┌─────────────────▼───────────────────────────────────┐
│           Data Layer                                 │
│  MySQL (production) ←→ SQLite (development)         │
│  Automatic fallback mechanism                       │
└─────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Platform Agnostic**: Runs identically on Replit (dev) and Hostinger (prod) without code changes
2. **Graceful Degradation**: Automatic MySQL → SQLite fallback if database unreachable
3. **Stateless API**: No server-side sessions; all auth via admin keys
4. **Client-Side Rendering**: Heavy lifting done in browser (Three.js)
5. **Configuration as Data**: Pieces stored as JSON blobs for schema flexibility

---

## System Requirements

### Minimum Requirements

**Backend:**
- PHP 8.0+ with extensions:
  - `pdo_mysql` (for production)
  - `pdo_sqlite` (for development)
  - `json`
  - `mbstring`
- Apache 2.4+ with `mod_rewrite` enabled
- MySQL 8.0+ OR SQLite 3.30+

**Frontend:**
- Modern browser with ES6 module support
- WebGL-capable GPU
- JavaScript enabled

### Recommended Environment

- PHP 8.2+
- MySQL 8.0+ with InnoDB engine
- Apache with `.htaccess` support
- HTTPS enabled in production

---

## Installation

### Development Setup (Replit / Local)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd embedded-art
   ```

2. **Set environment variables (optional for dev):**
   ```bash
   export DB_DRIVER=sqlite  # Force SQLite for dev
   ```

3. **Create data directory:**
   ```bash
   mkdir -p threejs/app/data
   chmod 775 threejs/app/data
   ```

4. **Start development server:**
   ```bash
   php -S 0.0.0.0:8000
   ```

5. **Access the builder:**
   Navigate to `http://localhost:8000/threejs/builder.html`

### Production Setup (Hostinger / cPanel)

1. **Upload files via FTP/Git** to public_html

2. **Create MySQL database:**
   - Use hosting control panel to create database
   - Note credentials: host, database name, username, password

3. **Configure database credentials:**

   Create `threejs/app/lib/config.php` (never commit this file):
   ```php
   <?php
   return [
     'DB_DRIVER' => 'mysql',
     'DB_HOST' => 'localhost',
     'DB_NAME' => 'your_database_name',
     'DB_USER' => 'your_database_user',
     'DB_PASS' => 'your_database_password'
   ];
   ```

4. **Set directory permissions:**
   ```bash
   chmod 755 threejs/app/lib
   chmod 600 threejs/app/lib/config.php  # Protect credentials
   chmod 775 threejs/app/data            # For SQLite fallback
   ```

5. **Verify `.htaccess` is active:**
   - Ensure mod_rewrite is enabled
   - Test: `https://your-domain.com/threejs/api/health`

6. **Test database connection:**
   ```bash
   curl https://your-domain.com/threejs/api/health
   # Should return: {"ok":true,"driver":"mysql"}
   ```

---

## Project Structure

```
embedded-art/
├── threejs/                   # Main 3D Art Application
│   ├── api/
│   │   ├── index.php         # API router & endpoint handlers
│   │   └── image-proxy.php   # Self-hosted CORS proxy for textures
│   ├── app/
│   │   ├── lib/
│   │   │   ├── base_path.php # Subdirectory path configuration
│   │   │   ├── db.php        # Database abstraction layer
│   │   │   ├── piece.php     # Validation & business logic
│   │   │   └── config.php    # [GITIGNORED] Production DB credentials
│   │   ├── data/             # [GITIGNORED] SQLite database storage
│   │   └── index.php         # Placeholder (redirects)
│   ├── assets/
│   │   └── js/
│   │       ├── constants.js  # Shared config (BASE_PATH, limits)
│   │       ├── builder.js    # Piece creation UI logic
│   │       ├── viewer.js     # Three.js 3D rendering engine
│   │       ├── edit.js       # Piece editing UI logic
│   │       └── delete.js     # Piece deletion UI logic
│   ├── builder.html          # Main builder interface
│   ├── edit.html             # Edit existing piece
│   ├── embed.html            # Embeddable viewer (iframe target)
│   ├── delete.html           # Admin deletion interface
│   ├── view.html             # Standalone viewer (debug)
│   ├── index.php             # Root redirect to builder
│   └── .htaccess             # Apache rewrite rules & security
├── .gitignore                 # Exclude secrets & runtime files
├── .replit                    # Replit configuration
├── README.md                  # This file
└── HOSTINGER_DEPLOYMENT.md    # Deployment guide
```

### File Responsibilities

| File | Purpose | Key Functions |
|------|---------|---------------|
| `api/index.php` | HTTP routing, request/response handling | `json_in()`, `respond()` |
| `app/lib/db.php` | Database connection, schema management, fallback logic | `pdo_conn()`, `db_health()`, `try_mysql()`, `try_sqlite()` |
| `app/lib/piece.php` | Payload validation, slug generation, admin key generation | `validate_config()`, `generate_slug()`, `generate_admin_key()` |
| `assets/js/builder.js` | Form handling, client-side validation, API calls | `normalizeSlug()`, `validateImageUrl()`, `renderOutput()` |
| `assets/js/viewer.js` | Three.js scene setup, mesh generation, texture loading | `buildFromPiece()`, `makeGeometry()`, `loadTextureFromUrl()` |
| `assets/js/delete.js` | Delete form handling, piece lookup | `lookup()`, form submit handler |

---

## Configuration

### Environment Variables

Set these via `.env`, hosting panel, or export:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_DRIVER` | (auto) | Force driver: `mysql` or `sqlite` |
| `DB_HOST` | - | MySQL hostname (e.g., `localhost`) |
| `DB_NAME` | - | MySQL database name |
| `DB_USER` | - | MySQL username |
| `DB_PASS` | - | MySQL password |
| `ENABLE_DEBUG_ENDPOINTS` | `0` | Set `1` to enable `/api/debug/db` |
| `REPL_ID` | - | Auto-set by Replit (enables debug mode) |

### Database Selection Logic

The system automatically selects the database driver using this decision tree:

```
IF DB_DRIVER=sqlite
  → Use SQLite only (no MySQL attempt)

ELSE IF DB_DRIVER=mysql
  → Try MySQL, fallback to SQLite on failure

ELSE IF MySQL credentials exist
  → Try MySQL, fallback to SQLite on failure

ELSE
  → Use SQLite
```

This ensures **zero-configuration development** (uses SQLite) and **production flexibility** (prefers MySQL with automatic fallback).

### Constants & Limits

**Validation Limits** (defined in `app/lib/piece.php`):
```php
- Slug max length: 60 characters
- URL max length: 2048 characters
- Shape count per type: 0–10 instances
- Total instances across all shapes: ≤40
- Shape size: 0.1–10 units
- Texture data URL: ≤5 MB
- Admin key: 64 hex chars (32 random bytes)
```

**Performance Settings** (in `app/lib/db.php`):
```php
PDO::ATTR_TIMEOUT => 2  // Fast MySQL failure → quick SQLite fallback
```

---

## API Documentation

### Base URL
- Development: `http://localhost:8000/threejs/api`
- Production: `https://your-domain.com/threejs/api`

### Authentication
Admin operations require the `X-Admin-Key` header:
```
X-Admin-Key: <64-char-hex-admin-key>
```

---

### Endpoints

#### `POST /api/pieces`
Create a new piece.

**Request Body:**
```json
{
  "slug": "my-art-piece",           // Optional, auto-generated if omitted
  "visibility": "public",            // "public" | "unlisted" | "deleted"
  "config": {
    "version": 2,
    "bg": "#000000",                // Background color (hex)
    "bgImageUrl": "",               // Optional background image URL
    "cameraZ": 10,                  // Camera distance
    "rotationSpeed": 0.01,          // Rotation speed (-1 to 1)
    "shapes": [
      {
        "type": "box",              // "box" | "sphere" | "cone" | "torus"
        "count": 5,                 // 0-10 instances
        "size": 1.5,                // 0.1-10 units
        "palette": {
          "baseColor": "#ff0000"    // Hex color
        },
        "textureUrl": "https://example.com/texture.png"  // Optional
      }
    ]
  }
}
```

**Response (200 OK):**
```json
{
  "id": 123,
  "slug": "my-art-piece",
  "visibility": "public",
  "adminKey": "a1b2c3d4e5f6..."     // SAVE THIS - required for deletion
}
```

**Errors:**
- `400 Bad Request`: Validation failed (see error message)
- `409 Conflict`: Slug already exists

---

#### `GET /api/pieces/{id|slug}`
Retrieve a piece by numeric ID or slug.

**Example:**
```bash
curl https://your-domain.com/api/pieces/123
curl https://your-domain.com/api/pieces/my-art-piece
```

**Response (200 OK):**
```json
{
  "id": 123,
  "slug": "my-art-piece",
  "visibility": "public",
  "config": { /* full config object */ }
}
```

**Errors:**
- `404 Not Found`: Piece does not exist or is deleted

**Caching:**
- Public pieces: `Cache-Control: public, max-age=3600`
- Unlisted/deleted: `Cache-Control: private, no-cache`
- ETag support for conditional requests

---

#### `PATCH /api/pieces/{id|slug}`
Update piece visibility (soft delete).

**Headers:**
```
X-Admin-Key: <your-admin-key>
```

**Request Body:**
```json
{
  "visibility": "deleted"
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "visibility": "deleted"
}
```

**Errors:**
- `401 Unauthorized`: Missing admin key
- `403 Forbidden`: Invalid admin key
- `404 Not Found`: Piece does not exist

---

#### `DELETE /api/pieces/{id|slug}`
**Permanently delete a piece from the database (hard delete).**

⚠️ **This action is irreversible** - the piece and all its data are completely removed.

**Headers:**
```
X-Admin-Key: <your-admin-key>
```

**Response (200 OK):**
```json
{
  "ok": true,
  "deleted": true
}
```

**What gets deleted:**
- All piece data removed from database
- Slug becomes immediately available for reuse
- Viewer/embed URLs return 404
- No recovery possible

**Errors:**
- `401 Unauthorized`: Missing admin key
- `403 Forbidden`: Invalid admin key
- `404 Not Found`: Piece does not exist

---

#### `GET /api/health`
Check database connectivity (never fails).

**Response (200 OK):**
```json
{
  "ok": true,
  "driver": "mysql",
  "note": "mysql_failed_fallback_sqlite"  // Optional
}
```

If database is unreachable:
```json
{
  "ok": false,
  "driver": "none",
  "error": "MySQL failed: ... | SQLite failed: ..."
}
```

---

#### `GET /api/debug/db` (Development Only)
Debug database configuration. **Only available when:**
- Running on Replit (`REPL_ID` env var exists), OR
- `ENABLE_DEBUG_ENDPOINTS=1` is set

**Response:**
```json
{
  "env": {
    "is_replit": true,
    "php_sapi": "cli-server",
    "available_pdo_drivers": ["mysql", "sqlite"]
  },
  "config": {
    "has_config_php": false,
    "forced_driver": "sqlite",
    "mysql_creds_present": false,
    "sanitized": {
      "DB_DRIVER": "set",
      "DB_HOST": "",
      "DB_NAME": "unset",
      "DB_USER": "unset",
      "DB_PASS": "unset"
    }
  },
  "decision": {
    "ok": true,
    "driver": "sqlite"
  }
}
```

---

## Database Schema

### Table: `pieces`

**MySQL Schema:**
```sql
CREATE TABLE pieces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  slug VARCHAR(60) NOT NULL,
  visibility VARCHAR(12) NOT NULL DEFAULT 'public',
  admin_key VARCHAR(64) NOT NULL,
  config_json LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_slug (slug),
  INDEX idx_visibility (visibility),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**SQLite Schema:**
```sql
CREATE TABLE pieces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'public',
  admin_key TEXT NOT NULL,
  config_json TEXT NOT NULL
);
CREATE INDEX idx_visibility ON pieces(visibility);
CREATE INDEX idx_created_at ON pieces(created_at);
```

**Column Descriptions:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT/BIGINT | Auto-incrementing primary key |
| `created_at` | TIMESTAMP/TEXT | Piece creation timestamp (UTC) |
| `slug` | VARCHAR(60)/TEXT | Human-readable URL identifier (unique) |
| `visibility` | VARCHAR(12)/TEXT | `public` or `unlisted` (pieces are deleted, not marked) |
| `admin_key` | VARCHAR(64)/TEXT | 64-char hex key for auth (SHA-256 strength) |
| `config_json` | LONGTEXT/TEXT | Full piece configuration as JSON |

**Index Strategy:**
- `PRIMARY KEY (id)`: Fast lookups by numeric ID
- `UNIQUE (slug)`: Fast lookups by slug, enforces uniqueness
- `INDEX (visibility)`: Efficient filtering of deleted pieces
- `INDEX (created_at)`: Sorting by creation date

---

## Development Guidelines

### Code Style

**PHP:**
- Use `declare(strict_types=1)` at the top of every file
- Follow PSR-12 coding standards
- Functions: `snake_case`
- Classes: `PascalCase` (if added)
- Constants: `UPPER_SNAKE_CASE`

**JavaScript:**
- ES6 modules with `import`/`export`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Use `const` by default, `let` when reassignment needed
- Prefer template literals over string concatenation

**SQL:**
- Always use prepared statements (PDO)
- Table/column names: `snake_case`
- Keywords in UPPERCASE

### Security Checklist

Before committing code:
- [ ] All user input validated (type, length, format)
- [ ] SQL queries use prepared statements (no string interpolation)
- [ ] Admin keys verified before destructive operations
- [ ] No credentials hardcoded (use environment variables)
- [ ] Error messages don't leak sensitive information
- [ ] HTTPS enforced in production
- [ ] XSS prevention (use `textContent`, not `innerHTML`)

### Adding a New Shape Type

1. **Update validation:**
   ```php
   // app/lib/piece.php:79
   $allowed = ["box", "sphere", "cone", "torus", "cylinder"];  // Add cylinder
   ```

2. **Update frontend constants:**
   ```javascript
   // assets/js/builder.js:27-32
   const SHAPES = [
     // ... existing shapes
     { type: "cylinder", countId: "cylinderCount", ... }
   ];
   ```

3. **Add UI controls in builder.html** (copy existing shape card)

4. **Add geometry generator in viewer.js:**
   ```javascript
   // assets/js/viewer.js:66-75
   case "cylinder":
     return new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 1.2, 24);
   ```

### Testing Checklist

**Manual Tests:**
- [ ] Create piece with all shape types
- [ ] Create piece with custom slug
- [ ] Create piece with auto-generated slug
- [ ] Retrieve piece by ID
- [ ] Retrieve piece by slug
- [ ] Delete piece with correct admin key
- [ ] Delete piece with wrong admin key (should fail)
- [ ] View piece in embed.html
- [ ] Test with MySQL database
- [ ] Test with SQLite fallback (disconnect MySQL)

**Browser Compatibility:**
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

---

## Deployment

### Pre-Deployment Checklist

- [ ] Database credentials in `app/lib/config.php` (not in environment variables)
- [ ] `app/lib/config.php` excluded from git (check `.gitignore`)
- [ ] `app/data/` directory excluded from git
- [ ] `.htaccess` uploaded and active
- [ ] `mod_rewrite` enabled on Apache
- [ ] HTTPS certificate installed
- [ ] Database backups configured
- [ ] Error logging enabled (`error_log` accessible)

### Deployment Steps

1. **Backup current production:**
   ```bash
   mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
   ```

2. **Upload new code** (via Git, FTP, or rsync):
   ```bash
   rsync -avz --exclude 'app/data' --exclude 'app/lib/config.php' ./ user@host:/path/to/public_html/
   ```

3. **Run database migrations** (if schema changed):
   - Currently auto-migrates via `ensure_mysql_schema()`
   - For major changes, write migration scripts

4. **Test critical paths:**
   ```bash
   curl https://your-domain.com/api/health
   curl -X POST https://your-domain.com/api/pieces -d '{"config":{...}}'
   ```

5. **Monitor error logs:**
   ```bash
   tail -f /path/to/error_log
   ```

### Rollback Procedure

1. **Restore code** from previous deployment
2. **Restore database:**
   ```bash
   mysql -u username -p database_name < backup_YYYYMMDD.sql
   ```
3. **Clear cache** (if using Cloudflare/CDN)

---

## Security Considerations

### Critical Security Measures

1. **Admin Key Protection:**
   - Admin keys have 256 bits of entropy (64 hex chars)
   - Never logged or exposed in error messages
   - Transmitted only via `X-Admin-Key` header
   - **User responsibility:** Store securely after piece creation

2. **SQL Injection Prevention:**
   - All queries use PDO prepared statements
   - Never use string interpolation for SQL

3. **XSS Prevention:**
   - Frontend uses `textContent` instead of `innerHTML`
   - API returns `Content-Type: application/json`

4. **CSRF Protection:**
   - Currently **NOT IMPLEMENTED** (API is stateless)
   - Consider adding CSRF tokens for state-changing operations

5. **Rate Limiting:**
   - Currently **NOT IMPLEMENTED**
   - Add IP-based rate limiting for POST endpoints

### Recommended Production Hardening

**Apache Configuration** (`.htaccess` additions):
```apache
# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Block access to sensitive files
<FilesMatch "\.(env|log|sql|sqlite)$">
  Require all denied
</FilesMatch>
```

**PHP Configuration** (`php.ini`):
```ini
expose_php = Off
display_errors = Off
log_errors = On
error_log = /path/to/private/error.log
session.cookie_httponly = 1
session.cookie_secure = 1
```

**Database User Permissions:**
- Grant only `SELECT`, `INSERT`, `UPDATE` (no `DROP`, `ALTER`)
- Use separate user for application vs. admin tasks

---

## Performance Optimization

### Backend Optimizations

1. **Database Indexes:**
   - Ensure `idx_visibility` and `idx_created_at` exist (see schema)

2. **Connection Pooling:**
   - PHP-FPM configuration:
     ```ini
     pm.max_children = 20
     pm.max_requests = 1000
     ```

3. **Opcode Caching:**
   - Enable OPcache:
     ```ini
     opcache.enable=1
     opcache.memory_consumption=128
     opcache.max_accelerated_files=10000
     ```

4. **HTTP Caching:**
   - Public pieces cached for 1 hour (ETag support)
   - CDN recommended (Cloudflare)

### Frontend Optimizations

1. **Asset Optimization:**
   - Minify JavaScript (use Terser)
   - Compress images (serve WebP)
   - Use Brotli compression on Apache

2. **Three.js Optimizations:**
   - Limit max instances to 40 (enforced in validation)
   - Use shared geometries (already implemented)
   - Set `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`

3. **Lazy Loading:**
   - Textures loaded on-demand
   - Embed iframe uses `loading="lazy"`

### Monitoring

**Key Metrics to Track:**
- API response time (target: <200ms)
- Database query time (target: <50ms)
- 3D scene render FPS (target: >30fps)
- Error rate (target: <1%)

**Logging:**
- All errors logged to `error_log`
- Audit trail for piece creation/deletion

---

## Troubleshooting

### Database Connection Issues

**Symptom:** `GET /api/health` returns `"ok": false`

**Diagnosis:**
```bash
curl https://your-domain.com/api/debug/db
```

**Common Fixes:**
1. **MySQL credentials wrong:**
   - Check `app/lib/config.php` or environment variables
   - Test connection: `mysql -h HOST -u USER -p DATABASE`

2. **MySQL not accepting localhost:**
   - Try `DB_HOST=127.0.0.1` instead of `localhost`
   - Already handled in code (db.php:118)

3. **SQLite directory not writable:**
   - Check permissions: `chmod 775 app/data`
   - Verify ownership: `chown www-data:www-data app/data`

### API Returns HTML Instead of JSON

**Symptom:** Viewer shows "API did not return JSON"

**Cause:** Apache not routing `/api/*` to `api/index.php`

**Fix:**
1. Verify `.htaccess` uploaded: `ls -la .htaccess`
2. Check mod_rewrite enabled: `apache2ctl -M | grep rewrite`
3. Allow `.htaccess` overrides in Apache config:
   ```apache
   <Directory /var/www/html>
     AllowOverride All
   </Directory>
   ```
4. Test fallback URL: `/api/index.php/pieces/1`

### Slug Already Exists Error

**Symptom:** `409 Conflict: "Slug already exists"`

**Cause:** Requested slug in use or race condition

**Fix:**
- Use different slug, or
- Leave slug empty to auto-generate, or
- Hard-delete old piece to free up slug

### Piece Shows "Deleted" in Viewer

**Symptom:** Embed shows "This piece was deleted"

**Cause:** Piece visibility set to `deleted`

**Check:**
```bash
curl https://your-domain.com/api/pieces/YOUR_SLUG
# Look for "visibility": "deleted"
```

**Fix:**
- Cannot un-delete (this is intentional)
- Must create new piece

### Textures Not Loading

**Symptom:** 3D shapes render without textures

**Causes:**
1. **CORS blocked:** Texture URL domain doesn't allow cross-origin requests
   - **Fix:** Host textures on same domain or use CORS-enabled CDN

2. **Invalid URL:** Texture URL doesn't end in `.png|.jpg|.jpeg|.webp`
   - **Fix:** Use correct image format

3. **HTTPS mixed content:** Embedding HTTPS page loading HTTP texture
   - **Fix:** Use HTTPS texture URLs

**Debug:**
```javascript
// Check browser console for CORS errors
// viewer.js logs texture load failures
```

---

## Maintenance

### Backup Strategy

**Daily Backups:**
```bash
#!/bin/bash
# Save as backup.sh, run via cron
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u USER -pPASS DATABASE > backup_${DATE}.sql
gzip backup_${DATE}.sql
# Upload to S3/Backblaze
```

**Cron Schedule:**
```cron
0 2 * * * /path/to/backup.sh
```

### Database Optimization

**Run quarterly:**
```sql
OPTIMIZE TABLE pieces;
ANALYZE TABLE pieces;
```

---

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code style guidelines
3. Test locally (both MySQL and SQLite)
4. Commit with descriptive message
5. Push and create pull request

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] No credentials committed
- [ ] Validation added for new inputs
- [ ] Error handling implemented
- [ ] Tested in both MySQL and SQLite
- [ ] Tested in multiple browsers
- [ ] Documentation updated

---

## License

[Specify your license here]

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [your-repo-url]/issues
- Email: [your-contact-email]

---

## Changelog

### v1.0.0 (2024-01-07)
- Initial release
- Multi-shape support (box, sphere, cone, torus)
- MySQL/SQLite dual-database support
- Embed functionality via iframe
- Admin key-based deletion

---

## Appendix: Configuration Examples

### Example 1: Replit Development

**No configuration needed!** Just start the app.
- Uses SQLite automatically
- Database stored in `app/data/pieces.sqlite`

### Example 2: Hostinger Production

**app/lib/config.php:**
```php
<?php
return [
  'DB_DRIVER' => 'mysql',
  'DB_HOST' => 'localhost',
  'DB_NAME' => 'u123456789_artdb',
  'DB_USER' => 'u123456789_artuser',
  'DB_PASS' => 'SecurePassword123!'
];
```

### Example 3: Force SQLite in Production

**app/lib/config.php:**
```php
<?php
return [
  'DB_DRIVER' => 'sqlite'
];
```

### Example 4: Environment Variables Only

**No config.php file needed:**
```bash
export DB_DRIVER=mysql
export DB_HOST=localhost
export DB_NAME=artdb
export DB_USER=artuser
export DB_PASS=password123
```

---

**Last Updated:** 2024-01-07
**Version:** 1.0.0
