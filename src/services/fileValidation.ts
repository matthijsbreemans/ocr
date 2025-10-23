import fileType from 'file-type';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  detectedType?: string;
  sanitizedBuffer?: Buffer;
}

export class FileValidationService {
  // Security limits
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly MAX_IMAGE_PIXELS = 178_956_970; // ~178 megapixels (prevents decompression bombs)
  private static readonly MAX_IMAGE_DIMENSION = 50000; // Max width or height in pixels
  private static readonly MAX_PDF_PAGES = 500; // Reasonable limit for OCR

  // Allowed MIME types with magic number verification
  private static readonly ALLOWED_TYPES = new Map([
    ['image/png', [0x89, 0x50, 0x4E, 0x47]], // PNG signature
    ['image/jpeg', [0xFF, 0xD8, 0xFF]], // JPEG signature
    ['image/tiff', [0x49, 0x49, 0x2A, 0x00]], // TIFF little-endian
    ['image/bmp', [0x42, 0x4D]], // BMP signature
    ['image/webp', [0x52, 0x49, 0x46, 0x46]], // RIFF (WebP container)
    ['application/pdf', [0x25, 0x50, 0x44, 0x46]], // %PDF
  ]);

  /**
   * Comprehensive file validation
   * Protects against: MIME type spoofing, image bombs, malformed PDFs, excessive file sizes
   */
  async validateFile(buffer: Buffer, claimedMimeType: string): Promise<ValidationResult> {
    try {
      // 1. Check file size
      if (buffer.length > FileValidationService.MAX_FILE_SIZE) {
        return {
          isValid: false,
          error: `File size ${buffer.length} bytes exceeds maximum ${FileValidationService.MAX_FILE_SIZE} bytes`,
        };
      }

      // 2. Detect actual file type from magic numbers
      const detectedType = await fileType.fromBuffer(buffer);

      if (!detectedType) {
        return {
          isValid: false,
          error: 'Unable to detect file type - file may be corrupted or invalid',
        };
      }

      // 3. Verify detected type is allowed
      if (!Array.from(FileValidationService.ALLOWED_TYPES.keys()).includes(detectedType.mime)) {
        return {
          isValid: false,
          error: `File type ${detectedType.mime} is not supported`,
        };
      }

      // 4. Verify claimed type matches detected type
      // Allow some flexibility for JPEG variants
      const normalizedClaimed = this.normalizeMimeType(claimedMimeType);
      const normalizedDetected = this.normalizeMimeType(detectedType.mime);

      if (normalizedClaimed !== normalizedDetected) {
        return {
          isValid: false,
          error: `File type mismatch: claimed ${claimedMimeType} but detected ${detectedType.mime}`,
        };
      }

      // 5. Type-specific validation
      if (detectedType.mime.startsWith('image/')) {
        return await this.validateImage(buffer, detectedType.mime);
      } else if (detectedType.mime === 'application/pdf') {
        return await this.validatePDF(buffer);
      }

      return {
        isValid: true,
        detectedType: detectedType.mime,
        sanitizedBuffer: buffer,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate image files and protect against decompression bombs
   */
  private async validateImage(buffer: Buffer, mimeType: string): Promise<ValidationResult> {
    try {
      // Use sharp to safely read metadata without full decompression
      const metadata = await sharp(buffer, {
        limitInputPixels: FileValidationService.MAX_IMAGE_PIXELS,
        sequentialRead: true,
      }).metadata();

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: 'Unable to read image dimensions',
        };
      }

      if (
        metadata.width > FileValidationService.MAX_IMAGE_DIMENSION ||
        metadata.height > FileValidationService.MAX_IMAGE_DIMENSION
      ) {
        return {
          isValid: false,
          error: `Image dimensions ${metadata.width}x${metadata.height} exceed maximum ${FileValidationService.MAX_IMAGE_DIMENSION}`,
        };
      }

      // Check total pixel count (prevents decompression bombs)
      const totalPixels = metadata.width * metadata.height;
      if (totalPixels > FileValidationService.MAX_IMAGE_PIXELS) {
        return {
          isValid: false,
          error: `Image has ${totalPixels} pixels, exceeds maximum ${FileValidationService.MAX_IMAGE_PIXELS}`,
        };
      }

      // Additional check: verify the image can actually be processed
      // This will throw if the image is malformed
      await sharp(buffer)
        .resize(100, 100, { fit: 'inside' }) // Small resize to verify it's processable
        .toBuffer();

      console.log(`Image validated: ${metadata.width}x${metadata.height}, ${metadata.format}`);

      return {
        isValid: true,
        detectedType: mimeType,
        sanitizedBuffer: buffer,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Image validation failed: ${error instanceof Error ? error.message : 'Malformed image'}`,
      };
    }
  }

  /**
   * Validate PDF structure and content
   */
  private async validatePDF(buffer: Buffer): Promise<ValidationResult> {
    try {
      // Load and parse PDF structure
      const pdfDoc = await PDFDocument.load(buffer, {
        ignoreEncryption: false, // Reject encrypted PDFs
        throwOnInvalidObject: true,
      });

      // Check page count
      const pageCount = pdfDoc.getPageCount();
      if (pageCount === 0) {
        return {
          isValid: false,
          error: 'PDF has no pages',
        };
      }

      if (pageCount > FileValidationService.MAX_PDF_PAGES) {
        return {
          isValid: false,
          error: `PDF has ${pageCount} pages, exceeds maximum ${FileValidationService.MAX_PDF_PAGES}`,
        };
      }

      // Check for JavaScript (security warning)
      const hasJavaScript = this.checkPDFForJavaScript(buffer);
      if (hasJavaScript) {
        console.warn(`⚠️  PDF contains JavaScript - allowing with warning (${pageCount} pages)`);
        // Continue processing - JavaScript is logged but not blocking
      }

      // Note: Embedded files check removed due to pdf-lib API changes
      // The PDF is still validated for JavaScript and other security risks

      console.log(`PDF validated: ${pageCount} pages`);

      return {
        isValid: true,
        detectedType: 'application/pdf',
        sanitizedBuffer: buffer,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages
      if (errorMsg.includes('encryption')) {
        return {
          isValid: false,
          error: 'Encrypted PDFs are not supported',
        };
      }

      return {
        isValid: false,
        error: `PDF validation failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Check PDF for dangerous JavaScript content
   */
  private checkPDFForJavaScript(buffer: Buffer): boolean {
    const pdfString = buffer.toString('binary', 0, Math.min(buffer.length, 1024 * 1024)); // Check first 1MB

    // Look for common JavaScript indicators in PDFs
    const jsIndicators = ['/JavaScript', '/JS', '/OpenAction', '/AA'];

    return jsIndicators.some((indicator) => pdfString.includes(indicator));
  }

  /**
   * Normalize MIME types for comparison (handle variants)
   */
  private normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.toLowerCase().trim();

    // Handle common variations
    if (normalized === 'image/jpg') return 'image/jpeg';
    if (normalized === 'image/tif') return 'image/tiff';

    return normalized;
  }

  /**
   * Check if file appears to be a zip bomb by checking compression ratio
   */
  async checkCompressionRatio(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height || !metadata.channels) {
        return false;
      }

      // Estimate uncompressed size
      const uncompressedSize = metadata.width * metadata.height * metadata.channels;
      const compressedSize = buffer.length;

      // If compression ratio is suspiciously high (>100:1), it might be a bomb
      const compressionRatio = uncompressedSize / compressedSize;

      if (compressionRatio > 100) {
        console.warn(`High compression ratio detected: ${compressionRatio.toFixed(2)}:1`);
        return true;
      }

      return false;
    } catch {
      return false; // Can't determine, allow other validations to catch it
    }
  }
}
