import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Public, unauthenticated health probe used by the container healthcheck.
// (The old probe hit /api/admin/stats, which is now behind auth.) Verifies
// the process is up and the database is reachable.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'error', error: 'database unreachable' },
      { status: 503 }
    );
  }
}
