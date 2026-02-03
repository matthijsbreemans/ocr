# Unified Docker Compose Configuration

## Overview

This project uses a **single `docker-compose.yml`** file that adapts to both development and production environments through environment variables.

---

## Why Single File?

### ✅ Advantages
- Single source of truth
- No duplicate configuration
- Easy to maintain
- Changes apply everywhere
- Clear separation via environment files
- Less chance of drift between dev/prod

### ❌ Previous Approach (Two Files)
- Had `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod)
- Required maintaining two nearly identical files
- Easy to forget to update both

---

## How It Works

### Development
```bash
# Uses defaults from docker-compose.yml
docker compose up -d
```

**Defaults:**
- No resource limits (8GB max)
- No automatic restarts
- Local PostgreSQL always starts
- Large log files (100MB)
- `NODE_ENV=development`

### Production
```bash
# Uses settings from .env.production
docker compose --env-file .env.production up -d
```

**Production Settings:**
- CPU & memory limits (2-4GB)
- Automatic restarts (`unless-stopped`)
- External database recommended
- Log rotation (10MB, 3 files)
- `NODE_ENV=production`

---

## File Structure

```
project/
├── docker-compose.yml           # Universal config (dev + prod)
├── .env.example                 # Development defaults
├── .env.production.example      # Production template
├── .env                         # Your dev config (git ignored)
└── .env.production              # Your prod config (git ignored)
```

---

## Key Environment Variables

### Control Behavior

```bash
# What environment?
NODE_ENV=development          # or production

# Use local database?
REQUIRE_LOCAL_DB=true         # false for external DB

# Restart on failure?
RESTART_POLICY=no             # or unless-stopped

# Resource limits
API_CPU_LIMIT=2.0
API_MEMORY_LIMIT=2G
```

### Development Defaults (`.env.example`)

```bash
NODE_ENV=development
REQUIRE_LOCAL_DB=true
RESTART_POLICY=no
API_CPU_LIMIT=8.0          # No real limit
LOG_MAX_SIZE=100m          # Large logs
```

### Production Overrides (`.env.production.example`)

```bash
NODE_ENV=production
REQUIRE_LOCAL_DB=false     # Use external DB
RESTART_POLICY=unless-stopped
API_CPU_LIMIT=2.0          # Strict limits
LOG_MAX_SIZE=10m           # Rotate logs
```

---

## Common Scenarios

### 1. Development with Local PostgreSQL (Default)

**Command:**
```bash
docker compose up -d
```

**What Starts:**
- PostgreSQL (local)
- API
- Worker

**Settings:**
- No resource limits
- No restarts
- Large logs

---

### 2. Production with External Database

**`.env.production`:**
```bash
DATABASE_URL=postgresql://user:pass@db.example.com/ocrdb
REQUIRE_LOCAL_DB=false
NODE_ENV=production
RESTART_POLICY=unless-stopped
API_CPU_LIMIT=2.0
API_MEMORY_LIMIT=2G
```

**Command:**
```bash
docker compose --env-file .env.production up -d
```

**What Starts:**
- API (with resource limits & restarts)
- Worker (with resource limits & restarts)
- PostgreSQL does NOT start (external DB)

---

### 3. Production with Turso

**`.env.production`:**
```bash
DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_token
REQUIRE_LOCAL_DB=false
NODE_ENV=production
```

**Command:**
```bash
docker compose --env-file .env.production up -d
```

**What Starts:**
- API
- Worker
- No PostgreSQL

---

### 4. Production with Local PostgreSQL (Not Recommended)

**`.env.production`:**
```bash
DATABASE_URL=postgresql://ocruser:SECURE_PASS@postgres:5432/ocrdb
REQUIRE_LOCAL_DB=true
NODE_ENV=production
POSTGRES_PASSWORD=SECURE_PASS
```

**Command:**
```bash
docker compose --env-file .env.production up -d
```

**What Starts:**
- PostgreSQL (local, with resource limits)
- API
- Worker

---

## Migration from Old Setup

### Before (Two Files)

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

### After (One File)

```bash
# Development
docker compose up -d

# Production
docker compose --env-file .env.production up -d
```

---

## Full Environment Variable Reference

See [PRODUCTION_COMPOSE.md](./PRODUCTION_COMPOSE.md) for complete list of:
- Resource limits (CPU, memory)
- Restart policies
- Health check settings
- Logging configuration
- Database settings
- Scaling options

---

## Best Practices

1. **Never commit** `.env` or `.env.production` to git
2. **Use external database** in production (PostgreSQL or Turso)
3. **Set resource limits** appropriate for your server
4. **Enable health checks** in production
5. **Configure log rotation** to prevent disk fill
6. **Test in staging** with production settings first

---

## Quick Commands

```bash
# Development
docker compose up -d

# Production
docker compose --env-file .env.production up -d

# Production (rebuild)
docker compose --env-file .env.production up -d --build

# Scale workers
docker compose --env-file .env.production up -d --scale worker=3

# View config (debug)
docker compose config
docker compose --env-file .env.production config
```

---

## Related Documentation

- **Production Guide**: [PRODUCTION_COMPOSE.md](./PRODUCTION_COMPOSE.md)
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **External DB**: [docs/EXTERNAL_DATABASE.md](./docs/EXTERNAL_DATABASE.md)
- **Turso Setup**: [docs/TURSO_SETUP.md](./docs/TURSO_SETUP.md)
