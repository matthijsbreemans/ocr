# API Usage Examples

## Upload a Document

### Basic Upload (Image)
```bash
curl -X POST http://localhost:3040/api/upload \
  -F "file=@sample-invoice.png" \
  -F "documentType=invoice" \
  -F "email=user@example.com"
```

### Upload with Webhook Callback
```bash
curl -X POST http://localhost:3040/api/upload \
  -F "file=@contract.pdf" \
  -F "documentType=contract" \
  -F "email=legal@company.com" \
  -F "callbackWebhook=https://your-app.com/webhooks/ocr"
```

### Upload Response
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PENDING",
  "message": "File uploaded successfully and queued for processing"
}
```

## Check Job Status

### Query Job Status
```bash
curl http://localhost:3040/api/status/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Status Response - Pending
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PENDING",
  "documentType": "invoice",
  "email": "user@example.com",
  "createdAt": "2025-10-21T10:00:00.000Z",
  "updatedAt": "2025-10-21T10:00:00.000Z"
}
```

### Status Response - Processing
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PROCESSING",
  "documentType": "invoice",
  "email": "user@example.com",
  "createdAt": "2025-10-21T10:00:00.000Z",
  "updatedAt": "2025-10-21T10:00:05.000Z"
}
```

### Status Response - Completed
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "COMPLETED",
  "documentType": "invoice",
  "email": "user@example.com",
  "ocrResult": "INVOICE\n\nBill To: Acme Corp\nDate: 2025-10-20\nAmount: $1,234.56\n\nItems:\n1. Widget A - $500.00\n2. Widget B - $734.56\n\nTotal: $1,234.56",
  "createdAt": "2025-10-21T10:00:00.000Z",
  "updatedAt": "2025-10-21T10:00:15.000Z",
  "processedAt": "2025-10-21T10:00:15.000Z"
}
```

### Status Response - Failed
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "FAILED",
  "documentType": "invoice",
  "email": "user@example.com",
  "errorMessage": "OCR processing failed: Image quality too low",
  "createdAt": "2025-10-21T10:00:00.000Z",
  "updatedAt": "2025-10-21T10:00:10.000Z",
  "processedAt": "2025-10-21T10:00:10.000Z"
}
```

## Webhook Callback

When processing completes, if a webhook URL was provided, the API sends:

```http
POST https://your-app.com/webhooks/ocr
Content-Type: application/json

{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "user@example.com",
  "ocrResult": "INVOICE\n\nBill To: Acme Corp...",
  "timestamp": "2025-10-21T10:00:15.000Z"
}
```

## JavaScript/TypeScript Example

```typescript
// Upload a file
async function uploadDocument(file: File, email: string, documentType: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('email', email);
  formData.append('documentType', documentType);
  formData.append('callbackWebhook', 'https://your-app.com/webhook');

  const response = await fetch('http://localhost:3040/api/upload', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
}

// Check job status
async function checkStatus(jobId: string) {
  const response = await fetch(`http://localhost:3040/api/status/${jobId}`);
  return await response.json();
}

// Poll for completion
async function waitForCompletion(jobId: string): Promise<string> {
  while (true) {
    const status = await checkStatus(jobId);

    if (status.status === 'COMPLETED') {
      return status.ocrResult;
    }

    if (status.status === 'FAILED') {
      throw new Error(status.errorMessage);
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Usage
const result = await uploadDocument(myFile, 'user@example.com', 'invoice');
const ocrText = await waitForCompletion(result.id);
console.log('OCR Result:', ocrText);
```

## Python Example

```python
import requests
import time

def upload_document(file_path, email, document_type, webhook_url=None):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'email': email,
            'documentType': document_type,
        }
        if webhook_url:
            data['callbackWebhook'] = webhook_url

        response = requests.post('http://localhost:3040/api/upload', files=files, data=data)
        return response.json()

def check_status(job_id):
    response = requests.get(f'http://localhost:3040/api/status/{job_id}')
    return response.json()

def wait_for_completion(job_id, timeout=300):
    start_time = time.time()

    while time.time() - start_time < timeout:
        status = check_status(job_id)

        if status['status'] == 'COMPLETED':
            return status['ocrResult']

        if status['status'] == 'FAILED':
            raise Exception(status.get('errorMessage', 'OCR failed'))

        time.sleep(2)

    raise TimeoutError('Job did not complete within timeout period')

# Usage
result = upload_document('invoice.png', 'user@example.com', 'invoice')
ocr_text = wait_for_completion(result['id'])
print('OCR Result:', ocr_text)
```

## Testing with the Test Client

1. Open `test-client.html` in your browser
2. Select a file (image or PDF)
3. Fill in the required fields
4. Click "Upload & Process"
5. Watch as the status updates automatically

## Error Responses

### Invalid File Type
```json
{
  "error": "Invalid file type. Allowed types: image/png, image/jpeg, image/jpg, image/tiff, image/bmp, image/webp, application/pdf"
}
```

### File Too Large
```json
{
  "error": "File size exceeds maximum allowed size of 50MB"
}
```

### Invalid Job ID
```json
{
  "error": "Invalid job ID format"
}
```

### Job Not Found
```json
{
  "error": "Job not found"
}
```

### Validation Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_string",
      "validation": "email",
      "path": ["email"],
      "message": "Valid email is required"
    }
  ]
}
```
