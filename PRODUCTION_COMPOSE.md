# Production Docker Compose Guide

## Overview

This project uses a **single `docker-compose.yml`** file that works for both development and production environments. The behavior is controlled via environment variables.

---

## Quick Start

### Development (Default)

```bash
# Uses default values (no resource limits, no restarts)
docker compose up -d
```

### Production

```bash
# 1. Create production environment file
cp .env.production.example .env.production
nano .env.production  # Edit with your settings

# 2. Deploy with production settings
docker compose --env-file .env.production up -d

# 3. Check status
docker compose ps
```

---

## Key Differences: Dev vs Prod

| Feature | Development | Production |
|---------|-------------|------------|
| Environment file | `.env` (optional) | `.env.production` (required) |
| Resource limits | None (8GB max) | CPU & Memory limits (2-4GB) |
| Health checks | Optional | Enabled |
| Restart policy | `no` | `unless-stopped` |
| Log rotation | 100MB, 1 file | 10MB, 3 files |
| Database | Local PostgreSQL | External DB recommended |
| NODE_ENV | development | production |

---

## Production Deployment Options

### Option 1: External Database (Recommended)

**`.env.production`:**
```bash
# External PostgreSQL
DATABASE_URL="postgresql://user:pass@db.example.com:5432/ocrdb?sslmode=require"
DB_PROFILE=none  # Don't start postgres

# Application
APP_DOMAIN="https://ocrtools.com"
NODE_ENV="production"

# Production settings
RESTART_POLICY=unless-stopped
API_CPU_LIMIT=2.0
API_MEMORY_LIMIT=2G
WORKER_CPU_LIMIT=4.0
WORKER_MEMORY_LIMIT=4G
```

**Deploy:**
```bash
docker compose --env-file .env.production up -d
# Only starts: api, worker (no postgres, because DB_PROFILE=none)
```

### Option 2: Turso / LibSQL

**`.env.production`:**
```bash
# Turso
DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your_token_here"
DB_PROFILE=none  # Don't start postgres

# Application
APP_DOMAIN="https://ocrtools.com"
NODE_ENV="production"

# Production settings
RESTART_POLICY=unless-stopped
```

**Deploy:**
```bash
docker compose --env-file .env.production up -d
```

### Option 3: Local PostgreSQL (Not Recommended for Production)

**`.env.production`:**
```bash
# Local PostgreSQL
DATABASE_URL="postgresql://ocruser:SECURE_PASSWORD@postgres:5432/ocrdb"
DB_PROFILE=default  # Start postgres

# PostgreSQL settings
POSTGRES_PASSWORD="SECURE_PASSWORD"
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_CPU_LIMIT=2.0
POSTGRES_MEMORY_LIMIT=2G

# Application
APP_DOMAIN="https://ocrtools.com"
NODE_ENV="production"
```

**Deploy:**
```bash
docker compose --env-file .env.production up -d
# Starts: postgres, api, worker
```

---

## Environment Variables

### Required for Production

```bash
DATABASE_URL="..."              # Your database connection string
APP_DOMAIN="https://..."        # Your domain (for status URLs)
NODE_ENV="production"           # Set to production
```

### Database Control

```bash
DB_PROFILE=default              # default=start postgres, none=don't start postgres
```

**Values:**
- `default` - PostgreSQL always starts (for local DB)
- `none` - PostgreSQL doesn't start (for external DB)
- Omit - Uses default profile (starts postgres)

### Resource Limits

```bash
# PostgreSQL
POSTGRES_CPU_LIMIT=2.0
POSTGRES_MEMORY_LIMIT=2G
POSTGRES_CPU_RESERVE=0.5
POSTGRES_MEMORY_RESERVE=512M

# API Server
API_CPU_LIMIT=2.0
API_MEMORY_LIMIT=2G
API_CPU_RESERVE=0.5
API_MEMORY_RESERVE=512M

# Worker (OCR is CPU intensive)
WORKER_CPU_LIMIT=4.0
WORKER_MEMORY_LIMIT=4G
WORKER_CPU_RESERVE=1.0
WORKER_MEMORY_RESERVE=1G
```

### Restart & Recovery

```bash
RESTART_POLICY=unless-stopped   # no|always|on-failure|unless-stopped
RESTART_CONDITION=on-failure
RESTART_DELAY=5s
RESTART_MAX_ATTEMPTS=3
RESTART_WINDOW=120s
```

### Health Checks

```bash
DISABLE_HEALTHCHECK=false
HEALTHCHECK_INTERVAL=30s
HEALTHCHECK_TIMEOUT=10s
HEALTHCHECK_RETRIES=3
API_START_PERIOD=40s
WORKER_START_PERIOD=30s
```

### Logging

```bash
LOG_DRIVER=json-file
LOG_MAX_SIZE=10m                # Dev: 100m, Prod: 10m
LOG_MAX_FILE=3                  # Dev: 1, Prod: 3
```

### Scaling

```bash
WORKER_REPLICAS=1               # Number of worker instances
```

---

## Common Commands

### Deploy

```bash
# Development
docker compose up -d

# Production
docker compose --env-file .env.production up -d

# Production (rebuild)
docker compose --env-file .env.production up -d --build
```

### Scale Workers

```bash
# Scale to 3 workers
docker compose --env-file .env.production up -d --scale worker=3

# Or set in .env.production:
WORKER_REPLICAS=3
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail 100
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart worker only
docker compose restart worker
```

### Stop & Remove

```bash
# Stop all
docker compose down

# Stop and remove volumes (⚠️ DELETES DATA)
docker compose down -v
```

### Update Deployment

```bash
# Pull latest code
git pull

# Rebuild images
docker compose --env-file .env.production build --no-cache

# Deploy with zero downtime
docker compose --env-file .env.production up -d --force-recreate --no-deps api worker
```

---

## Monitoring

### Check Health

```bash
# Container health
docker compose ps

# API health
curl https://your-domain.com/api/admin/stats

# Resource usage
docker stats
```

### View Metrics

```bash
# Container stats
docker compose ps --format json | jq

# Logs with timestamps
docker compose logs -f --timestamps
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker compose logs

# Check health status
docker compose ps

# Restart services
docker compose restart
```

### Out of Resources

```bash
# Check current usage
docker stats

# Increase limits in .env.production:
API_CPU_LIMIT=4.0
API_MEMORY_LIMIT=8G
```

### Database Connection Failed

```bash
# If using external DB, test connection
docker compose run --rm api npx prisma db execute --stdin <<< "SELECT 1"

# Check DATABASE_URL is correct
docker compose config | grep DATABASE_URL
```

---

## Production Checklist

Before deploying:

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Set `DATABASE_URL` (external or Turso recommended)
- [ ] Set `APP_DOMAIN` to your actual domain
- [ ] Change all default passwords
- [ ] Set `DB_PROFILE=none` (if using external DB) or `DB_PROFILE=default` (if using local DB)
- [ ] Configure resource limits for your server
- [ ] Set `RESTART_POLICY=unless-stopped`
- [ ] Review health check settings
- [ ] Set up SSL/HTTPS (via NGINX reverse proxy)
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Set up monitoring/alerting
- [ ] Test deployment in staging first
- [ ] DO NOT commit `.env.production` to git!

---

## Related Documentation

- **Full Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **External Database**: [docs/EXTERNAL_DATABASE.md](./docs/EXTERNAL_DATABASE.md)
- **Turso Setup**: [docs/TURSO_SETUP.md](./docs/TURSO_SETUP.md)
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
