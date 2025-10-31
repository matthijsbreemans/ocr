import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get status counts
    const [pending, processing, completed, failed, total] = await Promise.all([
      prisma.job.count({ where: { status: 'PENDING' } }),
      prisma.job.count({ where: { status: 'PROCESSING' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: 'FAILED' } }),
      prisma.job.count(),
    ]);

    // Get recent activity (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentJobs = await prisma.job.count({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Get stuck jobs (processing for more than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: {
          lt: tenMinutesAgo,
        },
      },
      select: {
        id: true,
        fileName: true,
        updatedAt: true,
      },
    });

    // Get average processing time for completed jobs (last 100)
    const recentCompleted = await prisma.job.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { processedAt: 'desc' },
      take: 100,
      select: {
        createdAt: true,
        processedAt: true,
      },
    });

    const avgProcessingTime =
      recentCompleted.length > 0
        ? recentCompleted.reduce((sum, job) => {
            if (job.processedAt) {
              return (
                sum +
                (new Date(job.processedAt).getTime() -
                  new Date(job.createdAt).getTime())
              );
            }
            return sum;
          }, 0) / recentCompleted.length
        : 0;

    return NextResponse.json({
      counts: {
        pending,
        processing,
        completed,
        failed,
        total,
      },
      recentActivity: {
        lastHour: recentJobs,
      },
      stuckJobs: stuckJobs.map((job) => ({
        ...job,
        stuckFor: Date.now() - new Date(job.updatedAt).getTime(),
      })),
      avgProcessingTime: Math.round(avgProcessingTime),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
