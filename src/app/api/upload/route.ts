import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadSchema } from '@/lib/schemas';
import { FileValidationService } from '@/services/fileValidation';
import { uploadRateLimiter } from '@/lib/rateLimit';

const fileValidator = new FileValidationService();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 uploads per minute per IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const { allowed, remaining, retryAfterMs } = uploadRateLimiter.check(clientIp);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const formData = await request.formData();

    // Extract form fields
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string;
    const email = formData.get('email') as string;
    const callbackWebhook = formData.get('callbackWebhook') as string | null;
    const storeResult = formData.get('storeResult') as string | null;
    const language = formData.get('language') as string | null;
    const ocrMode = formData.get('ocrMode') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate other fields
    const validation = uploadSchema.safeParse({
      documentType,
      email,
      callbackWebhook: callbackWebhook || undefined,
      storeResult: storeResult ?? undefined,
      language: language || undefined,
      ocrMode: ocrMode || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Convert file to buffer (no disk write)
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // COMPREHENSIVE FILE VALIDATION - Protects against:
    // - MIME type spoofing
    // - Image bombs / decompression bombs
    // - Malformed PDFs
    // - Excessive file sizes
    // - Malicious content
    console.log(`Validating file: ${file.name} (claimed type: ${file.type}, size: ${fileBuffer.length} bytes)`);

    const validationResult = await fileValidator.validateFile(fileBuffer, file.type);

    if (!validationResult.isValid) {
      console.warn(`File validation failed for ${file.name}: ${validationResult.error}`);
      return NextResponse.json(
        {
          error: 'File validation failed',
          details: validationResult.error,
        },
        { status: 400 }
      );
    }

    console.log(`File validated successfully: ${file.name} (detected type: ${validationResult.detectedType})`);

    // Use sanitized buffer from validation
    const sanitizedBuffer = validationResult.sanitizedBuffer || fileBuffer;

    // Create job in database with validated data
    const job = await prisma.job.create({
      data: {
        documentType: validation.data.documentType,
        email: validation.data.email,
        callbackWebhook: validation.data.callbackWebhook || null,
        storeResult: validation.data.storeResult,
        language: validation.data.language,
        ocrMode: validation.data.ocrMode,
        fileData: sanitizedBuffer,
        fileName: file.name,
        mimeType: validationResult.detectedType || file.type, // Use detected type, not claimed
        status: 'PENDING',
      },
    });

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        message: 'File uploaded successfully and queued for processing',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
