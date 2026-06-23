# OCR API Service

A production-ready, queue-based OCR (Optical Character Recognition) API built as a SaaS product. Upload documents, receive a job ID, and get notified via webhook when processing is complete.

## Features

- 🎨 **Modern Web UI** - Interactive drag-and-drop file upload with real-time status updates
- 🚀 **Queue-based processing** - Upload files and process them asynchronously
- 📄 **Multiple formats** - Support for images (PNG, JPEG, TIFF, BMP, WebP) and PDFs
- ✍️ **Handwriting recognition** - PP-OCRv5 models recognize handwritten text; a dedicated handwriting mode adds contrast-boosting preprocessing
- 🌍 **13 languages** - Selectable per upload (European languages, Chinese, Japanese, Korean, Arabic, Russian)
- 🔬 **Image preprocessing** - EXIF rotation, transparency flattening, and automatic upscaling of small images before OCR
- ⚡ **Batched PDF OCR** - All pages of a scanned PDF run through a single model load instead of one per page
- 🔔 **Webhook callbacks** - Get notified when OCR processing completes
- 🆔 **Job tracking** - Query job status and results by ID
- 🐳 **Docker ready** - Full Docker Compose setup included
- 💾 **No disk writes** - All file processing happens in memory
- 🔒 **PostgreSQL backend** - Reliable job queue and result storage
- 🛡️ **Comprehensive file validation** - Protection against malicious uploads, MIME spoofing, and image bombs
- ⏱️ **Timeout protection** - 5-minute limit prevents infinite processing
- 🚫 **SSRF protection** - Webhook URLs validated to block internal network access
- ⚡ **Real-time polling** - Automatic status updates every 2 seconds
- 👨‍💼 **Admin Dashboard** - Monitor jobs, detect stuck processes, manage queue

## Architecture

- **Next.js 14** - Modern React framework for API routes and frontend
- **PostgreSQL** - Database for job queue and results
- **Prisma** - Type-safe database ORM
- **PaddleOCR 3.x (PP-OCRv5)** - OCR engine for printed and handwritten text with multilingual support
- **Docker** - Containerized deployment
- **Background Worker** - Separate process for OCR job processing

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Quick Start with Docker

```bash
# Clone and configure
git clone <repository-url>
cd ocr
cp .env.example .env

# Start services
docker compose up -d

# Access the application
open http://localhost:14580         # Web Interface
open http://localhost:14580/admin   # Admin Dashboard
open http://localhost:14580/api-docs # API Documentation
```

This will start:
- PostgreSQL database on port 15433 (mapped from 5432)
- Next.js API on port 14580
- Background worker for OCR processing

**📚 For Production Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide including NGINX setup, SSL, scaling, monitoring, and security.

3. Access the API at `http://localhost:14580`

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Start PostgreSQL (via Docker):
```bash
docker-compose up postgres -d
```

4. Push database schema:
```bash
npm run prisma:push
```

5. Start the development server:
```bash
npm run dev
```

6. In a separate terminal, start the worker:
```bash
npm run worker
```

> **Note:** Running OCR locally (outside Docker) requires Python 3 with
> PaddleOCR installed: `pip install paddlepaddle==3.0.0 paddleocr==3.2.0`.
> Set `PYTHON_BIN` in `.env` if your interpreter isn't `python`/`python3`.

### Running Tests

```bash
npm test            # Playwright E2E suite (starts the dev server itself)
npm run test:ui     # Interactive test runner
```

Keep `npm run worker` running in another terminal — the job-completion test
waits for a real OCR result.

## API Documentation

### 📖 Interactive Swagger UI

Visit **http://localhost:14580/api-docs** for the full interactive API documentation with:
- ✅ Try-it-out functionality for all endpoints
- ✅ Request/response examples
- ✅ Complete schema documentation
- ✅ OpenAPI 3.0 specification

### Upload a Document

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (required) - The document file to process
- `documentType` (required) - Type of document (e.g., "invoice", "receipt", "contract")
- `email` (required) - Email address for notifications
- `callbackWebhook` (optional) - URL to receive POST callback when processing completes
- `language` (optional, default `eng`) - Document language: `eng`, `fra`, `deu`, `spa`, `ita`, `por`, `nld`, `chi_sim`, `chi_tra`, `jpn`, `kor`, `ara`, `rus`
- `ocrMode` (optional, default `auto`) - Recognition mode: `auto`, `printed`, or `handwriting` (boosts contrast and sharpens strokes for handwritten documents)

**Example with curl:**
```bash
curl -X POST http://localhost:14580/api/upload \
  -F "file=@/path/to/document.png" \
  -F "documentType=invoice" \
  -F "email=user@example.com" \
  -F "callbackWebhook=https://your-app.com/webhook"
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "File uploaded successfully and queued for processing"
}
```

### Check Job Status

**Endpoint:** `GET /api/status/:id`

**Example:**
```bash
curl http://localhost:14580/api/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (Pending):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "documentType": "invoice",
  "email": "user@example.com",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

**Response (Completed):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "documentType": "invoice",
  "email": "user@example.com",
  "ocrResult": "Extracted text from the document...",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:15Z",
  "processedAt": "2025-01-15T10:30:15Z"
}
```

**Response (Failed):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "documentType": "invoice",
  "email": "user@example.com",
  "errorMessage": "OCR processing failed: Invalid image format",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:10Z",
  "processedAt": "2025-01-15T10:30:10Z"
}
```

## Webhook Callback

When a job completes and a `callbackWebhook` was provided, the API will send a POST request to the webhook URL:

**Callback Payload:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "ocrResult": "Extracted text from the document...",
  "timestamp": "2025-01-15T10:30:15Z"
}
```

## Supported File Formats

- **Images:** PNG, JPEG, JPG, TIFF, BMP, WebP
- **Documents:** PDF
- **Max file size:** 50MB

## Database Schema

The service uses a single `jobs` table with the following structure:

```prisma
model Job {
  id              String    @id @default(uuid())
  status          JobStatus @default(PENDING)
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
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

## Environment Variables

```env
DATABASE_URL="postgresql://ocruser:ocrpassword@localhost:5432/ocrdb"
NODE_ENV="development"
```

## Scaling

The architecture supports horizontal scaling:

- **API servers:** Run multiple Next.js instances behind a load balancer
- **Workers:** Increase the `replicas` count in `docker-compose.yml` for the worker service
- **Database:** Use PostgreSQL connection pooling (e.g., PgBouncer) for high concurrency

## Monitoring

Check worker logs:
```bash
docker-compose logs -f worker
```

Check API logs:
```bash
docker-compose logs -f api
```

## Development Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run worker` - Start background worker
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:push` - Push schema to database
- `npm run prisma:migrate` - Create and run migrations

## Security

### File Validation (Implemented ✅)

The API includes comprehensive file validation to protect against malicious uploads:

- **Magic Number Detection** - Actual file type detected from binary content (cannot be spoofed)
- **Image Bomb Protection** - Prevents decompression bombs with pixel and dimension limits
- **PDF Security** - Blocks JavaScript, embedded files, and encrypted PDFs
- **SSRF Prevention** - Webhook URLs validated to block private/internal network access
- **Processing Timeouts** - 5-minute maximum prevents resource exhaustion
- **Defense in Depth** - Files validated at upload AND before processing

See [docs/FILE_VALIDATION.md](docs/FILE_VALIDATION.md) for detailed implementation and attack vectors prevented.

### Additional Security Needed for Production ⚠️

Before deploying to production, implement:

1. **Authentication & Authorization** - API keys or JWT tokens
2. **Rate Limiting** - Prevent abuse (e.g., 10 uploads/hour per user)
3. **HTTPS/TLS** - Encrypt data in transit
4. **Access Controls** - Users can only view their own jobs
5. **Webhook Signatures** - HMAC signing for callbacks
6. **Audit Logging** - Track all API access

See [docs/SECURITY.md](docs/SECURITY.md) for complete production hardening checklist.

## Admin Dashboard

Access the admin dashboard at: **http://localhost:14580/admin**

Features:
- 📊 Real-time job statistics and monitoring
- 📋 View all jobs with filtering by status
- 🔍 Detect stuck jobs automatically (processing > 10 minutes)
- 🔄 Retry failed or stuck jobs
- 🗑️ Delete jobs from the queue
- ⚡ Auto-refresh every 5 seconds
- 📈 Performance metrics (avg processing time, recent activity)

See [docs/ADMIN_DASHBOARD.md](docs/ADMIN_DASHBOARD.md) for complete documentation.

⚠️ **Security Note**: Admin dashboard has no authentication by default. Implement auth before production deployment.

## 📚 Documentation

### Quick References

- [QUICK_START.md](QUICK_START.md) - Quick start commands for dev and production
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full production deployment guide
- [DOCKER_COMPOSE_UNIFIED.md](DOCKER_COMPOSE_UNIFIED.md) - Understanding the unified docker-compose setup
- [PRODUCTION_COMPOSE.md](PRODUCTION_COMPOSE.md) - Production docker-compose configuration guide
- [DOWNLOAD_API_SPEC.md](DOWNLOAD_API_SPEC.md) - How to download OpenAPI specification

### Database Setup

- [docs/EXTERNAL_DATABASE.md](docs/EXTERNAL_DATABASE.md) - Using external PostgreSQL
- [docs/TURSO_SETUP.md](docs/TURSO_SETUP.md) - Using Turso (edge SQLite)

### Feature Documentation

- [docs/ADMIN_DASHBOARD.md](docs/ADMIN_DASHBOARD.md) - Admin dashboard and job management
- [docs/API_CONFIGURATION.md](docs/API_CONFIGURATION.md) - API URL configuration and setup
- [docs/ENHANCED_STRUCTURE.md](docs/ENHANCED_STRUCTURE.md) - Enhanced OCR output structure
- [docs/ENTITY_EXTRACTION.md](docs/ENTITY_EXTRACTION.md) - Entity extraction features
- [docs/EXAMPLES.md](docs/EXAMPLES.md) - Usage examples
- [docs/FILE_VALIDATION.md](docs/FILE_VALIDATION.md) - File validation and security
- [docs/FRONTEND.md](docs/FRONTEND.md) - Frontend implementation guide
- [docs/PRODUCTION_FEATURES.md](docs/PRODUCTION_FEATURES.md) - Production-ready features
- [docs/ROUTING.md](docs/ROUTING.md) - API routing documentation
- [docs/SECURITY.md](docs/SECURITY.md) - Security implementation details
- [docs/STRUCTURED_OUTPUT.md](docs/STRUCTURED_OUTPUT.md) - Structured OCR output format
- [docs/SWAGGER_SETUP.md](docs/SWAGGER_SETUP.md) - Swagger/OpenAPI setup guide

## License

Free for personal and commercial use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
