import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Get single job details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Calculate processing metadata
    const now = new Date();
    const createdAt = new Date(job.createdAt);
    const processingTime = job.processedAt
      ? new Date(job.processedAt).getTime() - createdAt.getTime()
      : now.getTime() - createdAt.getTime();

    const isStuck =
      job.status === 'PROCESSING' && processingTime > 10 * 60 * 1000;

    return NextResponse.json({
      ...job,
      fileData: undefined, // Don't send file data
      fileSizeBytes: job.fileData.length,
      processingTime,
      isStuck,
      age: now.getTime() - createdAt.getTime(),
    });
  } catch (error) {
    console.error('Admin job get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// Delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Don't allow deletion of processing jobs by default
    if (job.status === 'PROCESSING') {
      const force = request.nextUrl.searchParams.get('force') === 'true';
      if (!force) {
        return NextResponse.json(
          {
            error:
              'Cannot delete job that is currently processing. Use force=true to override.',
          },
          { status: 400 }
        );
      }
    }

    // Delete the job
    await prisma.job.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Job deleted successfully',
      id: params.id,
    });
  } catch (error) {
    console.error('Admin job delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}

// Update job status (reset stuck jobs)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, errorMessage } = body;

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update the job
    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'PENDING') {
        // Reset job to pending (e.g., to retry)
        updateData.errorMessage = null;
        updateData.processedAt = null;
      }
      if (status === 'FAILED' && errorMessage) {
        updateData.errorMessage = errorMessage;
        updateData.processedAt = new Date();
      }
    }

    const job = await prisma.job.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        status: true,
        documentType: true,
        email: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({
      message: 'Job updated successfully',
      job,
    });
  } catch (error) {
    console.error('Admin job update error:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}
