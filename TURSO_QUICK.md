# Turso (Edge SQLite) - Quick Start

## Yes! You can use Turso (hosted SQLite) instead of PostgreSQL

**Turso** = Edge-hosted SQLite with global distribution

**Perfect for:**
- 🌍 Edge deployment (data close to users)
- 🆓 Hobby projects (generous free tier)
- ⚡ Fast reads (SQLite performance)
- 🚀 Serverless apps

---

## Quick Setup (5 steps)

### 1. Install Turso CLI

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows
irm get.tur.so/install.ps1 | iex
```

### 2. Create Turso Database

```bash
turso auth login
turso db create ocr-production --location lhr  # London (or your region)
```

### 3. Get Connection Details

```bash
# Get database URL
turso db show ocr-production --url
# Output: libsql://ocr-production-yourname.turso.io

# Create auth token
turso db tokens create ocr-production
# Output: eyJhbGc... (long token)
```

### 4. Configure Environment

```bash
# In .env file:
DATABASE_URL="libsql://ocr-production-yourname.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6..."
```

### 5. Install Dependencies & Deploy

```bash
# Add Turso support
npm install @libsql/client @prisma/adapter-libsql

# Deploy
docker compose build --no-cache
docker compose up -d
```

**Done!** Your OCR system now uses Turso edge database.

---

## Free Tier (Forever)

- ✅ 9 GB storage
- ✅ 1 billion row reads/month
- ✅ 25 million row writes/month
- ✅ 3 databases
- ✅ Global replicas

**More than enough for most OCR projects!**

---

## Multi-Region (Optional)

Deploy globally with one command:

```bash
# Create replicas in other regions
turso db replicate ocr-production fra  # Frankfurt
turso db replicate ocr-production sin  # Singapore
turso db replicate ocr-production iad  # Virginia
```

Turso automatically routes requests to nearest replica! 🚀

---

## Local Development

Use local SQLite file for development:

```bash
# In .env:
DATABASE_URL="file:./dev.db"
TURSO_AUTH_TOKEN=""  # Not needed for local

# Start
docker compose up -d
```

---

## Comparison

| Feature | PostgreSQL | Turso |
|---------|-----------|-------|
| Setup | Complex | 5 commands |
| Cost | ~$15+/month | Free tier |
| Performance | Fast | Very fast (SQLite) |
| Scaling | Manual | Automatic |
| Backups | Manual | Automatic |
| Global | No | Yes (replicas) |
| Edge | No | Yes |
| Writes | High concurrency | Medium concurrency |

**Choose Turso for:** Hobby, edge, global apps, simple setup
**Choose PostgreSQL for:** High writes, traditional hosting

---

## Full Documentation

📖 **Complete Guide**: [docs/TURSO_SETUP.md](./docs/TURSO_SETUP.md)

Includes:
- Detailed setup
- Schema modifications
- Multi-region deployment
- Migration from PostgreSQL
- Monitoring & troubleshooting
- Performance optimization

---

## Support

- 🌐 Website: https://turso.tech
- 📚 Docs: https://docs.turso.tech
- 💬 Discord: https://discord.gg/turso
- 🐦 Twitter: @tursodatabase
