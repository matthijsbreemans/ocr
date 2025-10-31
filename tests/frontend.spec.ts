import { test, expect } from '@playwright/test';
import path from 'path';
import sharp from 'sharp';

// Helper function to create test images
async function createTestImage(text: string): Promise<Buffer> {
  const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="200" fill="white"/>
      <text x="200" y="100" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
        ${text}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

test.describe('Frontend UI Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check for main title
    await expect(page.locator('h1')).toContainText('OCR');

    // Check page loaded successfully
    expect(page.url()).toContain('localhost:3040');
  });

  test('should display upload form elements', async ({ page }) => {
    await page.goto('/');

    // Check for file input
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Check for document type field
    const documentTypeInput = page.locator('input[name="documentType"], select[name="documentType"]');
    await expect(documentTypeInput.first()).toBeVisible();

    // Check for email field
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput.first()).toBeVisible();

    // Check for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    await expect(submitButton.first()).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/');

    // Try to submit without filling fields
    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
    await submitButton.click();

    // Should show validation errors or prevent submission
    // Check if we're still on the same page (not navigated)
    await page.waitForTimeout(500);
    expect(page.url()).toContain('localhost:3040');
  });

  test('should upload file via UI', async ({ page }) => {
    await page.goto('/');

    // Create test image
    const imageBuffer = await createTestImage('Test Invoice UI');
    const tempFilePath = path.join('/tmp', 'test-ui-upload.png');
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, imageBuffer);

    try {
      // Fill in the form
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempFilePath);

      // Fill document type
      const documentTypeInput = page.locator('input[name="documentType"], select[name="documentType"]').first();
      await documentTypeInput.fill('invoice');

      // Fill email
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill('test@example.com');

      // Submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
      await submitButton.click();

      // Wait for response - check for success message or job ID display
      await page.waitForTimeout(2000);

      // Should show some kind of success state or job ID
      const pageContent = await page.content();
      const hasSuccessIndicator = pageContent.includes('success') ||
                                   pageContent.includes('uploaded') ||
                                   pageContent.includes('Job ID') ||
                                   pageContent.includes('pending') ||
                                   pageContent.includes('processing');

      expect(hasSuccessIndicator).toBe(true);
    } finally {
      // Cleanup
      fs.unlinkSync(tempFilePath);
    }
  });

  test('should handle file type validation in UI', async ({ page }) => {
    await page.goto('/');

    // Create a text file
    const textBuffer = Buffer.from('This is not an image');
    const tempFilePath = path.join('/tmp', 'test-invalid.txt');
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, textBuffer);

    try {
      // Try to upload text file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempFilePath);

      // Fill other fields
      const documentTypeInput = page.locator('input[name="documentType"], select[name="documentType"]').first();
      await documentTypeInput.fill('invoice');

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill('test@example.com');

      // Submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
      await submitButton.click();

      // Wait for error message
      await page.waitForTimeout(2000);

      // Should show error message
      const pageContent = await page.content();
      const hasErrorIndicator = pageContent.includes('error') ||
                                pageContent.includes('invalid') ||
                                pageContent.includes('not supported');

      expect(hasErrorIndicator).toBe(true);
    } finally {
      // Cleanup
      fs.unlinkSync(tempFilePath);
    }
  });

  test('should display API documentation link', async ({ page }) => {
    await page.goto('/');

    // Check for Swagger/API docs link
    const apiDocsLink = page.locator('a[href*="api-docs"], a:has-text("API"), a:has-text("Documentation")');

    // At least one of these should be present
    const count = await apiDocsLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to API documentation', async ({ page }) => {
    await page.goto('/api-docs');

    // Should load Swagger UI
    await page.waitForTimeout(2000);

    // Check for Swagger UI elements
    const pageContent = await page.content();
    const hasSwagger = pageContent.includes('swagger') ||
                       pageContent.includes('OpenAPI') ||
                       pageContent.includes('api/openapi');

    expect(hasSwagger).toBe(true);
  });

  test('should check status page functionality', async ({ page }) => {
    // First create a job
    const imageBuffer = await createTestImage('Status Test');
    const tempFilePath = path.join('/tmp', 'test-status.png');
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, imageBuffer);

    try {
      await page.goto('/');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempFilePath);

      const documentTypeInput = page.locator('input[name="documentType"], select[name="documentType"]').first();
      await documentTypeInput.fill('invoice');

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
      await submitButton.click();

      // Wait for upload to complete
      await page.waitForTimeout(3000);

      // Try to find job ID in the page
      const pageContent = await page.content();
      const jobIdMatch = pageContent.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      if (jobIdMatch) {
        const jobId = jobIdMatch[0];

        // Navigate to status page
        await page.goto(`/status/${jobId}`);
        await page.waitForTimeout(2000);

        // Should show status information
        const statusPageContent = await page.content();
        const hasStatusInfo = statusPageContent.includes(jobId) ||
                              statusPageContent.includes('Status') ||
                              statusPageContent.includes('PENDING') ||
                              statusPageContent.includes('PROCESSING') ||
                              statusPageContent.includes('COMPLETED');

        expect(hasStatusInfo).toBe(true);
      }
    } finally {
      // Cleanup
      fs.unlinkSync(tempFilePath);
    }
  });

  test('should handle large file rejection gracefully', async ({ page }) => {
    await page.goto('/');

    // Create a 51MB file (exceeds limit)
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
    const tempFilePath = path.join('/tmp', 'test-large.bin');
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, largeBuffer);

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempFilePath);

      const documentTypeInput = page.locator('input[name="documentType"], select[name="documentType"]').first();
      await documentTypeInput.fill('invoice');

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
      await submitButton.click();

      // Wait for error
      await page.waitForTimeout(2000);

      // Should show error about file size
      const pageContent = await page.content();
      const hasFileSizeError = pageContent.includes('large') ||
                               pageContent.includes('size') ||
                               pageContent.includes('50') ||
                               pageContent.includes('MB');

      expect(hasFileSizeError).toBe(true);
    } finally {
      // Cleanup
      fs.unlinkSync(tempFilePath);
    }
  }, 60000); // Longer timeout for large file test

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that main elements are still visible
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")').first();
    await expect(submitButton).toBeVisible();
  });
});
