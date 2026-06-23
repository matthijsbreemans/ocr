# How to Download API Spec (OpenAPI/Swagger)

## Quick Download Options

### Option 1: Direct Download via cURL

```bash
# Download JSON spec
curl http://localhost:14580/api/openapi > openapi.json

# Or with pretty formatting
curl http://localhost:14580/api/openapi | jq . > openapi.json

# Production URL
curl https://your-domain.com/api/openapi > openapi.json
```

### Option 2: Browser Download

1. Open: http://localhost:14580/api/openapi
2. Right-click → "Save As..." → `openapi.json`

### Option 3: From Swagger UI

1. Open: http://localhost:14580/api-docs
2. Look for the spec URL at the top
3. Click or copy: `/api/openapi`

### Option 4: Using wget

```bash
wget http://localhost:14580/api/openapi -O openapi.json
```

---

## What You Get

**OpenAPI 3.0.3 Specification** including:

- ✅ All API endpoints
- ✅ Request/response schemas
- ✅ Authentication details
- ✅ Example requests
- ✅ Error responses
- ✅ File upload multipart/form-data specs

---

## Use Cases

### Import to Postman

1. Download spec: `curl http://localhost:14580/api/openapi > openapi.json`
2. Open Postman
3. Click **Import** → **Upload Files** → Select `openapi.json`
4. Done! All endpoints ready to test

### Generate Client SDK

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:14580/api/openapi \
  -g typescript-fetch \
  -o ./client

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:14580/api/openapi \
  -g python \
  -o ./python-client

# Generate PHP client
openapi-generator-cli generate \
  -i http://localhost:14580/api/openapi \
  -g php \
  -o ./php-client
```

### Validate API Contract

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate spec
swagger-cli validate http://localhost:14580/api/openapi
```

---

## Production URL

For production, update the spec to use your domain:

```bash
curl https://api.yourcompany.com/api/openapi > openapi.json
```

The spec URL will always be at: `{BASE_URL}/api/openapi`

---

## Viewing the Spec

### Swagger UI (Interactive)
- **URL**: http://localhost:14580/api-docs
- **Features**: Try-it-out, test requests, see responses

### Raw JSON
- **URL**: http://localhost:14580/api/openapi
- **Format**: OpenAPI 3.0.3 JSON

### YAML Conversion

```bash
# Convert JSON to YAML
curl http://localhost:14580/api/openapi | yq -P > openapi.yaml
```

---

## Quick Commands Summary

```bash
# JSON format
curl http://localhost:14580/api/openapi > openapi.json

# Pretty JSON
curl http://localhost:14580/api/openapi | jq . > openapi.json

# YAML format
curl http://localhost:14580/api/openapi | yq -P > openapi.yaml

# View in browser
open http://localhost:14580/api/openapi

# Interactive docs
open http://localhost:14580/api-docs
```
