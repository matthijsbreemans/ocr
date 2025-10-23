import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import openApiSpec from '@/lib/openapi.json';

export async function GET(request: NextRequest) {
  // Dynamically set the server URL based on the request origin or environment variable
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3040';
  const serverUrl = apiBaseUrl || (origin.startsWith('http') ? origin : `http://${origin}`);

  // Clone the spec and update the servers array
  const spec = {
    ...openApiSpec,
    servers: [
      {
        url: serverUrl,
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server',
      },
      ...openApiSpec.servers,
    ],
  };

  return NextResponse.json(spec);
}
