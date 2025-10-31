# Admin Dashboard

The OCR API Service includes a comprehensive admin dashboard for monitoring and managing OCR jobs.

## Features

### 📊 Real-Time Statistics Dashboard
- **Total Jobs**: Overview of all jobs in the system
- **Status Breakdown**: Jobs by status (Pending, Processing, Completed, Failed)
- **Recent Activity**: Jobs submitted in the last hour
- **Average Processing Time**: Performance metrics for completed jobs
- **Stuck Job Detection**: Automatic detection of jobs processing longer than 10 minutes

### 📋 Job Management
- **Job List**: View all jobs with pagination and filtering
- **Status Filtering**: Filter by ALL, PENDING, PROCESSING, COMPLETED, FAILED
- **Job Details**: View complete information for any job
- **Auto-Refresh**: Optional 5-second auto-refresh for real-time monitoring

### 🔧 Job Actions
- **View Details**: See complete job information including processing time, file details, and error messages
- **Delete Jobs**: Remove completed or failed jobs from the queue
- **Force Delete**: Delete processing jobs (with confirmation)
- **Retry Jobs**: Reset failed or stuck jobs to PENDING status for reprocessing
- **Bulk Actions**: Manage stuck jobs directly from the alert banner

## Accessing the Admin Dashboard

### Web Interface
Navigate to: `http://localhost:3040/admin`

Or click the **Admin** link in the top navigation bar on the homepage.

### API Endpoints

#### Get Statistics
```bash
GET /api/admin/stats
```

**Response:**
```json
{
  "counts": {
    "pending": 2,
    "processing": 1,
    "completed": 43,
    "failed": 6,
    "total": 52
  },
  "recentActivity": {
    "lastHour": 9
  },
  "stuckJobs": [
    {
      "id": "job-uuid",
      "fileName": "document.pdf",
      "updatedAt": "2025-10-31T16:00:00.000Z",
      "stuckFor": 720000
    }
  ],
  "avgProcessingTime": 47536
}
```

#### List Jobs
```bash
GET /api/admin/jobs?status=ALL&limit=50&offset=0
```

**Parameters:**
- `status` - Filter by status: ALL, PENDING, PROCESSING, COMPLETED, FAILED
- `limit` - Number of jobs to return (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "jobs": [
    {
      "id": "job-uuid",
      "status": "COMPLETED",
      "documentType": "invoice",
      "email": "user@example.com",
      "fileName": "invoice.pdf",
      "mimeType": "application/pdf",
      "createdAt": "2025-10-31T16:00:00.000Z",
      "updatedAt": "2025-10-31T16:00:30.000Z",
      "processedAt": "2025-10-31T16:00:30.000Z",
      "errorMessage": null,
      "callbackWebhook": "https://example.com/webhook",
      "processingTime": 30000,
      "isStuck": false,
      "age": 3600000
    }
  ],
  "total": 52,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

#### Get Job Details
```bash
GET /api/admin/jobs/{jobId}
```

**Response:**
```json
{
  "id": "job-uuid",
  "status": "COMPLETED",
  "documentType": "invoice",
  "email": "user@example.com",
  "fileName": "invoice.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 1024000,
  "createdAt": "2025-10-31T16:00:00.000Z",
  "updatedAt": "2025-10-31T16:00:30.000Z",
  "processedAt": "2025-10-31T16:00:30.000Z",
  "ocrResult": "{...}",
  "errorMessage": null,
  "callbackWebhook": "https://example.com/webhook",
  "processingTime": 30000,
  "isStuck": false,
  "age": 3600000
}
```

#### Delete Job
```bash
DELETE /api/admin/jobs/{jobId}
```

**Force delete processing job:**
```bash
DELETE /api/admin/jobs/{jobId}?force=true
```

**Response:**
```json
{
  "message": "Job deleted successfully",
  "id": "job-uuid"
}
```

#### Update Job Status (Reset/Retry)
```bash
PATCH /api/admin/jobs/{jobId}
Content-Type: application/json

{
  "status": "PENDING"
}
```

**Response:**
```json
{
  "message": "Job updated successfully",
  "job": {
    "id": "job-uuid",
    "status": "PENDING",
    "documentType": "invoice",
    "email": "user@example.com",
    "fileName": "invoice.pdf",
    "createdAt": "2025-10-31T16:00:00.000Z",
    "updatedAt": "2025-10-31T16:01:00.000Z",
    "processedAt": null,
    "errorMessage": null
  }
}
```

## Stuck Job Detection

Jobs are automatically marked as "stuck" if:
- Status is **PROCESSING**
- No updates for more than **10 minutes**

### Handling Stuck Jobs

When stuck jobs are detected, an alert banner appears at the top of the admin dashboard:

1. **View Details**: Click the job to see what went wrong
2. **Reset**: Retry the job by resetting it to PENDING
3. **Delete**: Remove the job from the queue

### Common Causes of Stuck Jobs
- Worker process crashed or restarted
- Database connection lost during processing
- OCR timeout (very large files)
- Memory exhaustion

### Prevention
- Monitor worker logs: `docker compose logs worker -f`
- Scale workers horizontally: `docker compose up -d --scale worker=3`
- Increase processing timeout in worker configuration

## Job Status Flow

```
PENDING → PROCESSING → COMPLETED
                    ↓
                  FAILED
```

### Status Descriptions

- **PENDING**: Job queued, waiting for worker to pick it up
- **PROCESSING**: Worker is actively processing the job
- **COMPLETED**: OCR extraction successful
- **FAILED**: OCR extraction failed (see errorMessage)

## Performance Monitoring

### Key Metrics
- **Average Processing Time**: How long jobs take to complete
- **Queue Length**: Number of PENDING jobs
- **Processing Jobs**: Active workers busy with jobs
- **Failure Rate**: Failed jobs / Total jobs

### Optimization Tips
1. **High queue length**: Scale workers with `docker compose up -d --scale worker=3`
2. **Long processing times**: Check worker logs for bottlenecks
3. **High failure rate**: Review error messages and file validation

## Security Considerations

⚠️ **IMPORTANT**: The admin dashboard currently has **NO AUTHENTICATION**.

### Production Recommendations

Before deploying to production, implement authentication:

1. **Basic Auth**:
   ```typescript
   // middleware.ts
   export function middleware(request: NextRequest) {
     if (request.nextUrl.pathname.startsWith('/admin')) {
       const authHeader = request.headers.get('authorization');
       // Verify credentials
     }
   }
   ```

2. **API Key**:
   ```typescript
   const apiKey = request.headers.get('x-api-key');
   if (!isValidApiKey(apiKey)) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

3. **OAuth/JWT**:
   - Use NextAuth.js or similar
   - Require admin role for access

4. **IP Whitelist**:
   - Restrict admin access to specific IPs
   - Configure in reverse proxy (nginx, Cloudflare)

## Examples

### Monitor Job Processing
```bash
# Watch stats in real-time
watch -n 5 "curl -s http://localhost:3040/api/admin/stats | python3 -m json.tool"
```

### Find Failed Jobs
```bash
curl -s "http://localhost:3040/api/admin/jobs?status=FAILED" | python3 -m json.tool
```

### Delete Old Completed Jobs
```bash
# Get old jobs
curl -s "http://localhost:3040/api/admin/jobs?status=COMPLETED&limit=100" \
  | python3 -c "import sys,json; jobs=json.load(sys.stdin)['jobs']; print('\\n'.join([j['id'] for j in jobs]))" \
  > job_ids.txt

# Delete each job
while read job_id; do
  curl -X DELETE "http://localhost:3040/api/admin/jobs/$job_id"
  echo "Deleted $job_id"
done < job_ids.txt
```

### Reset All Stuck Jobs
```bash
curl -s "http://localhost:3040/api/admin/stats" \
  | python3 -c "import sys,json; stuck=json.load(sys.stdin)['stuckJobs']; [print(j['id']) for j in stuck]" \
  | while read job_id; do
      curl -X PATCH "http://localhost:3040/api/admin/jobs/$job_id" \
        -H "Content-Type: application/json" \
        -d '{"status":"PENDING"}'
      echo "Reset $job_id"
    done
```

## Troubleshooting

### Admin Page Not Loading
```bash
# Check API is running
curl http://localhost:3040/api/admin/stats

# Check Next.js logs
docker compose logs api
```

### Stats Show Zero Jobs
```bash
# Check database connection
docker compose exec postgres psql -U ocruser -d ocrdb -c "SELECT COUNT(*) FROM \"Job\";"

# Check Prisma schema is up to date
docker compose exec api npx prisma db push
```

### Can't Delete Processing Job
Use `force=true` parameter:
```bash
curl -X DELETE "http://localhost:3040/api/admin/jobs/{jobId}?force=true"
```

## Related Documentation

- [API Configuration](API_CONFIGURATION.md) - API URL setup
- [Production Features](PRODUCTION_FEATURES.md) - Production deployment
- [Security](SECURITY.md) - Security best practices
