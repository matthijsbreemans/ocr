import { z } from 'zod';

// Custom webhook URL validator to prevent SSRF attacks
const webhookUrlValidator = z
  .string()
  .url('Valid webhook URL required')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);

        // Block localhost and local IPs
        const blockedHostnames = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '::1',
          '[::1]',
        ];

        if (blockedHostnames.includes(parsed.hostname.toLowerCase())) {
          return false;
        }

        // Block private IP ranges
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
          hostname.startsWith('169.254.') // Link-local
        ) {
          return false;
        }

        // Allow both HTTP and HTTPS
        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        'Webhook URL must not point to private/local networks.',
    }
  );

export const uploadSchema = z.object({
  documentType: z.string().min(1, 'Document type is required'),
  email: z.string().email('Valid email is required'),
  callbackWebhook: webhookUrlValidator.optional(),
});

export type UploadRequest = z.infer<typeof uploadSchema>;

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
