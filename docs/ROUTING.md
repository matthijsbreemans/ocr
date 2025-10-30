# URL Routing for OCR Jobs

## Overview

The OCR API now uses URL-based routing for job status pages. After uploading a document, users are automatically redirected to a dedicated page with the job ID in the URL.

## Route Structure

### Homepage: `/`
- **Purpose**: Upload documents
- **Features**:
  - Drag & drop file upload
  - Form with document type, email, webhook
  - Feature highlights sidebar
  - Supported formats list

### Job Status Page: `/job/[id]`
- **Purpose**: View OCR results for a specific job
- **URL Format**: `/job/abc-123-def-456`
- **Features**:
  - Real-time status polling
  - 4-tab result viewer (Plain Text, Document Analysis, Block Hierarchy, Raw JSON)
  - Auto-refresh until completion
  - "Back to Upload" button
  - Shareable URL

## User Flow

```
1. User visits homepage (/)
   ↓
2. User uploads document
   ↓
3. Upload form calls POST /api/upload
   ↓
4. API returns { id: "abc-123" }
   ↓
5. Frontend navigates to /job/abc-123
   ↓
6. Job page loads and polls /api/status/abc-123
   ↓
7. Page updates automatically every 2 seconds
   ↓
8. When complete, polling stops and results displayed
```

## Benefits

### 1. **Shareable URLs**
Users can copy and share the job URL with others:
```
http://localhost:3040/job/abc-123-def-456
```

### 2. **Browser History**
- Back button returns to upload page
- Forward button goes back to job status
- Refresh page maintains state

### 3. **Bookmarkable**
Users can bookmark job URLs to check results later

### 4. **Better UX**
- Clear separation between upload and results
- No modal popups or inline state
- Professional app-like navigation

### 5. **Direct Access**
Users can directly access job status by URL without going through upload page

## Implementation Details

### File Structure
```
src/
├── app/
│   ├── page.tsx                    # Homepage with upload form
│   ├── job/
│   │   └── [id]/
│   │       └── page.tsx            # Job status page (dynamic route)
│   └── api/
│       ├── upload/route.ts         # Upload endpoint
│       └── status/[id]/route.ts    # Status endpoint
└── components/
    ├── UploadForm.tsx              # Upload form with navigation
    └── JobStatus.tsx               # Job status display component
```

### Key Components

#### 1. Homepage (`src/app/page.tsx`)
```typescript
export default function Home() {
  return (
    <main>
      <h1>OCR API Service</h1>
      <UploadForm />  {/* No callback needed */}
    </main>
  );
}
```

#### 2. Job Page (`src/app/job/[id]/page.tsx`)
```typescript
export default function JobPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <div>
      <h1>OCR Job Results</h1>
      <p>Job ID: {params.id}</p>
      <JobStatus jobId={params.id} onClose={() => router.push('/')} />
    </div>
  );
}
```

#### 3. Upload Form (`src/components/UploadForm.tsx`)
```typescript
export default function UploadForm() {
  const router = useRouter();

  const handleSubmit = async (e) => {
    // ... upload logic ...
    const data = await response.json();

    // Navigate to job page
    router.push(`/job/${data.id}`);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## API Endpoints

### POST `/api/upload`
**Request:**
```bash
curl -X POST http://localhost:3040/api/upload \
  -F "file=@document.pdf" \
  -F "documentType=invoice" \
  -F "email=user@example.com"
```

**Response:**
```json
{
  "id": "abc-123-def-456",
  "status": "PENDING",
  "message": "Job created successfully"
}
```

### GET `/api/status/[id]`
**Request:**
```bash
curl http://localhost:3040/api/status/abc-123-def-456
```

**Response:**
```json
{
  "id": "abc-123-def-456",
  "status": "COMPLETED",
  "ocrResult": "{...}",
  "createdAt": "2025-10-21T10:00:00Z",
  "processedAt": "2025-10-21T10:00:25Z"
}
```

## URL Parameters

The job ID is passed as a dynamic route parameter:
- **Pattern**: `/job/[id]`
- **Example**: `/job/abc-123-def-456`
- **Access in code**: `params.id`

Next.js automatically:
- Captures the ID from the URL
- Passes it to the page component
- Handles routing and navigation
- Manages browser history

## Navigation Flow

### From Homepage to Job Page
```typescript
// In UploadForm.tsx
router.push(`/job/${jobId}`);
```

### From Job Page to Homepage
```typescript
// In JobStatus.tsx
router.push('/');
```

### Browser Back Button
Works automatically - users can navigate back to the upload page

### Direct URL Access
Users can type or paste a job URL directly:
```
http://localhost:3040/job/abc-123-def-456
```

## Testing

### Manual Testing

1. **Upload Flow**
   ```
   1. Visit http://localhost:3040
   2. Upload a document
   3. Observe automatic redirect to /job/[id]
   4. Verify URL contains job ID
   5. Check that polling works
   6. Click "Back to Upload" button
   7. Verify return to homepage
   ```

2. **Direct Access**
   ```
   1. Copy a job URL
   2. Open in new tab
   3. Verify job status loads correctly
   4. Refresh page
   5. Verify state persists
   ```

3. **Browser Navigation**
   ```
   1. Upload document (redirects to /job/[id])
   2. Click browser back button
   3. Verify return to homepage (/)
   4. Click browser forward button
   5. Verify return to job page
   ```

### API Testing
```bash
# Upload document
RESPONSE=$(curl -s -X POST http://localhost:3040/api/upload \
  -F "file=@test.png" \
  -F "documentType=test" \
  -F "email=test@example.com")

# Extract job ID
JOB_ID=$(echo $RESPONSE | jq -r '.id')

# Access job URL
echo "Job URL: http://localhost:3040/job/$JOB_ID"

# Check status
curl http://localhost:3040/api/status/$JOB_ID
```

## Advantages Over Modal/Inline Display

### Before (Modal/Inline)
❌ No shareable URLs
❌ State lost on refresh
❌ Can't bookmark jobs
❌ No browser history
❌ Harder to test
❌ Less professional UX

### After (URL Routing)
✅ Shareable URLs
✅ State preserved on refresh
✅ Bookmarkable pages
✅ Browser back/forward works
✅ Easy to test and debug
✅ Professional app-like UX
✅ Direct access to specific jobs
✅ Better SEO (if needed)

## Future Enhancements

Potential improvements:
- [ ] **Query parameters** - Add filters like `?view=analysis&tab=tables`
- [ ] **Job history page** - `/jobs` to list all user's jobs
- [ ] **Search by ID** - Search bar to quickly find job
- [ ] **404 handling** - Custom 404 page for invalid job IDs
- [ ] **Loading states** - Show skeleton while job loads
- [ ] **Error boundaries** - Better error handling for missing jobs

## Migration Notes

### Changes Made

1. **Removed from Homepage (`src/app/page.tsx`)**:
   - `currentJobId` state
   - `handleUploadSuccess` callback
   - `handleCloseStatus` callback
   - `JobStatus` component import
   - Conditional rendering logic

2. **Updated Upload Form (`src/components/UploadForm.tsx`)**:
   - Removed `onUploadSuccess` prop
   - Added `useRouter()` hook
   - Changed success handler to `router.push(`/job/${id}`)`
   - No longer resets form (page navigation clears it)

3. **Created Job Page (`src/app/job/[id]/page.tsx`)**:
   - New dynamic route
   - Receives job ID from URL params
   - Renders `JobStatus` component
   - Handles navigation back to homepage

### Backward Compatibility

✅ **API endpoints unchanged** - `/api/upload` and `/api/status/[id]` work exactly the same

✅ **JobStatus component unchanged** - Still works the same way, just rendered on different page

✅ **Webhook callbacks unchanged** - Still work as before

✅ **Data structure unchanged** - All OCR results have same format

## Troubleshooting

### Issue: "Cannot GET /job/[id]"
**Solution**: Make sure the page.tsx file exists at `src/app/job/[id]/page.tsx`

### Issue: Page doesn't redirect after upload
**Solution**: Check browser console for errors, verify `useRouter()` import from `'next/navigation'`

### Issue: Job ID not showing in URL
**Solution**: Verify `router.push()` is called with correct template string: `` `/job/${id}` ``

### Issue: Back button doesn't work
**Solution**: Use Next.js `useRouter()` instead of `window.location`, it handles history properly

## Summary

The URL routing implementation provides a professional, user-friendly experience for viewing OCR job results. Users can now:
- 🔗 Share job URLs with others
- 📌 Bookmark jobs for later
- ↩️ Use browser navigation naturally
- 🔄 Refresh without losing state
- 🎯 Access jobs directly via URL

**Access the application**: http://localhost:3040

Upload a document and watch the automatic redirect to `/job/[id]`!

---

**Last Updated**: 2025-10-21
**Version**: 5.0.0
**Status**: ✅ Production Ready
