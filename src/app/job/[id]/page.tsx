'use client';

import { useRouter } from 'next/navigation';
import JobStatus from '@/components/JobStatus';

interface JobPageProps {
  params: {
    id: string;
  };
}

export default function JobPage({ params }: JobPageProps) {
  const router = useRouter();

  const handleClose = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">OCR Job Results</h1>
                <p className="text-sm text-gray-500">Job ID: {params.id}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Upload
            </button>
          </div>
        </div>
      </div>

      {/* Job Status Component */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <JobStatus jobId={params.id} onClose={handleClose} />
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Powered by Tesseract OCR • Built with Next.js & PostgreSQL</p>
      </div>
    </div>
  );
}
