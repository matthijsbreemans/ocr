# Swagger/OpenAPI Documentation Setup

## ✅ What Was Added

A complete Swagger UI integration with OpenAPI 3.0 specification for interactive API documentation.

---

## 🎯 Features

### Interactive API Documentation
- **Swagger UI** - Modern, interactive API explorer
- **Try It Out** - Test API endpoints directly from the browser
- **Request Examples** - Pre-filled examples for all endpoints
- **Response Schemas** - Complete data models documentation
- **Multiple Servers** - Switch between dev/staging/prod environments

### OpenAPI 3.0 Specification
- **Complete API Definition** - All endpoints documented
- **Type Definitions** - Request/response schemas
- **Error Examples** - Common error scenarios
- **Security Schemes** - Future authentication methods
- **Webhook Documentation** - Callback payload schemas

---

## 📁 Files Created

### 1. OpenAPI Specification
**File:** `src/lib/openapi.json`

Complete API specification in OpenAPI 3.0 format:
- API metadata (version, description, license)
- Server URLs (local, production)
- Endpoint definitions (upload, status)
- Request/response schemas
- Error responses
- Webhook payload schemas

### 2. Swagger UI Page
**File:** `src/app/api-docs/page.tsx`

Interactive documentation page with:
- Swagger UI React component
- Dynamic OpenAPI spec loading
- Header with navigation
- Info banner with instructions
- Additional resources section
- Responsive design

### 3. API Endpoint for Spec
**File:** `src/app/api/openapi/route.ts`

Serves the OpenAPI spec with dynamic server URL:
- Auto-detects current server
- Uses `NEXT_PUBLIC_API_BASE_URL` if configured
- Returns JSON specification

### 4. API Configuration
**File:** `src/lib/config.ts`

Handles API base URL for cross-origin setups:
- Environment variable support
- Relative URL fallback
- Helper functions for API calls

### 5. Documentation
- **API_CONFIGURATION.md** - How to configure separate API servers
- **SWAGGER_SETUP.md** - This file

---

## 🌐 Access Points

### Swagger UI Page
```
http://localhost:14580/api-docs
```

Features:
- Interactive API explorer
- "Try it out" buttons
- Request/response examples
- Schema browser

### OpenAPI JSON
```
http://localhost:14580/api/openapi
```

Returns:
- OpenAPI 3.0 specification
- Dynamic server URLs
- Complete API documentation

---

## 🔧 Configuration

### Default (Same Origin)

No configuration needed! Swagger UI and API are on the same server.

```bash
# Just start the server
npm run dev

# Visit Swagger UI
open http://localhost:14580/api-docs
```

### Separate API Server

If your API runs on a different port/domain:

```bash
# .env
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

The Swagger UI will automatically use this base URL for "Try it out" requests.

---

## 📚 OpenAPI Specification Highlights

### Endpoints Documented

#### POST /api/upload
- **Purpose:** Upload document for OCR
- **Request:** multipart/form-data
- **Parameters:**
  - file (binary)
  - documentType (string)
  - email (email)
  - callbackWebhook (URL, optional)
- **Responses:**
  - 201: Success (job created)
  - 400: Validation errors (examples for each case)
  - 500: Internal error
- **Examples:**
  - Valid upload
  - MIME type mismatch
  - Image bomb detected
  - SSRF attempt blocked

#### GET /api/status/{id}
- **Purpose:** Get job status and results
- **Parameters:**
  - id (UUID path parameter)
- **Responses:**
  - 200: Status retrieved
  - 400: Invalid job ID
  - 404: Job not found
  - 500: Internal error
- **Examples:**
  - Pending job
  - Processing job
  - Completed job (with OCR result)
  - Failed job (with error message)

### Schemas Defined

#### UploadResponse
```json
{
  "id": "uuid",
  "status": "PENDING",
  "message": "string"
}
```

#### JobStatus
```json
{
  "id": "uuid",
  "status": "PENDING|PROCESSING|COMPLETED|FAILED",
  "documentType": "string",
  "email": "email",
  "ocrResult": "string (if completed)",
  "errorMessage": "string (if failed)",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "processedAt": "datetime (if processed)"
}
```

#### WebhookPayload
```json
{
  "jobId": "uuid",
  "email": "email",
  "ocrResult": "string",
  "timestamp": "datetime"
}
```

#### ErrorResponse
```json
{
  "error": "string",
  "details": "string | array"
}
```

---

## 🎨 UI Components

### Swagger UI Configuration

```typescript
<SwaggerUI
  spec={spec}
  deepLinking={true}           // Enable deep linking
  displayRequestDuration={true} // Show response time
  filter={true}                // Enable search/filter
  showExtensions={true}        // Show vendor extensions
  tryItOutEnabled={true}       // Enable "Try it out"
  persistAuthorization={true}  // Remember auth tokens
  docExpansion="list"          // Expand operations list
  defaultModelsExpandDepth={3} // Model expansion depth
/>
```

### Custom Styling

The Swagger UI page includes:
- Header with logo and navigation
- Info banner with instructions
- Swagger UI with custom container
- Footer with additional resources
- Responsive layout
- Tailwind CSS integration

---

## 🚀 Usage Examples

### Try It Out (In Browser)

1. Visit `http://localhost:14580/api-docs`
2. Click on **POST /api/upload**
3. Click **"Try it out"** button
4. Fill in the form:
   - Select a file
   - Enter document type: `invoice`
   - Enter email: `test@example.com`
   - (Optional) Enter webhook URL
5. Click **"Execute"**
6. View response with job ID
7. Copy job ID
8. Navigate to **GET /api/status/{id}**
9. Click **"Try it out"**
10. Paste job ID
11. Click **"Execute"**
12. View job status

### Download Spec

```bash
# Download OpenAPI spec
curl http://localhost:14580/api/openapi > openapi.json

# Use with other tools
swagger-cli validate openapi.json
```

### Import to Postman

1. Open Postman
2. Click "Import"
3. Enter URL: `http://localhost:14580/api/openapi`
4. Click "Import"
5. Collection created with all endpoints!

### Generate Client SDKs

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:14580/api/openapi \
  -g typescript-fetch \
  -o ./client

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:14580/api/openapi \
  -g python \
  -o ./client-python
```

---

## 🔍 Testing the Documentation

### Checklist

- [ ] Visit `/api-docs` page loads successfully
- [ ] Swagger UI displays both endpoints
- [ ] "Try it out" works for POST /api/upload
- [ ] File upload in Swagger UI succeeds
- [ ] "Try it out" works for GET /api/status/{id}
- [ ] Status check returns correct data
- [ ] Server dropdown shows current server
- [ ] Switching servers updates base URL
- [ ] Request examples are accurate
- [ ] Response examples match actual responses
- [ ] Schema definitions are correct
- [ ] Error examples cover all cases

---

## 📦 Dependencies Added

```json
{
  "dependencies": {
    "swagger-ui-react": "^5.11.0"
  },
  "devDependencies": {
    "@types/swagger-ui-react": "^4.18.3"
  }
}
```

**Total Size:** ~450KB (gzipped)

---

## 🎯 Benefits

### For Developers
- ✅ Test API without writing code
- ✅ See request/response examples
- ✅ Understand data schemas
- ✅ Try different scenarios
- ✅ Debug API issues

### For Integration
- ✅ Generate client SDKs automatically
- ✅ Import to Postman/Insomnia
- ✅ Share spec with team
- ✅ Version control API changes
- ✅ Standardized documentation

### For Users
- ✅ Self-service API exploration
- ✅ No separate documentation needed
- ✅ Always up-to-date
- ✅ Interactive learning
- ✅ Copy-paste examples

---

## 🔄 Updating the Spec

When you add/modify endpoints:

1. **Edit:** `src/lib/openapi.json`
2. **Add/Update:**
   - Path definition
   - Request parameters
   - Response schemas
   - Examples
3. **Save** - Changes reflect immediately
4. **Refresh** `/api-docs` page
5. **Test** - Use "Try it out"

### Example: Adding a New Endpoint

```json
{
  "paths": {
    "/api/jobs": {
      "get": {
        "tags": ["Jobs"],
        "summary": "List all jobs",
        "description": "Retrieve a list of all processing jobs",
        "responses": {
          "200": {
            "description": "Jobs retrieved successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/JobStatus"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 🛠️ Troubleshooting

### Issue: Swagger UI not loading

**Solution:** Check browser console for errors

```bash
# Verify spec is accessible
curl http://localhost:14580/api/openapi

# Check for JSON syntax errors
cat src/lib/openapi.json | jq .
```

### Issue: "Try it out" fails

**Solution:** Check CORS and server URL

1. Open browser DevTools → Network tab
2. Try the request
3. Check if request goes to correct URL
4. Verify CORS headers if cross-origin

### Issue: Server URL incorrect

**Solution:** Set environment variable

```bash
# .env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Restart the server for changes to take effect.

---

## 🎉 Summary

**What you have:**
- ✅ Complete OpenAPI 3.0 specification
- ✅ Interactive Swagger UI at `/api-docs`
- ✅ Try-it-out functionality
- ✅ Request/response examples
- ✅ Schema documentation
- ✅ Support for separate API servers
- ✅ Professional documentation page

**Access:**
- 🌐 Swagger UI: `http://localhost:14580/api-docs`
- 📄 OpenAPI JSON: `http://localhost:14580/api/openapi`

**Next steps:**
- Try the interactive documentation
- Import spec to Postman
- Generate client SDKs
- Share with your team!
