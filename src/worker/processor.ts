import { prisma } from '../lib/db';
import { OCRService } from '../services/ocr';
import { WebhookService } from '../services/webhook';
import { FileValidationService } from '../services/fileValidation';

const ocrService = new OCRService();
const webhookService = new WebhookService();
const fileValidator = new FileValidationService();

const POLL_INTERVAL = 5000; // 5 seconds
const PROCESSING_TIMEOUT = 5 * 60 * 1000; // 5 minutes max per job

async function processNextJob(): Promise<boolean> {
  try {
    // Find the oldest pending job
    const pendingJob = await prisma.job.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!pendingJob) {
      return false; // No jobs to process
    }

    // Atomically claim the job only if it's still PENDING.
    // This prevents race conditions with multiple worker replicas:
    // if another worker already claimed it, count will be 0.
    const claimed = await prisma.job.updateMany({
      where: { id: pendingJob.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) {
      return true; // Another worker claimed it, loop again immediately
    }

    // Fetch the full job data now that we own it
    const job = await prisma.job.findUnique({
      where: { id: pendingJob.id },
    });

    if (!job) {
      return false;
    }

    console.log(`Processing job ${job.id}...`);

    try {
      // DEFENSE IN DEPTH: Re-validate file before processing
      // Protects against corrupted database or malicious data injection
      console.log(`Re-validating file for job ${job.id}...`);
      const validationResult = await fileValidator.validateFile(
        job.fileData,
        job.mimeType
      );

      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.error}`);
      }

      console.log(`File re-validation passed for job ${job.id}`);

      // Process the OCR with timeout protection
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout exceeded')), PROCESSING_TIMEOUT)
      );

      const ocrPromise = ocrService.processDocument(
        validationResult.sanitizedBuffer || job.fileData,
        job.mimeType,
        { language: 'eng', structured: true }
      );

      const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);

      // Serialize the structured result to JSON
      const resultJson = JSON.stringify(ocrResult, null, 2);

      // Update job with results
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          ocrResult: resultJson,
          processedAt: new Date(),
        },
      });

      console.log(`Job ${job.id} completed successfully`);

      // Send webhook if configured (don't fail job if webhook fails)
      if (job.callbackWebhook) {
        try {
          await webhookService.sendCallback(
            job.callbackWebhook,
            job.id,
            resultJson,
            job.email
          );
        } catch (webhookError) {
          console.error(`Webhook failed for job ${job.id}:`, webhookError);
          // Continue - job is still successful even if webhook fails
        }
      }

      return true;
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);

      // Mark job as failed
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        },
      });

      return true;
    }
  } catch (error) {
    console.error('Error processing job:', error);
    return false;
  }
}

async function runWorker() {
  console.log('OCR Worker started');
  console.log(`Polling for jobs every ${POLL_INTERVAL}ms`);

  // Simple sequential processing - poll for jobs and process them one at a time
  // The concurrency is managed by running multiple worker containers, not by
  // running multiple jobs in parallel within a single worker
  while (true) {
    try {
      const processed = await processNextJob();

      if (!processed) {
        // No jobs available, wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
      // If a job was processed, immediately check for the next one
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
runWorker().catch(async (error) => {
  console.error('Worker crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
