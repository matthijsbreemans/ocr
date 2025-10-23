import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid job ID format' },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        documentType: true,
        email: true,
        ocrResult: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Build response based on status
    const response: any = {
      id: job.id,
      status: job.status,
      documentType: job.documentType,
      email: job.email,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    if (job.status === 'COMPLETED') {
      response.ocrResult = job.ocrResult;
      response.processedAt = job.processedAt;
    }

    if (job.status === 'FAILED') {
      response.errorMessage = job.errorMessage;
      response.processedAt = job.processedAt;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
