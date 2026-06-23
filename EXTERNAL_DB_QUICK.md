# External Database - Quick Guide

## Yes, you can use an external database!

Instead of the Docker Compose PostgreSQL container, you can use:
- 🌐 **AWS RDS**
- 🌐 **DigitalOcean Managed Database**
- 🌐 **Supabase**
- 🌐 **Google Cloud SQL**
- 🌐 **Azure Database**
- 🏠 **Self-hosted PostgreSQL**

---

## Quick Setup (3 steps)

### 1. Create Database on External Server

```sql
CREATE DATABASE ocrdb;
CREATE USER ocruser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ocrdb TO ocruser;
```

### 2. Update `.env` File

```bash
# Comment out local database
# DATABASE_URL="postgresql://ocruser:ocrpassword@localhost:15433/ocrdb"

# Use external database
DATABASE_URL="postgresql://ocruser:your_password@db.example.com:5432/ocrdb?sslmode=require"
```

### 3. Initialize Schema & Deploy

```bash
# Push database schema
docker compose run --rm api npx prisma db push

# Deploy (postgres container will be ignored if not in docker-compose.yml)
docker compose up -d
```

**That's it!** Your OCR system now uses the external database.

---

## Common Examples

### AWS RDS
```bash
DATABASE_URL="postgresql://ocruser:MyPass@mydb.abc123.us-east-1.rds.amazonaws.com:5432/ocrdb?sslmode=require"
```

### Supabase (Pooler - Recommended)
```bash
DATABASE_URL="postgresql://postgres:MyPass@db.project.supabase.co:6543/postgres?pgbouncer=true"
```

### DigitalOcean
```bash
DATABASE_URL="postgresql://doadmin:MyPass@db-postgresql-nyc1-12345.db.ondigitalocean.com:25060/ocrdb?sslmode=require"
```

---

## Benefits

✅ **Automatic backups**  
✅ **High availability**  
✅ **Easy scaling**  
✅ **Managed updates**  
✅ **Monitoring included**  
✅ **Data persists across deploys**

---

## Full Documentation

📖 **Complete Guide**: [docs/EXTERNAL_DATABASE.md](./docs/EXTERNAL_DATABASE.md)

Includes:
- Detailed setup instructions
- Provider-specific guides
- SSL configuration
- Connection pooling
- Troubleshooting
- Performance tuning
