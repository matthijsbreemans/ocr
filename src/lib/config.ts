/**
 * API Configuration
 *
 * By default, API calls use relative URLs (same origin as frontend).
 * Set NEXT_PUBLIC_API_BASE_URL to use a different API server.
 *
 * Examples:
 * - Development: http://localhost:4000
 * - Production: https://api.your-domain.com
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/**
 * Get full API URL for an endpoint
 * @param path - API path (e.g., '/api/upload')
 * @returns Full URL
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if API_BASE_URL is set (it should include the full base)
  if (API_BASE_URL) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${API_BASE_URL}/${cleanPath}`;
  }

  // Use relative URL (same origin)
  return path;
}

/**
 * Get the server URL for OpenAPI spec
 */
export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use window.location.origin or configured API base
    return API_BASE_URL || window.location.origin;
  }

  // Server-side: use configured API base or default
  return API_BASE_URL || 'http://localhost:3040';
}
