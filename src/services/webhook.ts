export class WebhookService {
  /**
   * Send OCR results to the callback webhook
   * @param webhookUrl - The URL to send the POST request to
   * @param jobId - The job ID
   * @param ocrResult - The extracted text
   * @param email - The user's email
   */
  async sendCallback(
    webhookUrl: string,
    jobId: string,
    ocrResult: string,
    email: string
  ): Promise<void> {
    try {
      // Build status page URL from configurable domain
      const domain = process.env.APP_DOMAIN || 'http://localhost:3040';
      const statusUrl = `${domain}/job/${jobId}`;

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OCR-API/1.0',
        },
        body: JSON.stringify({
          jobId,
          email,
          ocrResult,
          statusUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
      }

      console.log(`Webhook sent successfully for job ${jobId}`);
    } catch (error) {
      console.error(`Failed to send webhook for job ${jobId}:`, error);
      // Don't throw - we don't want webhook failures to mark the job as failed
      // The user can still query the API for results
    }
  }
}
