# Changelog: Unified Docker Compose

## What Changed

### Before
- **Two files**: `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod)
- Needed to specify `-f docker-compose.prod.yml` for production
- Duplicate configuration across two files
- Easy to forget to update both files

### After
- **Single file**: `docker-compose.yml` (universal)
- Environment-driven behavior via `.env` and `.env.production`
- Single source of truth
- Easier to maintain

---

## Breaking Changes

### Development (No Changes)

```bash
# Still works the same
docker compose up -d
```

### Production (Command Changed)

**Before:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

**After:**
```bash
docker compose --env-file .env.production up -d
```

---

## Migration Steps

### 1. Delete Old Production File

```bash
rm docker-compose.prod.yml  # Already done
```

### 2. Create Production Environment

```bash
# Copy template
cp .env.production.example .env.production

# Edit with your settings
nano .env.production
```

**Required settings:**
```bash
DATABASE_URL="postgresql://..."    # Your database
APP_DOMAIN="https://..."           # Your domain
NODE_ENV="production"
REQUIRE_LOCAL_DB=false             # If using external DB
RESTART_POLICY=unless-stopped
```

### 3. Update Deployment Commands

**Old:**
```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart worker
```

**New:**
```bash
docker compose --env-file .env.production up -d
docker compose logs -f
docker compose restart worker
```

Note: After `up`, you don't need `--env-file` for other commands since the containers remember their config.

---

## Files Changed

### New Files
- `DOCKER_COMPOSE_UNIFIED.md` - Explains the unified approach
- `.env.production.example` - Production environment template (updated)

### Modified Files
- `docker-compose.yml` - Now universal (supports dev + prod)
- `.env.example` - Updated for development defaults
- `PRODUCTION_COMPOSE.md` - Updated for single-file approach
- `QUICK_START.md` - Updated production commands
- `README.md` - Added new documentation links

### Deleted Files
- `docker-compose.prod.yml` - No longer needed

---

## Key Benefits

1. **Single Source of Truth**
   - All configuration in one file
   - Changes apply everywhere

2. **Environment-Driven**
   - Development: Uses sensible defaults
   - Production: Override via `.env.production`

3. **Easier Maintenance**
   - No duplicate config
   - Update once, works everywhere

4. **Clear Separation**
   - Development: `.env` (optional)
   - Production: `.env.production` (required)

5. **Standard Practice**
   - Common pattern in Docker projects
   - Easy for new developers to understand

---

## Environment File Comparison

### Development (`.env` or defaults)
```bash
NODE_ENV=development
REQUIRE_LOCAL_DB=true
RESTART_POLICY=no
API_CPU_LIMIT=8.0              # No real limit
LOG_MAX_SIZE=100m
```

### Production (`.env.production`)
```bash
NODE_ENV=production
REQUIRE_LOCAL_DB=false         # Use external DB
RESTART_POLICY=unless-stopped
API_CPU_LIMIT=2.0              # Strict limits
API_MEMORY_LIMIT=2G
LOG_MAX_SIZE=10m
LOG_MAX_FILE=3
```

---

## What Stays the Same

- Development workflow unchanged
- Same services (api, worker, postgres)
- Same ports
- Same database schema
- Same features

---

## Rollback (If Needed)

If you need to rollback:

1. Restore `docker-compose.prod.yml` from git history
2. Use old commands with `-f docker-compose.prod.yml`

However, the new approach is recommended.

---

## Documentation

See these guides for more info:

- [DOCKER_COMPOSE_UNIFIED.md](./DOCKER_COMPOSE_UNIFIED.md) - Full explanation
- [PRODUCTION_COMPOSE.md](./PRODUCTION_COMPOSE.md) - Production config guide
- [QUICK_START.md](./QUICK_START.md) - Quick commands
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide

---

## Questions?

**Q: Do I need to rebuild?**
A: No, existing deployments keep running. Use new approach on next deploy.

**Q: Can I still use local database in production?**
A: Yes, set `REQUIRE_LOCAL_DB=true` and `DATABASE_URL=postgresql://...@postgres:5432/...`

**Q: What if I don't create `.env.production`?**
A: It uses defaults from `docker-compose.yml` (not recommended for prod)

**Q: Can I customize resource limits?**
A: Yes, set `API_CPU_LIMIT`, `WORKER_MEMORY_LIMIT`, etc. in `.env.production`
