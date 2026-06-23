# Deployment Guide

Complete guide for running the OCR system in development and production environments.

---

## 📋 Prerequisites

- Docker & Docker Compose installed
- 4GB+ RAM (8GB+ recommended for production)
- 10GB+ disk space

---

## 🔧 Development Setup

### 1. Clone & Configure

```bash
# Clone repository
git clone <your-repo>
cd ocr

# Copy environment template
cp .env.example .env

# Edit .env for local development (optional)
nano .env
```

### 2. Start Development Environment

```bash
# Build and start all services
docker compose up -d

# Or rebuild if you made changes
docker compose build --no-cache
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f worker
docker compose logs -f api
```

### 3. Verify Development Setup

```bash
# Check all containers are running
docker compose ps

# Test the API
curl http://localhost:14580/api/openapi

# Access the web interface
open http://localhost:14580

# Access admin dashboard
open http://localhost:14580/admin
```

### 4. Development Tools

```bash
# Run Playwright tests
npm test

# Run specific test file
npm test tests/admin.spec.ts

# View test report
npm run test:report

# Access Prisma Studio (database GUI)
npx prisma studio
```

### 5. Stop Development Environment

```bash
# Stop all containers
docker compose down

# Stop and remove volumes (reset database)
docker compose down -v
```

---

## 🗄️ Database Options

### Local PostgreSQL (Default)
Uses Docker Compose PostgreSQL container. Good for development and self-hosted production.

### External PostgreSQL (Recommended for Production)
Use managed PostgreSQL services like AWS RDS, DigitalOcean, Supabase, etc.

See **[docs/EXTERNAL_DATABASE.md](./docs/EXTERNAL_DATABASE.md)** for complete guide.

**Quick example:**
```bash
DATABASE_URL="postgresql://user:pass@db.example.com:5432/ocrdb?sslmode=require"
```

### Turso / LibSQL (Best for Edge & Free Tier)
Edge-hosted SQLite with global distribution. Perfect for hobby projects and edge deployment.

See **[docs/TURSO_SETUP.md](./docs/TURSO_SETUP.md)** or **[TURSO_QUICK.md](./TURSO_QUICK.md)** for setup guide.

**Quick example:**
```bash
DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your_token"
```

**Turso Benefits:**
- ✅ Free tier: 9GB storage, 1B reads/month
- ✅ Auto-scaling & backups
- ✅ Global edge deployment
- ✅ 5-minute setup

---

## 🚀 Production Deployment

### Option 1: Single Server Deployment

#### Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Step 2: Clone & Configure

```bash
# Clone repository
git clone <your-repo>
cd ocr

# Create production environment file
cp .env.example .env
nano .env
```

**Production `.env` Configuration:**

```bash
# Database
DATABASE_URL="postgresql://ocruser:CHANGE_THIS_PASSWORD@postgres:5432/ocrdb"

# Environment
NODE_ENV="production"

# URLs - CRITICAL FOR PRODUCTION!
# Set these to your actual domain names
APP_DOMAIN="https://ocrtools.com"
NEXT_PUBLIC_API_BASE_URL=""  # Leave empty if API on same domain

# Optional: Connection pool limits
# DATABASE_URL="postgresql://ocruser:password@postgres:5432/ocrdb?connection_limit=20&pool_timeout=10"
```

#### Step 3: Build & Deploy

```bash
# Build with no cache for production
docker compose build --no-cache

# Start services in detached mode
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

#### Step 4: Setup Reverse Proxy (NGINX)

**Install NGINX:**
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

**Create NGINX config** (`/etc/nginx/sites-available/ocr`):

```nginx
# API Server (if on separate subdomain)
server {
    listen 80;
    server_name api.ocrtools.com;

    location / {
        proxy_pass http://localhost:14580;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;

        # Increase max body size for large PDFs
        client_max_body_size 50M;
    }
}

# Main App (if on same domain or different subdomain)
server {
    listen 80;
    server_name ocrtools.com;

    location / {
        proxy_pass http://localhost:14580;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;

        client_max_body_size 50M;
    }
}
```

**Enable site and get SSL:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ocr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificates (automatic HTTPS)
sudo certbot --nginx -d ocrtools.com -d api.ocrtools.com

# Auto-renewal is set up by certbot automatically
```

#### Step 5: Setup Monitoring

**Create monitoring script** (`/home/user/monitor_ocr.sh`):

```bash
#!/bin/bash
# Check if containers are running and restart if needed

cd /home/user/ocr

# Check API
if ! docker compose ps api | grep -q "Up"; then
    echo "API is down, restarting..."
    docker compose restart api
fi

# Check Worker
if ! docker compose ps worker | grep -q "Up"; then
    echo "Worker is down, restarting..."
    docker compose restart worker
fi

# Check Postgres
if ! docker compose ps postgres | grep -q "healthy"; then
    echo "Postgres is unhealthy, restarting..."
    docker compose restart postgres
fi
```

**Setup cron job:**

```bash
chmod +x /home/user/monitor_ocr.sh

# Add to crontab (runs every 5 minutes)
crontab -e

# Add this line:
*/5 * * * * /home/user/monitor_ocr.sh >> /home/user/ocr_monitor.log 2>&1
```

#### Step 6: Setup Log Rotation

**Create logrotate config** (`/etc/logrotate.d/ocr`):

```
/home/user/ocr_monitor.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

---

### Option 2: Docker Swarm (Multi-Server)

For high availability and load balancing:

```bash
# Initialize swarm (on manager node)
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml ocr

# Scale worker nodes
docker service scale ocr_worker=3

# View services
docker service ls

# View logs
docker service logs ocr_worker
```

---

## 🔄 Scaling

### Horizontal Scaling (Multiple Workers)

```bash
# Scale to 3 workers (processes 3 jobs simultaneously)
docker compose up -d --scale worker=3

# Check status
docker compose ps

# Each worker processes jobs sequentially
# 3 workers = 3 concurrent jobs
```

**docker-compose.yml** already supports this:

```yaml
worker:
  deploy:
    replicas: 1  # Change to 3 for 3 workers
```

### Vertical Scaling

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

---

## 🔒 Security Checklist

### Before Production:

- [ ] **Change database password** in `.env`
- [ ] **Setup HTTPS** with SSL certificates
- [ ] **Add admin authentication** (⚠️ CRITICAL - currently no auth)
- [ ] **Setup firewall** (UFW):
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- [ ] **Regular backups** of PostgreSQL:
  ```bash
  docker compose exec postgres pg_dump -U ocruser ocrdb > backup.sql
  ```
- [ ] **Setup monitoring** (Prometheus, Grafana, or simple cron)
- [ ] **Configure rate limiting** in NGINX
- [ ] **Review environment variables** for sensitive data

---

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check container health
docker compose ps

# Check logs for errors
docker compose logs --tail=100 worker | grep -i error
docker compose logs --tail=100 api | grep -i error

# Check database
docker compose exec postgres psql -U ocruser -d ocrdb -c "SELECT COUNT(*) FROM \"Job\";"

# Check disk space
df -h
docker system df
```

### Database Backup

```bash
# Backup
docker compose exec postgres pg_dump -U ocruser ocrdb > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U ocruser ocrdb < backup_20250113.sql
```

### Clean Up Old Jobs

```bash
# Delete completed jobs older than 30 days
docker compose exec postgres psql -U ocruser -d ocrdb -c \
  "DELETE FROM \"Job\" WHERE status = 'COMPLETED' AND \"createdAt\" < NOW() - INTERVAL '30 days';"
```

### Update Deployment

```bash
# Pull latest code
git pull

# Rebuild without cache
docker compose build --no-cache

# Restart with zero downtime
docker compose up -d --force-recreate --no-deps api worker

# Or full restart
docker compose down
docker compose up -d
```

---

## 🐛 Troubleshooting

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose logs worker --tail=50

# Check if worker is stuck
docker compose exec postgres psql -U ocruser -d ocrdb -c \
  "SELECT id, status, \"createdAt\", \"updatedAt\" FROM \"Job\" WHERE status = 'PROCESSING' ORDER BY \"updatedAt\" DESC LIMIT 10;"

# Restart worker
docker compose restart worker
```

### API Not Responding

```bash
# Check API logs
docker compose logs api --tail=50

# Check if Next.js process is running
docker compose exec api ps aux | grep node

# Restart API
docker compose restart api
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker compose logs postgres --tail=50

# Test connection
docker compose exec postgres psql -U ocruser -d ocrdb -c "SELECT 1;"

# Restart database (will disconnect active connections)
docker compose restart postgres
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up unused images/containers
docker system prune -a

# Clean up old job data (see Database Backup section)
```

### OCR Fails with "Network unreachable"

This means a language model that's not pre-downloaded is being requested. Add it to `download_models.py`:

```python
langs = ['en', 'fr', 'german', 'es', 'it', 'pt', 'nl', 'ch']  # Add Chinese
```

Then rebuild:
```bash
docker compose build --no-cache
docker compose up -d
```

---

## 🌍 Multi-Domain Setup

### Example: Different domains for frontend and API

**`.env`:**
```bash
APP_DOMAIN="https://ocrtools.com"
NEXT_PUBLIC_API_BASE_URL="https://api.ocrtools.com"
```

**NGINX config** - see Step 4 above for full config.

---

## 📝 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://ocruser:ocrpassword@postgres:5432/ocrdb` | PostgreSQL connection string |
| `NODE_ENV` | `development` | Environment (`development` or `production`) |
| `APP_DOMAIN` | `http://localhost:14580` | Main application domain |
| `NEXT_PUBLIC_API_BASE_URL` | (empty) | API domain if different from main |

---

## 🚦 Quick Reference

```bash
# Development
docker compose up -d                    # Start
docker compose down                     # Stop
docker compose logs -f                  # View logs
docker compose ps                       # Check status

# Production
docker compose build --no-cache         # Build
docker compose up -d                    # Deploy
docker compose up -d --scale worker=3   # Scale workers
docker compose restart worker           # Restart service

# Maintenance
docker compose exec postgres pg_dump -U ocruser ocrdb > backup.sql  # Backup
docker system prune -a                                               # Clean up
```

---

## 🆘 Support

- **Documentation**: `/docs` folder
- **Admin Dashboard**: `http://localhost:14580/admin`
- **API Docs**: `http://localhost:14580/api-docs`
- **Health Check**: `http://localhost:14580/api/admin/stats`
