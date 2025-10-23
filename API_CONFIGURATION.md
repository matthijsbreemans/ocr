# API Configuration Guide

## Overview

The OCR API supports flexible deployment configurations:

1. **Same Origin** (Default) - Frontend and API on the same server
2. **Separate API Server** - API on different port/hostname

---

## Default Configuration (Same Origin)

By default, the Next.js app serves both the frontend and API routes on the same server.

```
http://localhost:3040
├── /                    → Frontend (homepage)
├── /api-docs           → Swagger UI
├── /api/upload         → Upload endpoint
└── /api/status/:id     → Status endpoint
```

**Docker Compose:**
```yaml
services:
  api:
    ports:
      - "3000:3000"
    # Serves both frontend and API
```

**No additional configuration needed!**

---

## Separate API Server Configuration

If you want to run the API on a different port or domain (e.g., in production), use the `NEXT_PUBLIC_API_BASE_URL` environment variable.

### Example 1: Different Port (Development)

```bash
# .env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

**Setup:**
1. Frontend runs on port 3000
2. API runs on port 4000
3. All API calls from frontend go to port 4000

**Docker Compose:**
```yaml
services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
    command: npm start

  api:
    build: .
    ports:
      - "4000:3000"  # API on external port 4000
    command: npm start

  worker:
    build: .
    command: npm run worker
```

### Example 2: Different Hostname (Production)

```bash
# .env
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

**Setup:**
1. Frontend: `https://your-domain.com`
2. API: `https://api.your-domain.com`
3. All API calls from frontend go to api.your-domain.com

**Architecture:**
```
┌─────────────────────────┐
│  your-domain.com        │
│  (Frontend + Swagger)   │
│  - Port 3000            │
└─────────────────────────┘
           │
           │ HTTP Requests
           ↓
┌─────────────────────────┐
│  api.your-domain.com    │
│  (API Endpoints)        │
│  - Port 3000            │
└─────────────────────────┘
           │
           ↓
┌─────────────────────────┐
│  Database               │
│  (PostgreSQL)           │
└─────────────────────────┘
```

---

## Configuration Files

### 1. `.env` File

```bash
# Database (always required)
DATABASE_URL="postgresql://ocruser:ocrpassword@postgres:5432/ocrdb"

# Environment
NODE_ENV="production"

# API Base URL (optional)
# If not set, uses same origin (relative URLs)
NEXT_PUBLIC_API_BASE_URL="https://api.your-domain.com"
```

### 2. `src/lib/config.ts`

This file handles the API base URL logic:

```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function getApiUrl(path: string): string {
  if (API_BASE_URL) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${API_BASE_URL}/${cleanPath}`;
  }
  return path; // Relative URL (same origin)
}
```

### 3. Frontend Components

Components automatically use the configured API base URL:

```typescript
// UploadForm.tsx
import { getApiUrl } from '@/lib/config';

const response = await fetch(getApiUrl('/api/upload'), {
  method: 'POST',
  body: formData,
});
```

---

## Swagger UI Integration

The Swagger UI page is located at `/api-docs` and automatically configures the correct server URL.

**Features:**
- ✅ Interactive API explorer ("Try it out" button)
- ✅ Automatic server URL detection
- ✅ Request/response examples
- ✅ Full schema documentation
- ✅ Supports both same-origin and cross-origin APIs

**How It Works:**

1. `/api-docs` page loads Swagger UI component
2. Fetches OpenAPI spec from `/api/openapi`
3. OpenAPI spec dynamically sets server URL based on:
   - `NEXT_PUBLIC_API_BASE_URL` (if set)
   - Request origin (if not set)

---

## CORS Configuration

If running the API on a different domain, you need to configure CORS:

### Option 1: Next.js Headers (next.config.js)

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://your-domain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};
```

### Option 2: Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    location /api {
        proxy_pass http://localhost:3040;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://your-domain.com';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type';
    }
}
```

---

## Deployment Scenarios

### Scenario 1: Single Server (Default)

**Use Case:** Small deployments, development

```
┌─────────────────────────┐
│  Server (port 3000)     │
│  - Frontend             │
│  - API                  │
│  - Swagger UI           │
└─────────────────────────┘
```

**Configuration:**
- No environment variables needed
- Everything on same origin
- Simplest setup

### Scenario 2: API on Different Port

**Use Case:** Local development, testing

```
┌──────────────────────┐       ┌──────────────────────┐
│  Frontend (3000)     │ ───── │  API (4000)          │
│  - Homepage          │       │  - /api/upload       │
│  - Swagger UI        │       │  - /api/status/:id   │
└──────────────────────┘       └──────────────────────┘
```

**Configuration:**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### Scenario 3: API on Different Domain

**Use Case:** Production, microservices architecture

```
┌──────────────────────────┐      ┌──────────────────────────┐
│  your-domain.com         │      │  api.your-domain.com     │
│  - Frontend              │ ──── │  - API endpoints         │
│  - Swagger UI            │      │  - Worker processes      │
└──────────────────────────┘      └──────────────────────────┘
```

**Configuration:**
```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com

# API (needs CORS)
ALLOWED_ORIGINS=https://your-domain.com
```

### Scenario 4: Load Balanced APIs

**Use Case:** High availability, scalability

```
┌──────────────────────────┐
│  your-domain.com         │
│  (Frontend)              │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  api.your-domain.com     │
│  (Load Balancer)         │
└──────┬────────┬──────────┘
       │        │
   ┌───▼───┐ ┌─▼────┐
   │ API 1 │ │ API 2│
   └───────┘ └──────┘
```

**Configuration:**
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

---

## Testing Different Configurations

### Test Same Origin
```bash
# No NEXT_PUBLIC_API_BASE_URL set
npm run dev

# Visit http://localhost:3040
# API calls go to http://localhost:3040/api/*
```

### Test Different Port
```bash
# Terminal 1: Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev

# Terminal 2: API
PORT=4000 npm run dev

# Visit http://localhost:3040
# API calls go to http://localhost:4000/api/*
```

### Test Docker
```bash
# Edit docker-compose.yml to add environment variables
docker-compose up

# Frontend: http://localhost:3040
# API: (same server or different as configured)
```

---

## Swagger UI Server Selection

The Swagger UI page shows available servers in a dropdown:

1. **Current Server** (auto-detected)
2. **Local Development** (http://localhost:3040)
3. **Production** (https://your-domain.com)

Users can switch between servers when testing the API.

---

## Troubleshooting

### Issue: API calls fail with CORS error

**Solution:** Configure CORS on the API server

```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || '*' },
      ],
    },
  ];
}
```

### Issue: Swagger "Try it out" doesn't work

**Solution:** Check that the server URL in Swagger matches your API URL

1. Open Swagger UI at `/api-docs`
2. Check the "Servers" dropdown at the top
3. Select the correct server
4. Try the request again

### Issue: Frontend can't reach API

**Solution:** Check `NEXT_PUBLIC_API_BASE_URL` is correct

```bash
# Check environment variable
echo $NEXT_PUBLIC_API_BASE_URL

# Test API directly
curl http://localhost:4000/api/openapi

# Check browser console for errors
```

---

## Summary

**Same Origin (Default):**
- ✅ Simplest setup
- ✅ No CORS issues
- ✅ No extra configuration
- ❌ Everything on one server

**Separate API Server:**
- ✅ Better separation of concerns
- ✅ Independent scaling
- ✅ Different deployment strategies
- ❌ Requires CORS configuration
- ❌ More complex setup

**Configuration:**
```bash
# .env
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

**That's it!** The frontend will automatically use the configured API base URL for all requests.
