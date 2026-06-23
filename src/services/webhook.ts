import { lookup } from 'dns/promises';
import { isPrivateHostname } from '../lib/schemas';
import { getAppDomain } from '../lib/config';

export interface WebhookResult {
  ok: boolean;
  /** Human-readable failure reason, present when ok is false. */
  error?: string;
}

/**
 * Resolve the webhook host and reject if it (or any of its resolved addresses)
 * is a private/internal IP. The schema already blocks literal private hosts at
 * upload time; this closes the gap where a public DNS name resolves to a
 * private IP (SSRF / metadata-endpoint access). A residual TOCTOU remains
 * because fetch re-resolves, but combined with the literal-host validation and
 * redirect:'error' this blocks the practical vectors.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isPrivateHostname(hostname)) {
    throw new Error('Webhook host resolves to a private/internal address');
  }
  const addresses = await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateHostname(address)) {
      throw new Error('Webhook host resolves to a private/internal address');
    }
  }
}

export class WebhookService {
  /**
   * Send OCR results to the callback webhook.
   *
   * Returns a result object rather than throwing: the caller decides what a
   * delivery failure means. This matters for "don't store" jobs, where the
   * webhook is the only delivery channel and a failure must fail the job.
   *
   * @param webhookUrl - The URL to send the POST request to
   * @param jobId - The job ID
   * @param ocrResult - The extracted text (serialized JSON)
   * @param email - The user's email
   * @param opts.stored - Whether the result is also retained server-side
   */
  async sendCallback(
    webhookUrl: string,
    jobId: string,
    ocrResult: string,
    email: string,
    opts: { stored?: boolean } = {}
  ): Promise<WebhookResult> {
    // Build status page URL from configurable domain
    const statusUrl = `${getAppDomain()}/job/${jobId}`;

    // SSRF guard: reject hosts that resolve to private/internal addresses
    // before we open any connection.
    try {
      const host = new URL(webhookUrl).hostname.replace(/^\[|\]$/g, '');
      await assertPublicHost(host);
    } catch (validationError) {
      const error =
        validationError instanceof Error
          ? validationError.message
          : 'Webhook host validation failed';
      console.error(`Webhook blocked for job ${jobId}: ${error}`);
      return { ok: false, error };
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        signal: controller.signal,
        redirect: 'error', // Block redirects to prevent SSRF via open redirect
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OCR-API/1.0',
        },
        body: JSON.stringify({
          jobId,
          ocrResult,
          // Signals to the receiver that this payload is the only copy of the
          // result — it won't be retrievable from the status page afterwards.
          stored: opts.stored !== false,
          statusUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = `Webhook returned status ${response.status}`;
        console.error(`Webhook failed for job ${jobId}: ${error}`);
        return { ok: false, error };
      }

      console.log(`Webhook sent successfully for job ${jobId}`);
      return { ok: true };
    } catch (fetchError) {
      clearTimeout(timeout);

      const error =
        fetchError instanceof Error && fetchError.name === 'AbortError'
          ? 'Webhook request timed out after 10 seconds'
          : fetchError instanceof Error
            ? fetchError.message
            : 'Unknown webhook error';

      console.error(`Failed to send webhook for job ${jobId}:`, error);
      return { ok: false, error };
    }
  }
}
