# External Database Configuration

Guide for connecting the OCR system to an external PostgreSQL database instead of the Docker Compose managed one.

---

## Why Use an External Database?

- **Managed Services**: AWS RDS, DigitalOcean Managed Databases, Supabase, etc.
- **Data Persistence**: Survives Docker container restarts/rebuilds
- **Backups**: Automatic backups managed by provider
- **Scaling**: Easier to scale database independently
- **High Availability**: Built-in failover and replication
- **Monitoring**: Provider's monitoring tools

---

## Prerequisites

1. **PostgreSQL 12+** running and accessible
2. **Database created** with appropriate permissions
3. **Network access** from your Docker host to the database server
4. **SSL certificate** (recommended for production)

---

## Step 1: Create Database and User

Connect to your PostgreSQL server and run:

```sql
-- Create database
CREATE DATABASE ocrdb;

-- Create user
CREATE USER ocruser WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ocrdb TO ocruser;

-- Connect to the database
\c ocrdb

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ocruser;
```

---

## Step 2: Configure Connection String

Edit your `.env` file:

```bash
# Comment out the local database
# DATABASE_URL="postgresql://ocruser:ocrpassword@localhost:5433/ocrdb"

# Use external database
DATABASE_URL="postgresql://ocruser:your_password@your-db-host:5432/ocrdb?sslmode=require"
```

### Connection String Format

```
postgresql://username:password@host:port/database?options
```

**Components:**
- `username`: PostgreSQL user
- `password`: User password (URL-encode special characters!)
- `host`: Database server hostname or IP
- `port`: PostgreSQL port (usually 5432)
- `database`: Database name
- `options`: Additional connection parameters

### Common Options

| Option | Values | Description |
|--------|--------|-------------|
| `sslmode` | `require`, `prefer`, `allow`, `disable` | SSL/TLS mode (use `require` for production) |
| `connection_limit` | Number (e.g., `20`) | Max connections per container |
| `pool_timeout` | Seconds (e.g., `10`) | Timeout waiting for connection |
| `pgbouncer` | `true`, `false` | Set to true if using PgBouncer |
| `statement_cache_size` | Number (e.g., `0`) | Prepared statement cache (0 to disable) |

### Example Connection Strings

**AWS RDS:**
```bash
DATABASE_URL="postgresql://ocruser:MyPassword123@mydb.abc123.us-east-1.rds.amazonaws.com:5432/ocrdb?sslmode=require&connection_limit=20"
```

**DigitalOcean Managed Database:**
```bash
DATABASE_URL="postgresql://doadmin:MyPassword@db-postgresql-nyc1-12345.db.ondigitalocean.com:25060/ocrdb?sslmode=require"
```

**Supabase:**
```bash
# Direct connection (limited connections)
DATABASE_URL="postgresql://postgres:MyPassword@db.project.supabase.co:5432/postgres?sslmode=require"

# Connection pooler (recommended)
DATABASE_URL="postgresql://postgres:MyPassword@db.project.supabase.co:6543/postgres?pgbouncer=true"
```

**Self-hosted with SSL:**
```bash
DATABASE_URL="postgresql://ocruser:MyPassword@db.example.com:5432/ocrdb?sslmode=require"
```

**Self-hosted without SSL (dev only):**
```bash
DATABASE_URL="postgresql://ocruser:MyPassword@db.example.com:5432/ocrdb?sslmode=disable"
```

---

## Step 3: Update Docker Compose

### Option A: Remove PostgreSQL Container Entirely

Edit `docker-compose.yml` and remove the entire `postgres` service:

```yaml
services:
  # Remove this entire section:
  # postgres:
  #   image: postgres:16-alpine
  #   ...

  api:
    # Remove postgres dependency
    # depends_on:
    #   postgres:
    #     condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      # ... rest of config

  worker:
    # Remove postgres dependency
    # depends_on:
    #   postgres:
    #     condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      # ... rest of config
```

### Option B: Keep PostgreSQL for Local Dev (Conditional)

Keep the PostgreSQL service but make it optional:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ocr-postgres
    profiles:
      - local-db  # Only start with --profile local-db
    # ... rest of config

  api:
    depends_on:
      postgres:
        condition: service_healthy
        required: false  # Make dependency optional
    # ... rest of config
```

Then start without local database:
```bash
docker compose up -d  # Uses external DB
```

Or start with local database for development:
```bash
docker compose --profile local-db up -d  # Uses local DB
```

---

## Step 4: Initialize Database Schema

Run Prisma migrations to set up the schema:

```bash
# Push schema to database
docker compose run --rm api npx prisma db push

# Or generate migration
docker compose run --rm api npx prisma migrate dev --name init
```

Verify the schema:
```bash
docker compose run --rm api npx prisma studio
```

---

## Step 5: Test Connection

Start the services:
```bash
docker compose up -d
```

Check logs for connection errors:
```bash
docker compose logs api | grep -i "database\|prisma\|connection"
docker compose logs worker | grep -i "database\|prisma\|connection"
```

Test the API:
```bash
curl http://localhost:3040/api/admin/stats
```

---

## Troubleshooting

### Connection Refused

**Error:** `ECONNREFUSED` or `Connection refused`

**Solutions:**
1. Check database host/port are correct
2. Ensure database is running and accessible
3. Check firewall rules allow connections from your Docker host
4. Verify network connectivity: `telnet db-host 5432`

### Authentication Failed

**Error:** `password authentication failed for user`

**Solutions:**
1. Double-check username and password in connection string
2. Ensure user has proper permissions (see Step 1)
3. Check if password has special characters that need URL encoding:
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - `/` → `%2F`

### SSL Required

**Error:** `SSL connection required` or `no pg_hba.conf entry`

**Solutions:**
1. Add `?sslmode=require` to connection string
2. For self-signed certificates: `?sslmode=require&sslaccept=accept_invalid_certs`
3. Check PostgreSQL `pg_hba.conf` allows SSL connections

### Too Many Connections

**Error:** `too many connections for role`

**Solutions:**
1. Add connection limit: `?connection_limit=10`
2. Use connection pooler (PgBouncer) or provider's pooler
3. Increase `max_connections` in PostgreSQL config
4. Close idle connections properly

### Schema Not Found

**Error:** `relation "Job" does not exist`

**Solutions:**
1. Run database migration: `docker compose run --rm api npx prisma db push`
2. Verify you're connecting to the correct database
3. Check schema was created in correct database

---

## Performance Tuning

### Connection Pooling

Recommended settings for production:

```bash
# For API container (high concurrency)
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&sslmode=require"

# For Worker container (lower concurrency)
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10&sslmode=require"
```

### Multiple Containers

If running multiple API/worker containers:

```bash
# Calculate: total_connections = connection_limit × container_count
# Example: 3 workers × 5 connections = 15 total connections
# Ensure PostgreSQL max_connections > total_connections
```

### PgBouncer (Connection Pooler)

For many containers or serverless:

```bash
DATABASE_URL="postgresql://user:pass@pooler:6543/db?pgbouncer=true&statement_cache_size=0"
```

**Note:** Set `statement_cache_size=0` with PgBouncer to avoid issues with prepared statements.

---

## Provider-Specific Guides

### AWS RDS

1. Create PostgreSQL RDS instance
2. Create database and user (see Step 1)
3. Configure security group to allow connections from your EC2/Docker host
4. Use endpoint as host: `mydb.abc123.us-east-1.rds.amazonaws.com`
5. Enable SSL: `?sslmode=require`

### DigitalOcean Managed Database

1. Create Managed PostgreSQL cluster
2. Add your Droplet to trusted sources
3. Use connection string from control panel
4. Port is usually `25060` (not 5432)

### Supabase

1. Get connection string from Settings → Database
2. Use **Transaction pooler** for long-running apps:
   - Port: `6543`
   - Add: `?pgbouncer=true&statement_cache_size=0`
3. Use **Direct connection** for migrations:
   - Port: `5432`

### Self-Hosted

1. Edit `postgresql.conf`:
   ```
   listen_addresses = '*'  # Or specific IP
   max_connections = 100
   ```

2. Edit `pg_hba.conf`:
   ```
   # Allow connections from Docker network
   host    all    all    172.0.0.0/8    scram-sha-256
   ```

3. Restart PostgreSQL

---

## Migration from Local to External

If you're moving from local Docker PostgreSQL to external:

1. **Backup local database:**
   ```bash
   docker compose exec postgres pg_dump -U ocruser ocrdb > backup.sql
   ```

2. **Create external database** (Step 1)

3. **Restore to external database:**
   ```bash
   psql -h your-db-host -U ocruser -d ocrdb < backup.sql
   ```

4. **Update `.env`** with external DATABASE_URL

5. **Remove local PostgreSQL** from docker-compose.yml

6. **Restart containers:**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

## Security Best Practices

- ✅ **Always use SSL** in production (`sslmode=require`)
- ✅ **Use strong passwords** (20+ characters, random)
- ✅ **Restrict network access** (firewall rules, security groups)
- ✅ **Use connection pooling** to limit connections
- ✅ **Enable SSL certificate verification** for production
- ✅ **Rotate credentials** periodically
- ✅ **Use environment variables** (never commit credentials to git)
- ✅ **Enable database encryption** at rest (if supported)
- ✅ **Configure automatic backups**
- ✅ **Monitor connection metrics**

---

## Checklist

Before going to production with external database:

- [ ] Database created with proper user/permissions
- [ ] Connection string tested and working
- [ ] SSL enabled (`sslmode=require`)
- [ ] Connection pooling configured
- [ ] Schema migrated (`prisma db push` successful)
- [ ] Automatic backups configured
- [ ] Monitoring set up
- [ ] Firewall rules restrict access
- [ ] Credentials stored securely
- [ ] Connection limits tuned for your setup

---

## Quick Reference

```bash
# Test connection
docker compose run --rm api npx prisma db execute --stdin <<< "SELECT 1"

# View schema
docker compose run --rm api npx prisma studio

# Migrate schema
docker compose run --rm api npx prisma db push

# Check connection pool status
docker compose run --rm api npx prisma db execute --stdin <<< \
  "SELECT count(*) as connections FROM pg_stat_activity WHERE usename='ocruser';"
```
