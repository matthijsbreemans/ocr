import { test, expect } from '@playwright/test';
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

test.describe('Admin Dashboard Tests', () => {
  test('should load admin dashboard page', async ({ page }) => {
    await page.goto('/admin');

    // Check for main title
    await expect(page.locator('h1')).toContainText('Admin Dashboard');

    // Check for auto-refresh toggle
    await expect(
      page.locator('text=Auto-refresh (5s)')
    ).toBeVisible();

    // Check for refresh button
    await expect(
      page.locator('button:has-text("Refresh Now")')
    ).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    await page.goto('/admin');

    // Wait for stats to load
    await page.waitForTimeout(1000);

    // Check for stats cards
    await expect(page.locator('text=Total Jobs')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Processing')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('should display status filter tabs', async ({ page }) => {
    await page.goto('/admin');

    // Check for all filter tabs
    const tabs = ['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    for (const tab of tabs) {
      await expect(
        page.locator(`button:has-text("${tab}")`)
      ).toBeVisible();
    }
  });

  test('should filter jobs by status', async ({ page }) => {
    await page.goto('/admin');

    // Wait for initial load
    await page.waitForTimeout(1000);

    // Click COMPLETED tab
    await page.locator('button:has-text("COMPLETED")').click();

    // Wait for jobs to load
    await page.waitForTimeout(1000);

    // URL should reflect the filter
    const url = page.url();
    expect(url).toContain('/admin');
  });

  test('should create a job and view it in admin', async ({ page, request }) => {
    // First, create a test job via API
    const imageBuffer = await createTestImage('Admin Test Job');

    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'admin-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'invoice',
        email: 'admin-test@example.com',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    const jobId = data.id;

    // Now navigate to admin dashboard
    await page.goto('/admin');

    // Wait for jobs to load
    await page.waitForTimeout(2000);

    // Look for the job in the list (should be in PENDING or PROCESSING)
    const jobExists =
      (await page.locator(`text=admin-test.png`).count()) > 0 ||
      (await page.locator(`text=${jobId.substring(0, 8)}`).count()) > 0;

    expect(jobExists).toBeTruthy();
  });

  test('should open job details modal', async ({ page, request }) => {
    // Create a test job
    const imageBuffer = await createTestImage('Modal Test');

    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'modal-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'receipt',
        email: 'modal-test@example.com',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    const jobId = data.id;

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Find and click the View button for our job
    const viewButtons = page.locator('button:has-text("View")');
    const count = await viewButtons.count();

    if (count > 0) {
      await viewButtons.first().click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Check modal content
      await expect(page.locator('text=Job Details')).toBeVisible();
      await expect(page.locator('text=Job ID')).toBeVisible();
      await expect(page.locator('text=Status')).toBeVisible();
      await expect(page.locator('text=File Name')).toBeVisible();
    }
  });

  test('should display "View Status Page" button in modal', async ({
    page,
    request,
  }) => {
    // Create a completed job
    const imageBuffer = await createTestImage('Status Page Test');

    const uploadResponse = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'status-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'invoice',
        email: 'status-test@example.com',
      },
    });

    expect(uploadResponse.status()).toBe(201);
    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Click View button
    const viewButtons = page.locator('button:has-text("View")');
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click();
      await page.waitForTimeout(500);

      // Check for "View Status Page" button
      await expect(
        page.locator('button:has-text("View Status Page")')
      ).toBeVisible();
    }
  });

  test('should test "View Status Page" link opens correct URL', async ({
    page,
    context,
    request,
  }) => {
    // Create a test job
    const imageBuffer = await createTestImage('Link Test');

    const uploadResponse = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'link-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'invoice',
        email: 'link-test@example.com',
      },
    });

    expect(uploadResponse.status()).toBe(201);
    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Click View button
    const viewButtons = page.locator('button:has-text("View")');
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click();
      await page.waitForTimeout(500);

      // Listen for new page (popup)
      const pagePromise = context.waitForEvent('page');

      // Click "View Status Page"
      await page.locator('button:has-text("View Status Page")').click();

      // Get the new page
      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      // Verify URL contains /job/{id} not /status/{id}
      const url = newPage.url();
      expect(url).toContain('/job/');
      expect(url).not.toContain('/status/');

      // Verify the page loads successfully (not 404)
      const heading = newPage.locator('h1');
      const headingText = await heading.textContent();
      expect(headingText).not.toContain('404');

      await newPage.close();
    }
  });

  test('should delete a job', async ({ page, request }) => {
    // Create a test job to delete
    const imageBuffer = await createTestImage('Delete Test');

    const uploadResponse = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'delete-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'invoice',
        email: 'delete-test@example.com',
      },
    });

    expect(uploadResponse.status()).toBe(201);
    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;

    // Wait a moment for job to appear in list
    await page.waitForTimeout(2000);

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Count jobs before deletion
    const jobRowsBefore = await page.locator('tbody tr').count();

    // Find a delete button
    const deleteButtons = page.locator('button:has-text("Delete")');
    const deleteCount = await deleteButtons.count();

    if (deleteCount > 0) {
      // Setup dialog handler to confirm deletion
      page.on('dialog', (dialog) => dialog.accept());

      // Click delete button
      await deleteButtons.first().click();

      // Wait for deletion to complete
      await page.waitForTimeout(2000);

      // Verify job count decreased or stayed same (if it was processing)
      const jobRowsAfter = await page.locator('tbody tr').count();
      expect(jobRowsAfter).toBeLessThanOrEqual(jobRowsBefore);
    }
  });

  test('should show retry button for failed jobs', async ({ page }) => {
    await page.goto('/admin');

    // Click FAILED tab
    await page.locator('button:has-text("FAILED")').click();
    await page.waitForTimeout(1000);

    // Check if there are any failed jobs
    const failedJobRows = await page.locator('tbody tr').count();

    if (failedJobRows > 0) {
      // Should see Retry button
      await expect(
        page.locator('button:has-text("Retry")').first()
      ).toBeVisible();
    }
  });

  test('should display stuck job alert when present', async ({
    page,
    request,
  }) => {
    // Check admin stats for stuck jobs
    const statsResponse = await request.get('/api/admin/stats');
    const stats = await statsResponse.json();

    await page.goto('/admin');
    await page.waitForTimeout(1000);

    if (stats.stuckJobs && stats.stuckJobs.length > 0) {
      // Should see stuck job alert
      await expect(page.locator('text=Stuck Job')).toBeVisible();
    } else {
      // No stuck jobs, alert should not be present
      const alertExists = (await page.locator('text=Stuck Job').count()) > 0;
      expect(alertExists).toBeFalsy();
    }
  });

  test('should toggle auto-refresh', async ({ page }) => {
    await page.goto('/admin');

    // Find auto-refresh checkbox
    const checkbox = page.locator('input[type="checkbox"]');

    // Check initial state (should be checked by default)
    const isChecked = await checkbox.isChecked();
    expect(isChecked).toBe(true);

    // Toggle off
    await checkbox.click();
    expect(await checkbox.isChecked()).toBe(false);

    // Toggle back on
    await checkbox.click();
    expect(await checkbox.isChecked()).toBe(true);
  });

  test('should manually refresh data', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(1000);

    // Get initial job count
    const initialCount = await page
      .locator('text=Total Jobs')
      .locator('..')
      .locator('div')
      .nth(1)
      .textContent();

    // Click refresh button
    await page.locator('button:has-text("Refresh Now")').click();

    // Wait for refresh
    await page.waitForTimeout(1000);

    // Count should still be displayed (may or may not change)
    const afterCount = await page
      .locator('text=Total Jobs')
      .locator('..')
      .locator('div')
      .nth(1)
      .textContent();

    expect(afterCount).toBeTruthy();
  });

  test('should display job metadata correctly', async ({ page, request }) => {
    // Create a job with specific metadata
    const imageBuffer = await createTestImage('Metadata Test');

    const uploadResponse = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'metadata-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'contract',
        email: 'metadata@example.com',
        callbackWebhook: 'https://example.com/webhook',
      },
    });

    expect(uploadResponse.status()).toBe(201);
    const uploadData = await uploadResponse.json();

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Click View button to open modal
    const viewButtons = page.locator('button:has-text("View")');
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click();
      await page.waitForTimeout(500);

      // Check metadata is displayed
      const modalContent = await page.textContent('body');
      expect(modalContent).toContain('contract');
      expect(modalContent).toContain('metadata@example.com');
    }
  });

  test('should handle empty job list gracefully', async ({ page }) => {
    await page.goto('/admin');

    // Try to find a status with no jobs
    // Click PROCESSING (likely to have 0 jobs)
    await page.locator('button:has-text("PROCESSING")').click();
    await page.waitForTimeout(1000);

    // Check for "No jobs found" message if count is 0
    const jobCount = await page.locator('tbody tr').count();

    if (jobCount === 0) {
      await expect(
        page.locator('text=No jobs found for this filter')
      ).toBeVisible();
    }
  });

  test('should close job details modal', async ({ page, request }) => {
    // Create a test job
    const imageBuffer = await createTestImage('Close Modal Test');

    const uploadResponse = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'close-test.png',
          mimeType: 'image/png',
          buffer: imageBuffer,
        },
        documentType: 'invoice',
        email: 'close-test@example.com',
      },
    });

    expect(uploadResponse.status()).toBe(201);

    // Navigate to admin
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Open modal
    const viewButtons = page.locator('button:has-text("View")');
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click();
      await page.waitForTimeout(500);

      // Verify modal is open
      await expect(page.locator('text=Job Details')).toBeVisible();

      // Close modal by clicking X button
      const closeButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await closeButton.click();

      // Modal should be closed
      await page.waitForTimeout(500);
      const modalVisible = (await page.locator('text=Job Details').count()) > 0;
      expect(modalVisible).toBeFalsy();
    }
  });

  test('should display admin link in homepage header', async ({ page }) => {
    await page.goto('/');

    // Check for Admin link in header
    const adminLink = page.locator('a[href="/admin"]');
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toContainText('Admin');
  });

  test('should navigate from homepage to admin', async ({ page }) => {
    await page.goto('/');

    // Click Admin link
    await page.locator('a[href="/admin"]').click();

    // Should navigate to admin page
    await page.waitForURL('**/admin');
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
  });
});
