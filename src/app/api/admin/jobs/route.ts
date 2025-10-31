import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Get jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          documentType: true,
          email: true,
          fileName: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true,
          processedAt: true,
          errorMessage: true,
          callbackWebhook: true,
        },
      }),
      prisma.job.count({ where }),
    ]);

    // Calculate processing time for each job
    const jobsWithMetadata = jobs.map((job) => {
      const now = new Date();
      const createdAt = new Date(job.createdAt);
      const processingTime = job.processedAt
        ? new Date(job.processedAt).getTime() - createdAt.getTime()
        : now.getTime() - createdAt.getTime();

      // Determine if job is stuck (processing for more than 10 minutes)
      const isStuck =
        job.status === 'PROCESSING' && processingTime > 10 * 60 * 1000;

      return {
        ...job,
        processingTime,
        isStuck,
        age: now.getTime() - createdAt.getTime(),
      };
    });

    return NextResponse.json({
      jobs: jobsWithMetadata,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Admin jobs list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
