# Frequently Asked Questions

## 1. Does DELETE permanently remove pieces from the database?

### Answer: No - It's a Soft Delete

**The DELETE endpoint does NOT permanently remove data.** Instead, it sets the piece's visibility to `'deleted'`.

### What Happens When You Delete:

```php
// api/index.php:283-284
$del = $pdo->prepare("UPDATE pieces SET visibility = 'deleted' WHERE id = :id");
$del->execute([":id" => (int)$ref]);
```

### Database State:

| Field | Before Delete | After Delete |
|-------|--------------|--------------|
| `id` | 123 | 123 (unchanged) |
| `slug` | "my-piece" | "my-piece" (unchanged) |
| `visibility` | "public" | **"deleted"** |
| `config_json` | {...} | {...} (unchanged) |
| `admin_key` | abc123... | abc123... (unchanged) |

### User Experience:

1. **Viewer/Embed** - Shows "This piece was deleted" message
2. **Slug** - Becomes available for reuse (you can create a new piece with same slug)
3. **Database** - Record stays in database for recovery
4. **API** - GET request returns 404 or shows deleted status

### Benefits of Soft Delete:

✅ **Data Recovery** - Can restore accidentally deleted pieces
✅ **Audit Trail** - Know what was deleted and when
✅ **Slug Reuse** - Deleted slugs are freed up for new pieces
✅ **Safety** - No accidental data loss

### How to Permanently Delete (Optional):

If you want to hard-delete old pieces, add this maintenance script:

```sql
-- Run monthly via cron
DELETE FROM pieces
WHERE visibility = 'deleted'
  AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

Or create a cleanup script:

```php
// cleanup_old_pieces.php
require_once 'app/lib/db.php';

$pdo = pdo_conn();
$cutoff = date('c', strtotime('-30 days'));

$stmt = $pdo->prepare("
  DELETE FROM pieces
  WHERE visibility = 'deleted'
    AND created_at < :cutoff
");
$stmt->execute([':cutoff' => $cutoff]);

echo "Deleted " . $stmt->rowCount() . " old pieces\n";
```

---

## 2. Will this code work on both Hostinger AND Replit?

### Answer: Yes - Platform-Agnostic by Design

**The code is specifically designed to work on BOTH platforms without modification.**

### How It Adapts Automatically:

```
┌─────────────────────────────────────────────────────┐
│                    Your Code                        │
│                  (Same Files)                       │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    Replit                Hostinger
        │                     │
        ↓                     ↓
   ┌─────────┐         ┌──────────────┐
   │ SQLite  │         │ MySQL        │
   │ (auto)  │         │ (configured) │
   └─────────┘         └──────────────┘
```

### Platform Detection Logic (app/lib/db.php):

```php
function pdo_conn(): PDO {
  $cfg = load_config();

  // Decision tree:
  if (has_mysql_creds($cfg)) {
    try {
      return try_mysql($cfg);      // Hostinger: MySQL
    } catch {
      return try_sqlite();         // Fallback: SQLite
    }
  }

  return try_sqlite();             // Replit: SQLite
}
```

### Environment Configurations:

#### Replit (Development)
```bash
# NO CONFIGURATION NEEDED!
# Just push and run
```

**What happens:**
- No MySQL credentials found
- Automatically uses SQLite
- Database: `app/data/pieces.sqlite`
- CORS: Wide open (`*`)
- Debug endpoints: Enabled
- Rate limiting: Skipped

#### Hostinger (Production)

**Create:** `app/lib/config.php`
```php
<?php
return [
  'DB_DRIVER' => 'mysql',
  'DB_HOST' => 'localhost',
  'DB_NAME' => 'u123456_artdb',
  'DB_USER' => 'u123456_artuser',
  'DB_PASS' => 'your_password'
];
```

**What happens:**
- MySQL credentials found
- Connects to MySQL database
- Falls back to SQLite if MySQL fails
- CORS: Specific domains only
- Debug endpoints: Disabled
- Rate limiting: Active

### Complete Compatibility Matrix:

| Feature | Replit | Hostinger | Code Changes? |
|---------|--------|-----------|---------------|
| **Database** | SQLite | MySQL | ❌ None |
| **Schema** | Auto-created | Auto-created | ❌ None |
| **Config file** | Optional | Required | ✅ Create config.php |
| **CORS** | Wide open | Restricted | ✅ Update origins |
| **Fallback** | N/A | MySQL→SQLite | ❌ Automatic |
| **API routes** | Works | Works | ❌ None |
| **Frontend** | Works | Works | ❌ None |
| **Indexes** | Created | Created | ❌ Automatic |

### Migration Path (Replit → Hostinger):

```bash
# 1. Export data from Replit SQLite
sqlite3 app/data/pieces.sqlite .dump > export.sql

# 2. Convert to MySQL format (if needed)
sed 's/AUTOINCREMENT/AUTO_INCREMENT/g' export.sql > mysql_import.sql

# 3. Import to Hostinger MySQL
mysql -u user -p database < mysql_import.sql

# 4. Create config.php on Hostinger

# 5. Done! Same code, new database
```

### Testing Both Environments:

```bash
# Test Replit
curl https://your-replit.repl.co/api/health
# {"ok":true,"driver":"sqlite"}

# Test Hostinger
curl https://yourdomain.com/api/health
# {"ok":true,"driver":"mysql"}
```

**See HOSTINGER_DEPLOYMENT.md for complete deployment checklist.**

---

## 3. What happens if a user enters an existing slug?

### Answer: ✅ Form Data Preserved + Clear Error

**The form data is completely preserved and the user gets a helpful error message with the slug field auto-focused.**

### User Flow:

```
Step 1: User fills out form
┌─────────────────────────────────────┐
│ Slug: awesome-art                   │
│ Background: #000000                 │
│ Box count: 5                        │
│ Box size: 1.5                       │
│ Box color: #ff0000                  │
│ Sphere count: 3                     │
│ Sphere size: 2.0                    │
│ [Generate]                          │
└─────────────────────────────────────┘

Step 2: Click Generate
┌─────────────────────────────────────┐
│ Creating…                           │
│ [Generate] (disabled)               │
└─────────────────────────────────────┘

Step 3: Server responds with conflict
Backend (api/index.php:116-119):
  if (slug already exists) {
    respond(409, "Slug already exists...")
  }

Step 4: Error displayed, form preserved
┌─────────────────────────────────────┐
│ ⚠️ Slug already exists. Please try  │
│ again or choose a different slug.   │
│ Your form data has been preserved - │
│ just change the slug above and try  │
│ again.                              │
│                                     │
│ Slug: [awesome-art] ← FOCUSED       │
│ Background: #000000   ← PRESERVED   │
│ Box count: 5          ← PRESERVED   │
│ Box size: 1.5         ← PRESERVED   │
│ Box color: #ff0000    ← PRESERVED   │
│ Sphere count: 3       ← PRESERVED   │
│ Sphere size: 2.0      ← PRESERVED   │
│ [Generate] ← RE-ENABLED             │
└─────────────────────────────────────┘

Step 5: User edits slug and retries
┌─────────────────────────────────────┐
│ Slug: awesome-art-v2 ← Changed      │
│ Background: #000000   ← Still there │
│ Box count: 5          ← Still there │
│ [Generate] ← Click again            │
└─────────────────────────────────────┘

Step 6: Success!
┌─────────────────────────────────────┐
│ ✅ Created successfully.            │
│ Admin key: abc123...                │
│ Embed code: <iframe...>             │
└─────────────────────────────────────┘
```

### Technical Implementation:

**Frontend (assets/js/builder.js:532-546):**
```javascript
if (!res.ok) {
  // Special handling for slug conflicts (409)
  if (res.status === 409 && data.error && data.error.includes("Slug")) {
    setMsg(`⚠️ ${data.error} Your form data has been preserved...`, "warning");

    // Auto-focus slug field for easy editing
    if (slugEl) {
      slugEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      slugEl.focus();
      slugEl.select();  // Text is selected for quick replacement
    }
  }
  return;  // ← Does NOT clear form data
}
```

**The `finally` block ensures button is re-enabled:**
```javascript
} finally {
  if (generateBtn) generateBtn.disabled = false;  // Always re-enable
}
```

### What Gets Preserved:

✅ Slug field (with text selected)
✅ Background color
✅ Background image URL
✅ All shape counts (box, sphere, cone, torus)
✅ All shape sizes
✅ All shape colors
✅ All texture URLs

### What Changes:

- ⚠️ Error message appears
- 🎯 Slug field gets focus
- ✏️ Slug text is selected (ready to type over)
- 📜 Page scrolls to slug field
- 🔄 Generate button re-enabled

### Edge Cases Handled:

1. **Multiple rapid clicks:**
   - Button disabled during request
   - Re-enabled only after response
   - Prevents duplicate submissions

2. **Network errors:**
   - Form data preserved
   - Clear error message shown
   - Button re-enabled

3. **Non-JSON responses:**
   - Gracefully handled
   - Debugging info available
   - Form data preserved

4. **Empty slug (auto-generated):**
   - Server generates unique slug
   - No conflict possible
   - Creates successfully

### Why This UX is Good:

1. **No data loss** - User doesn't have to re-enter everything
2. **Clear guidance** - Message tells user exactly what to do
3. **Auto-focus** - Cursor jumps to problem field
4. **Text selected** - Easy to type new slug immediately
5. **Visual feedback** - Error in warning color (not red/danger)
6. **Recoverable** - Can retry immediately

### Alternative: Leave Slug Empty

If user leaves slug blank, server auto-generates a unique one:
```javascript
const slug = $slug || generate_slug();  // "piece-a3f9c2"
```
This **never conflicts** because it uses random bytes.

---

## Additional FAQs

### Q: Can I recover a soft-deleted piece?

**A:** Yes! The data is still in the database. You can manually change `visibility` back to `public`:

```sql
UPDATE pieces
SET visibility = 'public'
WHERE id = 123;
```

### Q: What if MySQL fails on Hostinger?

**A:** The code automatically falls back to SQLite. You'll see:
```json
{
  "ok": true,
  "driver": "sqlite",
  "note": "mysql_failed_fallback_sqlite"
}
```

The app continues working seamlessly.

### Q: How do I test both databases locally?

**Replit (SQLite):**
```bash
# No config needed, just run
php -S localhost:8000
```

**Hostinger-like (MySQL):**
```bash
# Create config.php with MySQL credentials
php -S localhost:8000
# App will use MySQL
```

### Q: Can I disable rate limiting for testing?

**A:** Yes, it's automatically disabled on Replit. For manual override:
```php
// In app/lib/rate_limit.php:32
if (getenv("REPL_ID") || getenv("DISABLE_RATE_LIMIT")) {
  return;  // Skip rate limiting
}
```

Then set: `export DISABLE_RATE_LIMIT=1`

### Q: What happens if I create a piece with a slug, delete it, then create another with the same slug?

**A:** ✅ Works fine!

1. Create `my-piece` → slug used
2. Delete `my-piece` → slug freed up
3. Create `my-piece` again → slug reused
4. New piece gets new ID, new admin key
5. Old piece stays in DB as `visibility='deleted'`

---

## Support

For more detailed information:
- **Architecture:** See `README.md`
- **Implementation:** See `IMPROVEMENTS_SUMMARY.md`
- **Deployment:** See `HOSTINGER_DEPLOYMENT.md`
- **Code Review:** Original review in git history
