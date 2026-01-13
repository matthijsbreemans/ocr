# Quick Start Guide

## 🚀 Development (Local)

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after changes
docker compose build --no-cache
docker compose up -d
```

**Access:**
- Web UI: http://localhost:3040
- Admin: http://localhost:3040/admin
- API Docs: http://localhost:3040/api-docs

---

## 🌐 Production

### Initial Setup

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Set APP_DOMAIN and change passwords!

# 2. Build & deploy
docker compose build --no-cache
docker compose up -d

# 3. Setup NGINX + SSL (see DEPLOYMENT.md)
```

### Production Commands

```bash
# View status
docker compose ps

# View logs
docker compose logs -f worker
docker compose logs -f api

# Restart services
docker compose restart worker
docker compose restart api

# Scale workers (3 concurrent jobs)
docker compose up -d --scale worker=3

# Update deployment
git pull
docker compose build --no-cache
docker compose up -d --force-recreate
```

---

## 🔧 Common Tasks

### Database Backup
```bash
docker compose exec postgres pg_dump -U ocruser ocrdb > backup_$(date +%Y%m%d).sql
```

### Check Job Queue
```bash
curl http://localhost:3040/api/admin/stats | jq
```

### Clean Old Jobs (30+ days)
```bash
docker compose exec postgres psql -U ocruser -d ocrdb -c \
  "DELETE FROM \"Job\" WHERE status = 'COMPLETED' AND \"createdAt\" < NOW() - INTERVAL '30 days';"
```

### View Worker Logs
```bash
docker compose logs worker --tail=100 --follow
```

---

## 🐛 Troubleshooting

### Worker stuck?
```bash
docker compose restart worker
```

### Check for errors
```bash
docker compose logs api | grep -i error
docker compose logs worker | grep -i error
```

### Reset everything (⚠️ loses data)
```bash
docker compose down -v
docker compose up -d
```

---

## 📚 Full Documentation

- **Production Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **API Docs**: [docs/](./docs/)
- **Admin Guide**: [docs/ADMIN_DASHBOARD.md](./docs/ADMIN_DASHBOARD.md)
