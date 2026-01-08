# Embedded Art Platform - Project Overview

## Project Description
A 3D art embedding platform that allows users to create, edit, and share interactive 3D scenes using Three.js. Users can configure shapes, textures, backgrounds, and camera settings through a visual builder, then embed their creations anywhere via iframe.

---

## File Structure

```
embedded-art/
├── index.php                    # Landing page / gallery
├── builder.html                 # Create new 3D pieces
├── view.html                    # View individual pieces
├── edit.html                    # Edit existing pieces (requires admin key)
├── delete.html                  # Delete pieces (requires admin key)
├── embed.html                   # Embeddable iframe version (no UI chrome)
│
├── api/
│   └── index.php               # RESTful API (all CRUD operations)
│
├── app/
│   ├── index.php               # Redirects to root index.php
│   └── lib/
│       ├── config.php          # Platform-agnostic configuration (MySQL, SMTP, CORS)
│       ├── constants.php       # Global constants (timeouts, limits)
│       ├── db.php              # Database abstraction (MySQL/SQLite)
│       ├── logger.php          # Error logging system
│       ├── piece.php           # Business logic (email notifications, validation)
│       └── rate_limit.php      # API rate limiting
│
└── assets/
    └── js/
        ├── constants.js        # Shared frontend constants (API_BASE_URL)
        ├── builder.js          # Builder page logic (create pieces)
        ├── viewer.js           # 3D rendering engine (Three.js)
        ├── edit.js             # Edit page logic (update pieces)
        └── delete.js           # Delete page logic (remove pieces)
```

---

## Architecture Overview

### **Frontend** (HTML + JavaScript + Three.js)
- Users interact with HTML pages (builder, view, edit, delete)
- JavaScript makes API calls to backend
- Three.js renders 3D scenes in WebGL canvas

### **Backend** (PHP + MySQL/SQLite)
- RESTful API handles all data operations
- Database stores piece configurations as JSON
- Admin keys provide ownership authentication
- Email notifications sent for create/edit/delete operations

### **Data Flow**
1. User creates piece in builder → POST /api/pieces → Database insert → Email sent
2. User views piece → GET /api/pieces/{slug} → Render with Three.js
3. User edits piece → PATCH /api/pieces/{slug} → Database update → Email sent
4. User deletes piece → DELETE /api/pieces/{slug} → Database delete → Email sent

---

## Detailed File Pseudocode

---

## 🌐 FRONTEND PAGES

### **index.php** (Landing Page)
```
PSEUDOCODE:
  REDIRECT to builder.html
  # Future: could display gallery of public pieces
```

**Purpose**: Entry point to the application

---

### **builder.html** (Create New Pieces)
```
PSEUDOCODE:
  DISPLAY form:
    - Email input (required for notifications)
    - Background color picker
    - Background image URL input
    - Shape configuration (type, count, size, color, texture)
    - Camera settings (position, rotation speed)
    - Visibility toggle (public/private)

  ON form submit:
    VALIDATE all inputs
    BUILD configuration JSON object
    POST to /api/pieces with config
    RECEIVE response with slug and admin_key
    REDIRECT to view.html?id={slug}
    EMAIL sent to user with admin key and embed codes
```

**Purpose**: Visual builder for creating 3D art pieces

**Key Features**:
- Real-time preview using viewer.js
- Multiple shape types (sphere, cube, torus, etc.)
- Texture and background image support
- Generates unique slug and admin key on creation

---

### **view.html** (View Individual Pieces)
```
PSEUDOCODE:
  READ query parameter: ?id={slug}

  FETCH piece from GET /api/pieces/{slug}

  IF piece found:
    LOAD viewer.js with configuration
    RENDER 3D scene in canvas
    DISPLAY piece metadata (slug, created date)
    SHOW edit/delete links
  ELSE:
    DISPLAY "Piece not found" error
```

**Purpose**: Display a single 3D piece with navigation chrome

**URL Pattern**: `view.html?id=neon-1`

---

### **embed.html** (Embeddable Version)
```
PSEUDOCODE:
  READ query parameter: ?id={slug}

  FETCH piece from GET /api/pieces/{slug}

  IF piece found:
    LOAD viewer.js with configuration
    RENDER 3D scene in canvas (fullscreen, no UI)
  ELSE:
    DISPLAY minimal error

  # No navigation, no chrome - pure 3D content for iframe embedding
```

**Purpose**: Stripped-down version for iframe embedding

**URL Pattern**: `embed.html?id=neon-1`

**Usage**: `<iframe src="https://art.augmenthumankind.com/embed.html?id=neon-1">`

---

### **edit.html** (Edit Existing Pieces)
```
PSEUDOCODE:
  READ query parameters: ?id={slug}&key={admin_key}

  FETCH piece from GET /api/pieces/{slug}

  DISPLAY form pre-filled with existing configuration:
    - All fields from builder (background, shapes, camera)

  ON form submit:
    VALIDATE all inputs
    BUILD updated configuration JSON
    PATCH to /api/pieces/{slug} with admin_key in header

    IF admin_key valid:
      UPDATE database
      EMAIL sent to user with updated config
      REDIRECT to view.html?id={slug}
    ELSE:
      DISPLAY "Invalid admin key" error (403)
```

**Purpose**: Modify existing pieces (requires authentication)

**URL Pattern**: `edit.html?id=neon-1&key={admin_key}`

**Security**: Admin key validated server-side

---

### **delete.html** (Delete Pieces)
```
PSEUDOCODE:
  READ query parameters: ?id={slug}&key={admin_key}

  FETCH piece from GET /api/pieces/{slug}

  DISPLAY confirmation dialog:
    - Show piece slug
    - "Are you sure?" warning

  ON confirm:
    DELETE to /api/pieces/{slug} with admin_key in header

    IF admin_key valid:
      DELETE from database
      EMAIL sent to user with deleted config
      REDIRECT to builder.html
    ELSE:
      DISPLAY "Invalid admin key" error (403)
```

**Purpose**: Remove pieces permanently (requires authentication)

**URL Pattern**: `delete.html?id=neon-1&key={admin_key}`

**Security**: Admin key validated server-side

---

## 🎨 FRONTEND JAVASCRIPT

### **assets/js/constants.js**
```
PSEUDOCODE:
  EXPORT API_BASE_URL:
    IF on Replit domain:
      RETURN "https://replit-domain/api"
    ELSE IF on Hostinger domain:
      RETURN "https://art.augmenthumankind.com/api"
    ELSE:
      RETURN "/api" (relative)
```

**Purpose**: Platform-agnostic API endpoint configuration

**Why Important**: Same code works on Replit (dev) and Hostinger (prod)

---

### **assets/js/builder.js**
```
PSEUDOCODE:
  INITIALIZE form with default values:
    background = black
    shapes = [one sphere with default settings]
    camera = {z: 10, rotationSpeed: 0.01}

  SETUP event listeners:
    - Add shape button → adds new shape to config
    - Remove shape button → removes shape from config
    - Color pickers → updates config
    - Texture URL inputs → updates config
    - Preview button → renders preview with viewer.js

  ON submit:
    VALIDATE:
      - Email is valid format
      - At least one shape configured
      - All URLs are valid (if provided)

    BUILD config object:
      config = {
        bg: backgroundColor,
        bgImageUrl: backgroundImageUrl,
        shapes: [
          {type, count, size, palette: {baseColor}, textureUrl}
        ],
        cameraZ: cameraPosition,
        rotationSpeed: rotationSpeed
      }

    POST /api/pieces with {email, config, visibility}

    ON success:
      EXTRACT {slug, admin_key} from response
      REDIRECT to view.html?id={slug}

    ON error:
      DISPLAY error message to user
```

**Purpose**: Form logic for creating new pieces

**Key Responsibilities**:
- Form validation
- Configuration object construction
- API communication
- Preview rendering

---

### **assets/js/viewer.js**
```
PSEUDOCODE:
  IMPORT Three.js library

  FUNCTION initViewer(canvasId, config):
    CREATE Three.js scene
    CREATE camera with perspective projection
    CREATE WebGL renderer

    # Background setup
    IF config.bgImageUrl exists:
      LOAD texture from URL
      SET scene.background = texture
    ELSE:
      SET renderer clear color = config.bg

    # Shape generation
    FOR EACH shape in config.shapes:
      CREATE geometry based on shape.type (sphere, cube, torus, etc.)

      IF shape.textureUrl exists:
        LOAD texture from URL
        CREATE material with texture
      ELSE:
        CREATE material with base color

      FOR i = 1 to shape.count:
        CREATE mesh with geometry and material
        RANDOMIZE position in 3D space
        RANDOMIZE rotation
        ADD mesh to scene

    # Camera setup
    SET camera.position.z = config.cameraZ

    # Lighting
    ADD ambient light (soft, all-around)
    ADD directional light (from top-right)

    # Animation loop
    FUNCTION animate():
      REQUEST next animation frame

      FOR EACH mesh in scene:
        ROTATE mesh.x by config.rotationSpeed
        ROTATE mesh.y by config.rotationSpeed

      RENDER scene with camera

    START animation loop

  EXPORT initViewer
```

**Purpose**: Three.js rendering engine (the heart of the 3D visualization)

**Key Responsibilities**:
- Scene setup (camera, lights, renderer)
- Background rendering (color or image)
- Shape generation with random positioning
- Texture loading and application
- Animation loop (continuous rotation)

**Used By**: builder.html (preview), view.html, embed.html

---

### **assets/js/edit.js**
```
PSEUDOCODE:
  READ URL parameters: slug, admin_key

  FETCH piece from GET /api/pieces/{slug}

  IF piece found:
    POPULATE form fields with existing config:
      - Background color → color picker
      - Background image URL → text input
      - Camera settings → number inputs
      - Shapes → dynamically create shape forms
      - For each shape:
        - Type → dropdown
        - Count → number input
        - Size → number input
        - Color → color picker
        - Texture URL → text input

  SETUP event listeners (same as builder.js):
    - Add/remove shapes
    - Preview button
    - Form inputs

  ON submit:
    VALIDATE all inputs

    BUILD updated config object

    PATCH /api/pieces/{slug} with:
      HEADERS: X-Admin-Key = admin_key
      BODY: {config, visibility}

    ON success:
      REDIRECT to view.html?id={slug}

    ON error (403):
      DISPLAY "Invalid admin key" error

    ON error (other):
      DISPLAY generic error message
```

**Purpose**: Form logic for editing existing pieces

**Key Differences from builder.js**:
- Pre-populates form with existing data
- Uses PATCH instead of POST
- Sends admin key in request header
- Handles 403 authentication errors

---

### **assets/js/delete.js**
```
PSEUDOCODE:
  READ URL parameters: slug, admin_key

  FETCH piece from GET /api/pieces/{slug}

  DISPLAY piece info:
    - Slug
    - Created date
    - "Are you sure?" warning

  ON confirm button click:
    DELETE /api/pieces/{slug} with:
      HEADERS: X-Admin-Key = admin_key

    ON success:
      DISPLAY "Piece deleted successfully"
      REDIRECT to builder.html after 2 seconds

    ON error (403):
      DISPLAY "Invalid admin key" error

    ON error (404):
      DISPLAY "Piece not found" error
```

**Purpose**: Deletion confirmation and execution

**Security**: Admin key required, validated server-side

---

## ⚙️ BACKEND API

### **api/index.php** (RESTful API)
```
PSEUDOCODE:
  LOAD configuration from app/lib/config.php
  LOAD database connection from app/lib/db.php
  LOAD business logic from app/lib/piece.php

  SET CORS headers based on ALLOWED_ORIGINS config
  SET security headers (X-Content-Type-Options, X-Frame-Options)

  HANDLE OPTIONS requests (preflight):
    RESPOND 204 No Content

  PARSE request:
    method = GET | POST | PATCH | DELETE
    path = /api/pieces or /api/pieces/{ref}

  # ===== CREATE PIECE =====
  IF POST /api/pieces:
    CHECK rate limit for IP address
    PARSE JSON body: {email, config, visibility}

    VALIDATE:
      - Email is valid format
      - Config has required fields (bg, shapes, camera)
      - Visibility is "public" or "private"

    GENERATE unique slug (adjective-noun-number)
    GENERATE random admin_key (64-char hex)

    INSERT into database:
      slug, visibility, admin_key, email, config_json, created_at

    SEND email notification with:
      - Admin key (for future edits/deletes)
      - View URL
      - Edit URL
      - Delete URL
      - Embed codes (iframe, direct link)
      - Full configuration details

    RESPOND 201 Created:
      {id, slug, admin_key, config}

  # ===== READ PIECE =====
  IF GET /api/pieces/{ref}:
    WHERE ref = slug OR id

    QUERY database for piece

    IF not found:
      RESPOND 404 Not Found

    IF piece.visibility = "public":
      SET Cache-Control: public, max-age=3600
      SET ETag based on config hash

      IF client has matching ETag:
        RESPOND 304 Not Modified
    ELSE:
      SET Cache-Control: private, no-cache

    RESPOND 200 OK:
      {id, slug, visibility, config}

  # ===== UPDATE PIECE =====
  IF PATCH /api/pieces/{ref}:
    WHERE ref = slug OR id

    READ admin_key from X-Admin-Key header
    PARSE JSON body: {config, visibility}

    QUERY database for piece

    IF not found:
      RESPOND 404 Not Found

    IF admin_key != stored admin_key:
      RESPOND 403 Forbidden "Invalid admin key"

    VALIDATE new config (same as create)

    UPDATE database:
      SET config_json = new_config
      SET visibility = new_visibility

    SEND email notification with:
      - Updated configuration details
      - View URL

    RESPOND 200 OK:
      {id, slug, visibility, config}

  # ===== DELETE PIECE =====
  IF DELETE /api/pieces/{ref}:
    WHERE ref = slug OR id

    READ admin_key from X-Admin-Key header

    QUERY database for piece

    IF not found:
      RESPOND 404 Not Found

    IF admin_key != stored admin_key:
      RESPOND 403 Forbidden "Invalid admin key"

    FETCH email and config before deletion

    DELETE from database WHERE id = piece.id

    SEND email notification with:
      - Deleted configuration (for records)
      - Confirmation of deletion

    RESPOND 200 OK:
      {success: true}

  # ===== LIST PIECES (Gallery - future feature) =====
  IF GET /api/pieces:
    QUERY database WHERE visibility = "public"
    ORDER BY created_at DESC
    LIMIT 50

    RESPOND 200 OK:
      [{id, slug, config}]

  # ===== HEALTH CHECK =====
  IF GET /api/health:
    CHECK database connection
    RESPOND 200 OK:
      {status: "healthy", database: "mysql|sqlite"}

  # ===== ERROR HANDLING =====
  CATCH all exceptions:
    LOG error details
    RESPOND 500 Internal Server Error:
      {error: "message"}
```

**Purpose**: Complete REST API for all CRUD operations

**Key Features**:
- RESTful routing (GET/POST/PATCH/DELETE)
- Admin key authentication for write operations
- Email notifications for all operations
- Rate limiting to prevent abuse
- Caching for performance (1-hour cache for public pieces)
- Platform-agnostic (works on Replit and Hostinger)

**Authentication Model**:
- No user accounts (stateless)
- Admin key = ownership proof
- Admin key sent via email on creation
- Key required for edit/delete operations

---

## 📚 BACKEND LIBRARIES

### **app/lib/config.php**
```
PSEUDOCODE:
  RETURN configuration array:
    # Database (MySQL for production)
    DB_DRIVER = "mysql"
    DB_HOST = "localhost"
    DB_NAME = "database_name"
    DB_USER = "database_user"
    DB_PASS = "database_password"

    # SMTP (for email notifications)
    SMTP_HOST = "smtp.example.com"
    SMTP_PORT = 587
    SMTP_USER = "email@example.com"
    SMTP_PASS = "smtp_password"

    # CORS (allow both Replit and Hostinger domains)
    ALLOWED_ORIGINS = "https://replit.dev,https://art.augmenthumankind.com"

    # Debug endpoints (enable for development)
    ENABLE_DEBUG_ENDPOINTS = true
```

**Purpose**: Platform-agnostic configuration

**Why Important**:
- Same code runs on Replit (SQLite) and Hostinger (MySQL)
- Comment out DB config on Replit (uses SQLite)
- Uncomment DB config on Hostinger (uses MySQL)
- No code changes needed between environments

---

### **app/lib/constants.php**
```
PSEUDOCODE:
  DEFINE global constants:
    DB_TIMEOUT_SECONDS = 5           # Database connection timeout
    MAX_CONFIG_SIZE_KB = 512         # Maximum JSON config size
    RATE_LIMIT_REQUESTS = 100        # Max requests per hour per IP
    RATE_LIMIT_WINDOW_MINUTES = 60   # Rate limit time window
    EMAIL_FROM = "noreply@augmenthumankind.com"
    EMAIL_FROM_NAME = "Embedded Art Platform"
```

**Purpose**: Application-wide constants

---

### **app/lib/db.php**
```
PSEUDOCODE:
  FUNCTION load_config():
    READ environment variables (DB_DRIVER, DB_HOST, etc.)
    IF config.php exists:
      MERGE config.php values with environment variables
    RETURN merged config

  FUNCTION has_mysql_creds(config):
    RETURN true IF DB_HOST, DB_NAME, DB_USER are set

  FUNCTION try_mysql(config):
    ATTEMPT connection to MySQL database:
      TRY host = config.DB_HOST
      IF host = "localhost", also TRY host = "127.0.0.1"

      CREATE PDO connection with:
        - DSN: mysql:host={host};dbname={name};charset=utf8mb4
        - Timeout: 5 seconds (fast fail)
        - Error mode: exceptions

      CALL ensure_mysql_schema(pdo)
      RETURN pdo connection

    IF connection fails:
      THROW exception

  FUNCTION try_sqlite():
    CHECK if SQLite PDO driver available

    SET database path = app/data/pieces.sqlite

    IF app/data directory not writable:
      THROW exception

    CREATE PDO connection to SQLite file

    CALL ensure_sqlite_schema(pdo)
    RETURN pdo connection

  FUNCTION ensure_mysql_schema(pdo):
    CREATE TABLE IF NOT EXISTS pieces (
      id BIGINT UNSIGNED AUTO_INCREMENT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      slug VARCHAR(60) UNIQUE,
      visibility VARCHAR(12) DEFAULT 'public',
      admin_key VARCHAR(64),
      email VARCHAR(255) DEFAULT '',
      config_json LONGTEXT,
      PRIMARY KEY (id),
      INDEX (slug),
      INDEX (visibility),
      INDEX (created_at),
      INDEX (email)
    )

    # Migration: Add email column if it doesn't exist
    IF email column missing:
      ALTER TABLE pieces ADD COLUMN email VARCHAR(255) DEFAULT ''

  FUNCTION ensure_sqlite_schema(pdo):
    CREATE TABLE IF NOT EXISTS pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT,
      slug TEXT UNIQUE,
      visibility TEXT DEFAULT 'public',
      admin_key TEXT,
      email TEXT DEFAULT '',
      config_json TEXT
    )

    CREATE indexes on visibility, created_at, email

    # Migration: Add email column if it doesn't exist
    IF email column missing:
      ALTER TABLE pieces ADD COLUMN email TEXT DEFAULT ''

  FUNCTION pdo_conn():
    STATIC connection (singleton pattern)

    IF connection already exists:
      RETURN existing connection

    LOAD config

    IF should try MySQL first:
      TRY MySQL connection
      IF MySQL fails:
        FALLBACK to SQLite
    ELSE:
      USE SQLite

    RETURN connection

  FUNCTION db_health():
    ATTEMPT database connection
    RETURN {ok: true/false, driver: "mysql"|"sqlite"}
```

**Purpose**: Database abstraction layer

**Key Features**:
- Platform-agnostic (MySQL or SQLite)
- Automatic fallback (MySQL fails → SQLite)
- Schema auto-creation
- Migration support (adds email column to existing databases)
- Singleton pattern (one connection per request)

**Development vs Production**:
- **Replit (dev)**: Uses SQLite (no config needed)
- **Hostinger (prod)**: Uses MySQL (configured in config.php)

---

### **app/lib/piece.php**
```
PSEUDOCODE:
  FUNCTION generate_slug():
    adjectives = ["neon", "cosmic", "digital", "crystal", ...]
    nouns = ["wave", "sphere", "vortex", "prism", ...]

    adjective = random choice from adjectives
    noun = random choice from nouns
    number = random 1-9999

    RETURN "{adjective}-{noun}-{number}"

  FUNCTION generate_admin_key():
    GENERATE 32 random bytes
    CONVERT to hexadecimal string (64 characters)
    RETURN hex string

  FUNCTION validate_email(email):
    CHECK format using filter_var(FILTER_VALIDATE_EMAIL)
    RETURN true/false

  FUNCTION validate_config(config):
    CHECK config has required keys:
      - bg (background color)
      - shapes (array of shape objects)
      - cameraZ (camera position)
      - rotationSpeed (animation speed)

    FOR EACH shape in config.shapes:
      CHECK shape has:
        - type (sphere, cube, torus, etc.)
        - count (number of instances)
        - size (scale)
        - palette.baseColor (color hex)

    IF any validation fails:
      THROW exception with error message

    RETURN true

  FUNCTION format_config_for_email(config):
    BUILD human-readable text:
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      CONFIGURATION DETAILS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      BACKGROUND:
      • Color: {config.bg}
      • Image URL: {config.bgImageUrl or "(none)"}

      SHAPES:
      • {shape.type}
        - Number of shapes: {shape.count}
        - Size: {shape.size}
        - Base color: {shape.palette.baseColor}
        - Texture URL: {shape.textureUrl or "(none)"}

      CAMERA:
      • Position Z: {config.cameraZ}
      • Rotation speed: {config.rotationSpeed}

    RETURN formatted text

  FUNCTION send_piece_created_email(email, pieceId, slug, adminKey, config):
    BUILD email message:
      Subject: "Your 3D Art Piece '{slug}' Has Been Created"

      Body:
        Success message

        ADMIN KEY (save this!): {adminKey}

        LINKS:
        • View: https://art.augmenthumankind.com/view.html?id={slug}
        • Edit: https://art.augmenthumankind.com/edit.html?id={slug}&key={adminKey}
        • Delete: https://art.augmenthumankind.com/delete.html?id={slug}&key={adminKey}

        EMBED CODES:
        <iframe src="https://art.augmenthumankind.com/embed.html?id={slug}" ...>

        {formatted configuration}

    SEND email via SMTP
    RETURN success/failure

  FUNCTION send_piece_updated_email(email, pieceId, slug, config):
    BUILD email message:
      Subject: "Your 3D Art Piece '{slug}' Has Been Updated"

      Body:
        Update confirmation

        View URL: https://art.augmenthumankind.com/view.html?id={slug}

        {formatted configuration}

    SEND email via SMTP
    RETURN success/failure

  FUNCTION send_piece_deleted_email(email, pieceId, slug, config):
    BUILD email message:
      Subject: "Your 3D Art Piece '{slug}' Has Been Deleted"

      Body:
        Deletion confirmation

        {formatted configuration before deletion}

        (You can recreate this piece using the configuration above)

    SEND email via SMTP
    RETURN success/failure

  FUNCTION send_email_via_smtp(to, subject, body):
    LOAD SMTP config (host, port, user, pass)

    CONNECT to SMTP server on port 587
    SEND EHLO command
    SEND STARTTLS command (upgrade to encrypted connection)
    SEND AUTH LOGIN command with username/password
    SEND MAIL FROM command
    SEND RCPT TO command
    SEND DATA command
    SEND email headers and body
    SEND quit command
    CLOSE connection

    RETURN success/failure
```

**Purpose**: Business logic and utilities

**Key Functions**:
- Slug generation (human-readable IDs)
- Admin key generation (cryptographically secure)
- Email validation
- Configuration validation
- Email sending (native SMTP, no library dependencies)

**Email Notifications**:
- **Created**: Admin key, all URLs, embed codes, config
- **Updated**: Confirmation, view URL, updated config
- **Deleted**: Confirmation, config before deletion (for rebuilding)

---

### **app/lib/rate_limit.php**
```
PSEUDOCODE:
  FUNCTION check_rate_limit(ip_address):
    cache_dir = app/data/rate_limits
    cache_file = cache_dir + md5(ip_address) + ".json"

    IF cache directory not writable:
      LOG warning
      RETURN (fail open - don't block user if cache fails)

    IF cache_file exists:
      LOAD data = {requests: [], blocked_until}

      IF blocked_until > now:
        THROW exception "Rate limit exceeded"
    ELSE:
      INITIALIZE data = {requests: [], blocked_until: null}

    # Remove requests older than 1 hour
    FILTER data.requests to keep only recent requests

    # Add current request
    ADD current timestamp to data.requests

    # Check if limit exceeded
    IF count(data.requests) > MAX_REQUESTS (100):
      SET data.blocked_until = now + 1 hour
      SAVE data to cache_file
      THROW exception "Rate limit exceeded"

    # Save updated request log
    SAVE data to cache_file

    RETURN (request allowed)

  FUNCTION cleanup_rate_limit_cache():
    FOR EACH file in app/data/rate_limits:
      IF file is older than 24 hours:
        DELETE file
```

**Purpose**: Prevent API abuse

**How It Works**:
- Tracks requests per IP address
- Stores in JSON files (one per IP)
- Limit: 100 requests per hour
- Block duration: 1 hour
- Auto-cleanup: Removes old files after 24 hours

**Fail-Open Policy**: If cache system fails, allow the request (don't block legitimate users)

---

### **app/lib/logger.php**
```
PSEUDOCODE:
  CLASS Logger:
    STATIC FUNCTION error(message, context):
      LOG to error_log with [ERROR] prefix
      INCLUDE timestamp, message, context data

    STATIC FUNCTION warning(message, context):
      LOG to error_log with [WARNING] prefix
      INCLUDE timestamp, message, context data

    STATIC FUNCTION info(message, context):
      LOG to error_log with [INFO] prefix
      INCLUDE timestamp, message, context data
```

**Purpose**: Structured logging

**Usage**: `Logger::error('database_connection_failed', ['host' => 'localhost'])`

---

## 🔐 Security Features

### **Authentication**
- **Admin Keys**: 64-character hex strings (256 bits of entropy)
- **No Sessions**: Stateless authentication (key required for each operation)
- **No Passwords**: Email-based delivery of admin keys

### **Authorization**
- **Ownership Model**: Admin key = ownership proof
- **Edit Protection**: PATCH requires matching admin key (403 if invalid)
- **Delete Protection**: DELETE requires matching admin key (403 if invalid)

### **Input Validation**
- Email format validation
- Configuration schema validation
- URL validation (backgrounds and textures)
- JSON size limits (512KB max)

### **Rate Limiting**
- 100 requests per hour per IP
- Prevents brute-force attacks on admin keys
- Prevents database spam

### **CORS**
- Configured allowed origins (Replit + Hostinger)
- Preflight request handling
- Prevents unauthorized cross-origin requests

### **Security Headers**
- `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
- `X-Frame-Options: SAMEORIGIN` (clickjacking protection)
- `Referrer-Policy: strict-origin-when-cross-origin` (privacy)

### **SQL Injection Prevention**
- PDO prepared statements (parameterized queries)
- No string concatenation in SQL

---

## 🎯 Key Interview Points

### **1. Architecture Decision: Why No User Accounts?**
- **Simplicity**: No registration, login, password reset flows
- **Privacy**: No personal data stored beyond email
- **Stateless**: Admin key = ownership proof (can be shared)
- **Use Case**: Designed for quick art creation, not long-term management

### **2. Why Admin Keys Instead of Sessions?**
- **Shareable Links**: Edit/delete URLs can be bookmarked or shared
- **No Server State**: No session storage, scales horizontally
- **Email Delivery**: Key sent immediately after creation
- **Security Trade-off**: If key is lost, piece cannot be edited (acceptable for this use case)

### **3. Why Both MySQL and SQLite?**
- **Development Speed**: SQLite works immediately on Replit (no config)
- **Production Scale**: MySQL for Hostinger (better performance, shared hosting standard)
- **Platform Agnostic**: Same code runs on both environments
- **Automatic Fallback**: If MySQL unavailable, falls back to SQLite

### **4. Why 1-Hour Cache?**
- **Performance**: Reduces database load for popular pieces
- **Cost**: Fewer queries = lower hosting costs
- **Acceptable Trade-off**: Art pieces rarely change after creation
- **Override**: Users can hard refresh (Ctrl+F5) to see immediate updates

### **5. Why Three.js?**
- **WebGL Rendering**: Hardware-accelerated 3D graphics in browser
- **No Plugins**: Works in all modern browsers
- **Rich Ecosystem**: Easy to add shapes, textures, lighting
- **Performance**: Smooth animations at 60 FPS

### **6. Why Email Notifications?**
- **Admin Key Delivery**: Must send key securely to user
- **Configuration Backup**: Users can rebuild pieces from email
- **Audit Trail**: Record of all create/edit/delete operations
- **No Dashboard Needed**: Email provides all necessary information

---

## 🚀 Deployment Flow

### **Development (Replit)**
```
1. Code is pushed to Replit
2. SQLite database auto-created in app/data/
3. No config.php needed (uses defaults)
4. Access at https://replit-domain.replit.dev
```

### **Production (Hostinger)**
```
1. Create MySQL database in cPanel
2. Run CREATE TABLE SQL in phpMyAdmin
3. Update app/lib/config.php with database credentials
4. Upload files via FTP/File Manager
5. Access at https://art.augmenthumankind.com
```

### **Zero-Downtime Deployment**
- Database fallback ensures site stays up even if MySQL fails
- Caching means most requests don't hit database
- No sessions = no state to preserve during deployment

---

## 📊 Data Flow Examples

### **Example 1: Create a Piece**
```
1. User fills form on builder.html
2. JavaScript builds config JSON:
   {
     bg: "#000000",
     bgImageUrl: "https://example.com/stars.jpg",
     shapes: [
       {type: "sphere", count: 50, size: 1.2, palette: {baseColor: "#00ff00"}}
     ],
     cameraZ: 10,
     rotationSpeed: 0.01
   }
3. POST /api/pieces with {email, config, visibility: "public"}
4. API generates slug = "neon-sphere-1234"
5. API generates admin_key = "6f094bb3af20bc0e..."
6. API inserts into database
7. API sends email to user with admin key and URLs
8. API responds with {slug, admin_key}
9. Browser redirects to view.html?id=neon-sphere-1234
10. view.html fetches piece via GET /api/pieces/neon-sphere-1234
11. viewer.js renders 3D scene with config
```

### **Example 2: View a Piece**
```
1. User visits view.html?id=neon-sphere-1234
2. JavaScript extracts slug = "neon-sphere-1234"
3. GET /api/pieces/neon-sphere-1234
4. API checks cache (ETag)
5. If cached and not modified → 304 Not Modified (no body)
6. If not cached or modified → 200 OK with piece data
7. JavaScript receives {id, slug, visibility, config}
8. viewer.js initializes Three.js scene:
   - Loads background image texture
   - Creates 50 sphere meshes with green color
   - Positions camera at z=10
   - Starts animation loop (rotates shapes at 0.01 speed)
9. Canvas displays animated 3D scene
```

### **Example 3: Edit a Piece**
```
1. User clicks edit link from email
2. Browser opens edit.html?id=neon-sphere-1234&key=6f094bb3af20bc0e...
3. JavaScript fetches piece via GET /api/pieces/neon-sphere-1234
4. Form pre-fills with existing config
5. User changes background color to #FF0000
6. User submits form
7. PATCH /api/pieces/neon-sphere-1234
   Headers: X-Admin-Key: 6f094bb3af20bc0e...
   Body: {config: {...updated config...}}
8. API verifies admin key matches database
9. If valid → Update database, send email, respond 200 OK
10. If invalid → Respond 403 Forbidden "Invalid admin key"
11. Browser redirects to view.html?id=neon-sphere-1234
12. Note: Cache may still serve old version for up to 1 hour
```

### **Example 4: Embed a Piece**
```
1. User receives embed code in creation email:
   <iframe src="https://art.augmenthumankind.com/embed.html?id=neon-sphere-1234"
           width="800" height="600" frameborder="0"></iframe>
2. User pastes iframe code into their website/blog
3. When page loads, iframe requests embed.html?id=neon-sphere-1234
4. embed.html fetches piece (same as view.html)
5. viewer.js renders 3D scene in iframe
6. No navigation chrome, just pure 3D content
7. Piece is interactive (can rotate with mouse if enabled)
```

---

## 🧪 Testing Strategy

### **Manual Testing Checklist**
- [ ] Create piece → Receive email with admin key
- [ ] View piece → 3D renders correctly
- [ ] Edit piece with correct key → Updates successfully
- [ ] Edit piece with wrong key → 403 error
- [ ] Delete piece with correct key → Removed successfully
- [ ] Delete piece with wrong key → 403 error
- [ ] Embed piece → Renders in iframe
- [ ] Hard refresh after edit → Shows updated config
- [ ] Background image → Displays correctly
- [ ] Texture on shapes → Displays correctly

### **Edge Cases to Test**
- Very long URLs (background/texture)
- Invalid email format
- Duplicate slug generation (retry logic)
- Rate limit exceeded (100+ requests)
- Cache behavior (1-hour expiry)
- MySQL unavailable (fallback to SQLite)

---

## 🔧 Maintenance & Troubleshooting

### **Common Issues**

**1. "Invalid admin key" Error**
- **Cause**: Admin key from email doesn't match database
- **Solution**: User must use key from creation email (not from older versions)
- **Prevention**: Keys are tied to piece creation event (re-creating with same slug generates new key)

**2. Changes Not Showing After Edit**
- **Cause**: Browser cache (1-hour TTL)
- **Solution**: Hard refresh (Ctrl+F5) or wait up to 1 hour
- **Note**: This is expected behavior for performance

**3. Email Not Received**
- **Cause**: SMTP credentials incorrect or email blocked as spam
- **Solution**: Check spam folder, verify SMTP config in app/lib/config.php
- **Debug**: Check PHP error_log for SMTP errors

**4. Database Connection Failed**
- **Cause**: MySQL credentials incorrect or server unavailable
- **Solution**: System automatically falls back to SQLite
- **Check**: Visit /api/health to see current database driver

**5. 3D Scene Not Rendering**
- **Cause**: Invalid texture URL or WebGL not supported
- **Solution**: Check browser console for errors, verify URLs are accessible
- **Fallback**: Remove texture URL to use solid colors only

### **Monitoring**
- Check `/api/health` endpoint for database status
- Review PHP error_log for exceptions
- Monitor rate limit cache size (app/data/rate_limits)
- Check SQLite database size (app/data/pieces.sqlite)

### **Scaling Considerations**
- **Current**: Single server, file-based rate limiting, SQLite fallback
- **Future**: Redis for rate limiting, CDN for static assets, dedicated MySQL server
- **Database**: SQLite works up to ~100K pieces, then migrate fully to MySQL
- **Caching**: 1-hour cache handles high traffic (most requests never hit database)

---

## 📝 Summary for Interviews

**Elevator Pitch**:
"I built a 3D art embedding platform using Three.js for rendering, PHP for the backend API, and a hybrid MySQL/SQLite database. Users can create interactive 3D scenes through a visual builder, then embed them anywhere via iframe. The system uses admin keys for authentication instead of user accounts, making it stateless and easily shareable. I implemented 1-hour caching for performance, email notifications for all operations, and designed the entire platform to be platform-agnostic so the same codebase runs on both development (Replit with SQLite) and production (Hostinger with MySQL) without any code changes."

**Technical Highlights**:
- ✅ RESTful API with full CRUD operations
- ✅ Stateless authentication via admin keys
- ✅ Platform-agnostic database layer (MySQL/SQLite)
- ✅ Three.js 3D rendering with textures and animations
- ✅ Email notifications with native SMTP (no dependencies)
- ✅ Rate limiting to prevent abuse
- ✅ HTTP caching with ETag for performance
- ✅ CORS configuration for cross-origin embedding
- ✅ Security headers and input validation
- ✅ Zero-configuration deployment on Replit

**Design Philosophy**:
- **Simplicity First**: No user accounts, no complex authentication
- **Performance**: 1-hour cache, optimized database queries
- **Security**: Admin keys, rate limiting, input validation
- **Portability**: Same code on dev and prod
- **User Experience**: Email contains everything user needs (no dashboard required)
