import nodemailer, { type Transporter } from 'nodemailer';
import { getAppDomain } from '../lib/config';

/**
 * Minimal SMTP email service, used to notify users when a webhook delivery
 * fails (the only way they'd otherwise know their result was lost, since
 * "don't store" jobs keep no server-side copy).
 *
 * Configure via env (all optional — email is simply skipped when unset):
 *   SMTP_HOST            - SMTP server hostname (presence enables email)
 *   SMTP_PORT            - default 587
 *   SMTP_SECURE          - "true" for implicit TLS (port 465), else STARTTLS
 *   SMTP_USER / SMTP_PASS- credentials (omit for unauthenticated relays)
 *   SMTP_FROM            - From address, e.g. "OCR API <ocr@example.com>"
 */

export const EMAIL_CONFIGURED = Boolean(process.env.SMTP_HOST);

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!EMAIL_CONFIGURED) return null;
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Bound how long a hung SMTP server can block the (sequential) worker.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export class EmailService {
  /**
   * Notify a user that the webhook delivery for their job failed. Best-effort:
   * never throws, so a mail outage can't crash the worker.
   */
  async sendWebhookFailureNotice(
    to: string,
    jobId: string,
    reason: string,
    opts: { stored?: boolean } = {}
  ): Promise<void> {
    const mailer = getTransporter();
    if (!mailer) {
      console.warn(
        `Email not configured (SMTP_HOST unset); skipping failure notice for job ${jobId}`
      );
      return;
    }

    const domain = getAppDomain();
    const from = process.env.SMTP_FROM || 'OCR API <no-reply@localhost>';

    // The result is only lost when the job opted out of server-side storage;
    // otherwise it's still retrievable from the status page.
    const outcome = opts.stored
      ? [
          `The OCR result was still stored and remains available on the status`,
          `page below.`,
        ]
      : [
          `Because this job was submitted without server-side storage, the`,
          `result has not been retained. Please re-submit the document.`,
        ];

    try {
      await mailer.sendMail({
        from,
        to,
        subject: `OCR job ${jobId} failed: webhook delivery error`,
        text: [
          `Your OCR job ${jobId} completed processing, but the result could not`,
          `be delivered to your callback webhook.`,
          ``,
          `Reason: ${reason}`,
          ``,
          ...outcome,
          ``,
          `Status page: ${domain}/job/${jobId}`,
        ].join('\n'),
      });
      console.log(`Sent webhook-failure email for job ${jobId} to ${to}`);
    } catch (error) {
      console.error(`Failed to send failure email for job ${jobId}:`, error);
    }
  }
}
