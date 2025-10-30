import { PrismaClient } from '@prisma/client';
import { OCRService } from '../services/ocr';
import { WebhookService } from '../services/webhook';
import { FileValidationService } from '../services/fileValidation';

const prisma = new PrismaClient();
const ocrService = new OCRService();
const webhookService = new WebhookService();
const fileValidator = new FileValidationService();

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT = 5 * 60 * 1000; // 5 minutes max per job
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10); // Process up to 3 jobs simultaneously

async function processNextJob(): Promise<boolean> {
  try {
    // Find the oldest pending job and lock it
    const job = await prisma.$transaction(async (tx) => {
      const pendingJob = await tx.job.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      if (!pendingJob) {
        return null;
      }

      // Update to PROCESSING to lock it
      return await tx.job.update({
        where: { id: pendingJob.id },
        data: { status: 'PROCESSING' },
      });
    });

    if (!job) {
      return false; // No jobs to process
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
  console.log(`Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
  console.log(`Polling for jobs every ${POLL_INTERVAL}ms`);

  const activeJobs = new Set<Promise<void>>();

  while (true) {
    try {
      // Clean up completed jobs
      const completed: Promise<void>[] = [];
      for (const job of activeJobs) {
        const result = await Promise.race([
          job.then(() => 'done'),
          Promise.resolve('pending')
        ]);
        if (result === 'done') {
          completed.push(job);
        }
      }
      completed.forEach(job => activeJobs.delete(job));

      // Start new jobs if we have capacity
      if (activeJobs.size < MAX_CONCURRENT_JOBS) {
        const processed = await processNextJob();

        if (processed) {
          // Job started, add tracking (but don't await)
          const jobPromise = Promise.resolve();
          activeJobs.add(jobPromise);
        } else {
          // No jobs available, wait before next poll
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        }
      } else {
        // At capacity, wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
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
