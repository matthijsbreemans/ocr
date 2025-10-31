import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Helper function to create test images
async function createTestImage(text: string): Promise<Buffer> {
  const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="200" fill="white"/>
      <text x="200" y="100" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
        ${text}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

test.describe('OCR API Tests', () => {
  test.describe('API Upload Endpoint', () => {
    test('should accept valid image upload', async ({ request }) => {
      const imageBuffer = await createTestImage('Test Invoice #12345');

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'test.png');
      formData.append('documentType', 'invoice');
      formData.append('email', 'test@example.com');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('PENDING');
    });

    test('should reject upload without required fields', async ({ request }) => {
      const imageBuffer = await createTestImage('Test');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          // Missing documentType and email
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should reject files that are too large', async ({ request }) => {
      // Create a 51MB file (exceeds 50MB limit)
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024);

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'large.png',
            mimeType: 'image/png',
            buffer: largeBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should reject invalid file types', async ({ request }) => {
      const textBuffer = Buffer.from('This is not an image');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: textBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should reject invalid email format', async ({ request }) => {
      const imageBuffer = await createTestImage('Test');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'invalid-email',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should accept optional webhook URL', async ({ request }) => {
      const imageBuffer = await createTestImage('Test');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
          callbackWebhook: 'http://example.com/webhook',
        },
      });

      expect(response.status()).toBe(200);
    });
  });

  test.describe('API Status Endpoint', () => {
    let jobId: string;

    test.beforeEach(async ({ request }) => {
      // Create a job first
      const imageBuffer = await createTestImage('Test Job');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      const data = await response.json();
      jobId = data.id;
    });

    test('should return job status by ID', async ({ request }) => {
      const response = await request.get(`/api/status/${jobId}`);

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id', jobId);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('documentType', 'invoice');
      expect(data).toHaveProperty('email', 'test@example.com');
    });

    test('should return 404 for non-existent job', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.get(`/api/status/${fakeId}`);

      expect(response.status()).toBe(404);
    });

    test('should return 400 for invalid UUID format', async ({ request }) => {
      const response = await request.get('/api/status/invalid-id');

      expect(response.status()).toBe(400);
    });

    test('should eventually complete job processing', async ({ request }) => {
      // Poll for job completion
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      let completed = false;

      while (attempts < maxAttempts && !completed) {
        const response = await request.get(`/api/status/${jobId}`);
        const data = await response.json();

        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          completed = true;
          expect(['COMPLETED', 'FAILED']).toContain(data.status);

          if (data.status === 'COMPLETED') {
            expect(data).toHaveProperty('ocrResult');
            expect(data.ocrResult).toBeTruthy();
          } else {
            expect(data).toHaveProperty('errorMessage');
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(completed).toBe(true);
    }, 120000); // 2 minute timeout for this test
  });

  test.describe('API OpenAPI Documentation', () => {
    test('should serve OpenAPI spec at /api/openapi', async ({ request }) => {
      const response = await request.get('/api/openapi');

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data).toHaveProperty('info');
      expect(data).toHaveProperty('paths');
    });
  });

  test.describe('File Validation Security', () => {
    test('should detect MIME type spoofing', async ({ request }) => {
      // Create a text file but claim it's a PNG
      const textBuffer = Buffer.from('This is actually text, not an image');

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'fake.png',
            mimeType: 'image/png',
            buffer: textBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      // Should reject due to magic number validation
      expect(response.status()).toBe(400);
    });

    test('should accept valid JPEG images', async ({ request }) => {
      // Create a simple JPEG
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
      .jpeg()
      .toBuffer();

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.jpg',
            mimeType: 'image/jpeg',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(200);
    });

    test('should accept valid WebP images', async ({ request }) => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
      .webp()
      .toBuffer();

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.webp',
            mimeType: 'image/webp',
            buffer: imageBuffer,
          },
          documentType: 'invoice',
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(200);
    });
  });
});
