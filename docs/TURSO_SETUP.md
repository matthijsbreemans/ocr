# Turso (LibSQL) Setup Guide

Complete guide for using Turso - the edge-hosted, distributed SQLite database with your OCR system.

---

## What is Turso?

**Turso** is a distributed database built on LibSQL (SQLite fork) that offers:
- 🌍 **Edge deployment** - Data close to your users globally
- 💰 **Generous free tier** - 9GB storage, 1 billion row reads/month
- ⚡ **Fast** - SQLite performance with global distribution
- 🔄 **Replication** - Multi-region with eventual consistency
- 💾 **Embedded replicas** - Local-first with sync
- 🆓 **Free for hobby projects**

Perfect for OCR system because it's serverless and scales automatically!

---

## Prerequisites

- Turso CLI installed
- Turso account (free)

---

## Step 1: Install Turso CLI

### macOS/Linux
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

### Windows (PowerShell)
```powershell
irm get.tur.so/install.ps1 | iex
```

Verify installation:
```bash
turso --version
```

---

## Step 2: Create Turso Database

```bash
# Login to Turso
turso auth login

# Create database
turso db create ocr-production

# Or create with location (closer to users)
turso db create ocr-production --location lhr  # London

# Available locations: sjc (California), iad (Virginia),
# fra (Frankfurt), sin (Singapore), syd (Sydney), lhr (London), etc.
```

Get connection details:
```bash
# Get database URL
turso db show ocr-production --url

# Create authentication token
turso db tokens create ocr-production
```

**Save these values:**
- Database URL: `libsql://ocr-production-yourname.turso.io`
- Auth Token: `eyJhbGc...` (long token)

---

## Step 3: Update Prisma Schema

The current schema uses PostgreSQL-specific features. We need to make it database-agnostic.

**Option A: Keep PostgreSQL for production, Turso for edge** (recommended)

Keep your current schema and use PostgreSQL for production. Use Turso for edge/staging.

**Option B: Use SQLite-compatible schema** (for Turso-only)

Create `prisma/schema.turso.prisma`:

```prisma
// Turso/LibSQL compatible schema
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Job {
  id              String    @id @default(uuid())
  status          String    @default("PENDING")  // ENUM not supported in SQLite
  documentType    String
  email           String
  callbackWebhook String?
  fileData        Bytes
  fileName        String
  mimeType        String
  ocrResult       String?
  errorMessage    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  processedAt     DateTime?

  @@index([status, createdAt])
  @@map("jobs")
}
```

**Key differences from PostgreSQL schema:**
- `@db.Text` removed (SQLite doesn't need it)
- `JobStatus` enum → String (SQLite doesn't have native enums)
- Provider changed to `sqlite`

---

## Step 4: Install Turso Adapter

```bash
# Add Turso/LibSQL support
npm install @libsql/client
npm install @prisma/adapter-libsql
```

Update `package.json` dependencies:
```json
{
  "dependencies": {
    "@libsql/client": "^0.14.0",
    "@prisma/adapter-libsql": "^5.18.0",
    "@prisma/client": "^5.18.0"
  }
}
```

---

## Step 5: Update Database Connection

Create `src/lib/db.turso.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Check if using Turso/LibSQL
  const databaseUrl = process.env.DATABASE_URL || '';

  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('file:')) {
    // Turso/LibSQL connection
    const libsql = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const adapter = new PrismaLibSQL(libsql);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  } else {
    // PostgreSQL connection (fallback)
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Or update existing `src/lib/db.ts`** to support both:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || '';

  // Detect Turso/LibSQL
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('file:')) {
    // Dynamic import for Turso adapter (only when needed)
    const { createClient } = require('@libsql/client');
    const { PrismaLibSQL } = require('@prisma/adapter-libsql');

    const libsql = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const adapter = new PrismaLibSQL(libsql);

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  // PostgreSQL (default)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## Step 6: Configure Environment Variables

Update `.env`:

```bash
# Turso/LibSQL Configuration
DATABASE_URL="libsql://ocr-production-yourname.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."

# Or local development with local file
# DATABASE_URL="file:./dev.db"
# TURSO_AUTH_TOKEN=""  # Not needed for local file
```

Add to `.env.example`:

```bash
# ============================================================================
# TURSO / LIBSQL DATABASE (Alternative to PostgreSQL)
# ============================================================================

# Option 1: Turso Cloud (Recommended for production)
# Get URL: turso db show <db-name> --url
# Get token: turso db tokens create <db-name>
# DATABASE_URL="libsql://your-db-name.turso.io"
# TURSO_AUTH_TOKEN="your_auth_token_here"

# Option 2: Local SQLite file (Development)
# DATABASE_URL="file:./dev.db"
# TURSO_AUTH_TOKEN=""  # Leave empty for local file
```

---

## Step 7: Initialize Database

```bash
# Generate Prisma client with LibSQL adapter
npx prisma generate

# Push schema to Turso
npx prisma db push

# Or use Turso CLI to import schema
turso db shell ocr-production < prisma/schema.sql
```

---

## Step 8: Deploy

```bash
# Build and deploy
docker compose build --no-cache
docker compose up -d

# Check logs
docker compose logs -f api
docker compose logs -f worker
```

---

## Features & Limitations

### ✅ What Works

- ✅ All CRUD operations
- ✅ Transactions
- ✅ Indexes
- ✅ Full-text search (SQLite FTS5)
- ✅ JSON support
- ✅ Concurrent reads
- ✅ Automatic backups
- ✅ Point-in-time recovery

### ⚠️ Limitations

- ⚠️ **No native ENUM types** (use strings instead)
- ⚠️ **Writes are eventually consistent** across replicas
- ⚠️ **No `@db.Text` annotation** (not needed in SQLite)
- ⚠️ **File size limits** per row (~1GB practical limit)
- ⚠️ **Concurrent writes** limited (SQLite limitation)

---

## Multi-Region Setup

Deploy your OCR system closer to users:

```bash
# Create primary database in US
turso db create ocr-us --location iad

# Add replicas in other regions
turso db replicate ocr-us fra  # Frankfurt
turso db replicate ocr-us sin  # Singapore
turso db replicate ocr-us lhr  # London

# Get connection details
turso db show ocr-us
```

Update `.env` with primary database URL. Turso automatically routes requests to nearest replica!

---

## Local Development with Turso

### Option 1: Local SQLite File

```bash
# .env
DATABASE_URL="file:./dev.db"
TURSO_AUTH_TOKEN=""

# Start development
docker compose up -d
```

### Option 2: Embedded Replica (Best of both worlds)

Use Turso's embedded replica for local-first development:

```typescript
// src/lib/db.ts
import { createClient } from '@libsql/client';

const libsql = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,

  // Embedded replica (local-first with sync)
  syncUrl: process.env.TURSO_SYNC_URL,
  syncInterval: 60, // Sync every 60 seconds
});
```

```bash
# .env for embedded replica
DATABASE_URL="file:./local.db"
TURSO_SYNC_URL="libsql://ocr-production-yourname.turso.io"
TURSO_AUTH_TOKEN="your_token"
```

Benefits:
- ⚡ **Instant reads** from local SQLite
- 🔄 **Automatic sync** to Turso cloud
- 🚀 **Works offline** and syncs when connected

---

## Migration from PostgreSQL to Turso

### Step 1: Export PostgreSQL Data

```bash
# Export as CSV
docker compose exec postgres psql -U ocruser -d ocrdb -c "\COPY jobs TO '/tmp/jobs.csv' CSV HEADER;"

# Copy from container
docker compose cp postgres:/tmp/jobs.csv ./jobs_backup.csv
```

### Step 2: Transform Data

Since Turso uses SQLite, ensure compatibility:
- ENUMs → Strings
- Large TEXT fields → Check size limits
- UUIDs → Ensure format compatibility

### Step 3: Import to Turso

```bash
# Using Turso CLI
turso db shell ocr-production

# In SQLite shell:
.mode csv
.import jobs_backup.csv jobs
```

Or use Prisma:

```typescript
// migrate.ts
import { prisma } from './src/lib/db';
import fs from 'fs';
import csv from 'csv-parser';

const jobs = [];
fs.createReadStream('jobs_backup.csv')
  .pipe(csv())
  .on('data', (row) => jobs.push(row))
  .on('end', async () => {
    await prisma.job.createMany({ data: jobs });
    console.log(`Migrated ${jobs.length} jobs`);
  });
```

---

## Monitoring & Management

### Using Turso CLI

```bash
# View databases
turso db list

# Check database size
turso db show ocr-production

# View usage stats
turso org usage

# Shell access
turso db shell ocr-production

# Create backup
turso db shell ocr-production .dump > backup.sql
```

### Using Turso Dashboard

Visit https://turso.tech/app to:
- View database metrics
- Monitor usage
- Manage replicas
- View query logs
- Set up alerts

---

## Pricing

### Free Tier (Forever)
- 9 GB total storage
- 1 billion row reads/month
- 25 million row writes/month
- 3 databases
- 1 location per database

### Scaler Plan ($29/month)
- Unlimited storage
- Unlimited reads
- Unlimited writes
- Unlimited databases
- Up to 100 locations
- Priority support

**Perfect for OCR system:** Start free, scale when needed!

---

## Performance Tips

1. **Enable WAL mode** (default in Turso):
   ```sql
   PRAGMA journal_mode=WAL;
   ```

2. **Add indexes** for common queries:
   ```prisma
   @@index([status, createdAt])
   @@index([email])
   ```

3. **Use batch operations**:
   ```typescript
   await prisma.job.createMany({ data: jobs });
   ```

4. **Limit file sizes** in database:
   - Store small files (<1MB) in database
   - Use S3/R2 for larger files

5. **Use read replicas** for queries:
   ```bash
   turso db replicate ocr-us <location>
   ```

---

## Troubleshooting

### Connection Failed

```bash
# Test connection
turso db shell ocr-production

# Verify token
turso db tokens list ocr-production

# Recreate token
turso db tokens create ocr-production --expiration none
```

### Schema Mismatch

```bash
# Reset database (⚠️ DELETES ALL DATA)
turso db destroy ocr-production
turso db create ocr-production

# Push new schema
npx prisma db push
```

### Migration Errors

If Prisma migrations fail, use Turso CLI:

```bash
turso db shell ocr-production < prisma/migrations/schema.sql
```

---

## Quick Reference

```bash
# Create database
turso db create ocr-prod --location iad

# Get URL
turso db show ocr-prod --url

# Create token
turso db tokens create ocr-prod

# Shell access
turso db shell ocr-prod

# Replicate
turso db replicate ocr-prod fra

# Backup
turso db shell ocr-prod .dump > backup.sql

# Monitor usage
turso org usage
```

---

## Example `.env` for Turso

```bash
# Database
DATABASE_URL="libsql://ocr-production-username.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImRiIjoib2NyLXByb2R1Y3Rpb24ifQ..."

# App
NODE_ENV="production"
APP_DOMAIN="https://ocrtools.com"

```

---

## Summary

**Turso is perfect for the OCR system because:**
- ✅ Serverless & auto-scaling
- ✅ Generous free tier
- ✅ Fast (SQLite performance)
- ✅ Global distribution
- ✅ Simple setup
- ✅ Great for edge deployment

**Use Turso for:** Edge deployment, global apps, hobby projects, fast reads
**Use PostgreSQL for:** High write concurrency, complex transactions, traditional hosting
