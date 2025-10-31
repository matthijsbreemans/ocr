'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType: string;
  email: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  callbackWebhook: string | null;
  processingTime: number;
  isStuck: boolean;
  age: number;
}

interface Stats {
  counts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  recentActivity: {
    lastHour: number;
  };
  stuckJobs: Array<{
    id: string;
    fileName: string;
    updatedAt: string;
    stuckFor: number;
  }>;
  avgProcessingTime: number;
}

export default function AdminPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const url = `/api/admin/jobs?status=${selectedStatus}&limit=50`;
      const response = await fetch(url);
      const data = await response.json();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteJob = async (jobId: string, force: boolean = false) => {
    if (
      !confirm(
        force
          ? 'Force delete this processing job?'
          : 'Are you sure you want to delete this job?'
      )
    ) {
      return;
    }

    try {
      const url = `/api/admin/jobs/${jobId}${force ? '?force=true' : ''}`;
      const response = await fetch(url, { method: 'DELETE' });

      if (response.ok) {
        alert('Job deleted successfully');
        fetchJobs();
        fetchStats();
      } else {
        const error = await response.json();
        alert(`Failed to delete job: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job');
    }
  };

  const resetJob = async (jobId: string) => {
    if (!confirm('Reset this job to PENDING status? It will be reprocessed.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING' }),
      });

      if (response.ok) {
        alert('Job reset successfully');
        fetchJobs();
        fetchStats();
      } else {
        const error = await response.json();
        alert(`Failed to reset job: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to reset job:', error);
      alert('Failed to reset job');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, [selectedStatus]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
      fetchJobs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, selectedStatus]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Auto-refresh (5s)</span>
            </label>
            <button
              onClick={() => {
                fetchStats();
                fetchJobs();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">Total Jobs</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.counts.total}
              </div>
            </div>
            <div className="bg-yellow-50 p-6 rounded-lg shadow">
              <div className="text-sm text-yellow-700 mb-1">Pending</div>
              <div className="text-3xl font-bold text-yellow-900">
                {stats.counts.pending}
              </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg shadow">
              <div className="text-sm text-blue-700 mb-1">Processing</div>
              <div className="text-3xl font-bold text-blue-900">
                {stats.counts.processing}
              </div>
            </div>
            <div className="bg-green-50 p-6 rounded-lg shadow">
              <div className="text-sm text-green-700 mb-1">Completed</div>
              <div className="text-3xl font-bold text-green-900">
                {stats.counts.completed}
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Failed Jobs</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.counts.failed}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Last Hour Activity</div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.recentActivity.lastHour}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Avg Processing Time</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(stats.avgProcessingTime)}
              </div>
            </div>
          </div>
        )}

        {/* Stuck Jobs Alert */}
        {stats && stats.stuckJobs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {stats.stuckJobs.length} Stuck Job
                  {stats.stuckJobs.length > 1 ? 's' : ''} Detected
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    {stats.stuckJobs.map((job) => (
                      <li key={job.id}>
                        {job.fileName} - stuck for {formatTime(job.stuckFor)}
                        <button
                          onClick={() => resetJob(job.id)}
                          className="ml-2 text-red-900 underline hover:no-underline"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => deleteJob(job.id, true)}
                          className="ml-2 text-red-900 underline hover:no-underline"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 ${
                      selectedStatus === status
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {status}
                    {stats && status !== 'ALL' && (
                      <span className="ml-2 text-xs">
                        ({stats.counts[status.toLowerCase() as keyof typeof stats.counts]})
                      </span>
                    )}
                  </button>
                )
              )}
            </nav>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No jobs found for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className={job.isStuck ? 'bg-red-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {job.status}
                          {job.isStuck && ' ⚠️'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="max-w-xs truncate">{job.fileName}</div>
                        <div className="text-xs text-gray-500">
                          {job.mimeType}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.documentType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(
                          job.processingTime
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        {(job.status === 'FAILED' || job.isStuck) && (
                          <button
                            onClick={() => resetJob(job.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Retry
                          </button>
                        )}
                        {job.status !== 'PROCESSING' ? (
                          <button
                            onClick={() => deleteJob(job.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => deleteJob(job.id, true)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Force Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Job Details
                  </h2>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Job ID
                    </label>
                    <div className="text-sm text-gray-900 font-mono">
                      {selectedJob.id}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Status
                    </label>
                    <div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          selectedJob.status
                        )}`}
                      >
                        {selectedJob.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      File Name
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedJob.fileName}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Document Type
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedJob.documentType}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Email
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedJob.email}
                    </div>
                  </div>

                  {selectedJob.callbackWebhook && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Webhook URL
                      </label>
                      <div className="text-sm text-gray-900 break-all">
                        {selectedJob.callbackWebhook}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Created At
                    </label>
                    <div className="text-sm text-gray-900">
                      {new Date(selectedJob.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {selectedJob.processedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Processed At
                      </label>
                      <div className="text-sm text-gray-900">
                        {new Date(selectedJob.processedAt).toLocaleString()}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Processing Time
                    </label>
                    <div className="text-sm text-gray-900">
                      {formatTime(selectedJob.processingTime)}
                    </div>
                  </div>

                  {selectedJob.errorMessage && (
                    <div>
                      <label className="text-sm font-medium text-red-500">
                        Error Message
                      </label>
                      <div className="text-sm text-red-700 bg-red-50 p-3 rounded">
                        {selectedJob.errorMessage}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => {
                      window.open(`/job/${selectedJob.id}`, '_blank');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    View Status Page
                  </button>
                  {(selectedJob.status === 'FAILED' || selectedJob.isStuck) && (
                    <button
                      onClick={() => {
                        resetJob(selectedJob.id);
                        setSelectedJob(null);
                      }}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      Retry Job
                    </button>
                  )}
                  <button
                    onClick={() => {
                      deleteJob(
                        selectedJob.id,
                        selectedJob.status === 'PROCESSING'
                      );
                      setSelectedJob(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete Job
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
