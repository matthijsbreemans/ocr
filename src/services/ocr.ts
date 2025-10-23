import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}

export interface Word {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  fontSize?: number;
  contentType?: 'text' | 'number' | 'date' | 'email' | 'url' | 'currency' | 'phone';
}

export interface Line {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: Word[];
  baseline?: number;
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right' | 'justified';
}

export interface Paragraph {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  lines: Line[];
  textType?: 'heading' | 'body' | 'list' | 'caption' | 'footer';
  level?: number; // For headings: 1-6
  indent?: number;
}

export interface Block {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  paragraphs: Paragraph[];
  blockType?: 'text' | 'heading' | 'list' | 'table' | 'header' | 'footer';
  readingOrder?: number;
}

export interface TableCell {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  rowIndex: number;
  colIndex: number;
}

export interface Table {
  bbox: BoundingBox;
  confidence: number;
  rows: number;
  cols: number;
  headers?: string[];
  data: string[][];
  cells: TableCell[];
}

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
  bbox: BoundingBox;
  keyBbox: BoundingBox;
  valueBbox: BoundingBox;
}

export interface SmartField {
  fieldName: string;
  value: string;
  confidence: number;
  bbox: BoundingBox;
  fieldType: 'invoice_number' | 'po_number' | 'date' | 'total' | 'subtotal' | 'tax' | 'customer_name' | 'vendor_name' | 'address' | 'phone' | 'email' | 'other';
}

export interface Entity {
  type: 'iban' | 'credit_card' | 'bank_account' | 'tax_id' | 'ssn' | 'vat' | 'currency' | 'percentage' | 'email' | 'phone' | 'url' | 'ip_address' | 'date' | 'reference_number' | 'serial_number' | 'swift_bic' | 'routing_number';
  value: string;
  displayValue?: string; // For masked values like credit cards
  confidence: number;
  bbox: BoundingBox;
  context?: string; // Surrounding text for context
}

export interface NotableData {
  entities: Entity[];
  currencyAmounts: Array<{ value: string; currency?: string; bbox: BoundingBox }>;
  dates: Array<{ value: string; format?: string; bbox: BoundingBox }>;
  identifiers: Array<{ type: string; value: string; bbox: BoundingBox }>;
}

export interface DocumentStructure {
  title?: string;
  headings: Array<{ level: number; text: string; bbox: BoundingBox }>;
  lists: Array<{ items: string[]; bbox: BoundingBox }>;
  tables: Table[];
  keyValuePairs: KeyValuePair[];
  smartFields: SmartField[];
  notableData: NotableData;
  documentType?: 'invoice' | 'receipt' | 'form' | 'report' | 'letter' | 'unknown';
  pageLayout?: {
    columns: number;
    hasHeader: boolean;
    hasFooter: boolean;
    textDensity: number;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: Block[];
  structure: DocumentStructure;
  metadata: {
    pageCount?: number;
    language: string;
    processingTime?: number;
    wordCount: number;
    lineCount: number;
    avgConfidence: number;
    textOrientation?: number; // degrees
  };
}

export class OCRService {
  /**
   * Process a document and extract structured text using OCR
   * @param fileBuffer - The file data as a Buffer
   * @param mimeType - The MIME type of the file
   * @param options - Processing options
   * @returns Structured OCR results with text, layout, and semantic analysis
   */
  async processDocument(
    fileBuffer: Buffer,
    mimeType: string,
    options: { language?: string; structured?: boolean } = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const language = options.language || 'eng';
    const structured = options.structured !== false; // Default to true

    try {
      if (mimeType === 'application/pdf') {
        return await this.processPDF(fileBuffer, language, structured, startTime);
      } else {
        return await this.processImage(fileBuffer, language, structured, startTime);
      }
    } catch (error) {
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectContentType(text: string): Word['contentType'] {
    const trimmed = text.trim();

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';

    // URL
    if (/^(https?:\/\/|www\.)/i.test(trimmed)) return 'url';

    // Phone (simple pattern)
    if (/^[\d\s\-\(\)+]{7,}$/.test(trimmed) && /\d{3,}/.test(trimmed)) return 'phone';

    // Currency
    if (/^[$€£¥]?\s*\d+([,\.]\d+)*(\.\d{2})?$/.test(trimmed)) return 'currency';

    // Date patterns
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) return 'date';
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)) return 'date';

    // Number
    if (/^\d+([,\.]\d+)*$/.test(trimmed)) return 'number';

    return 'text';
  }

  private estimateFontSize(bbox: BoundingBox): number {
    // Estimate font size from bounding box height
    // This is approximate - actual font size depends on font metrics
    return Math.round(bbox.height * 0.75); // Heuristic
  }

  private detectAlignment(line: any, pageWidth: number): Line['alignment'] {
    const bbox = line.bbox;
    const leftMargin = bbox.x0;
    const rightMargin = pageWidth - bbox.x1;
    const centerPos = (bbox.x0 + bbox.x1) / 2;
    const pageCenter = pageWidth / 2;

    // Check if centered (within 10% of page center)
    if (Math.abs(centerPos - pageCenter) < pageWidth * 0.1) {
      return 'center';
    }

    // Check if right-aligned
    if (rightMargin < pageWidth * 0.1 && leftMargin > pageWidth * 0.2) {
      return 'right';
    }

    // Check if justified (both margins are similar and small)
    if (Math.abs(leftMargin - rightMargin) < pageWidth * 0.05 &&
        leftMargin < pageWidth * 0.1) {
      return 'justified';
    }

    return 'left';
  }

  private classifyParagraph(para: any, pageHeight: number): { textType: Paragraph['textType'], level?: number } {
    const fontSize = this.estimateFontSize(para.bbox);
    const yPosition = para.bbox.y0;
    const text = para.text.trim();

    // Header detection (top 10% of page)
    if (yPosition < pageHeight * 0.1) {
      return { textType: 'heading', level: fontSize > 16 ? 1 : 2 };
    }

    // Footer detection (bottom 10% of page)
    if (yPosition > pageHeight * 0.9) {
      return { textType: 'footer' };
    }

    // Heading detection by font size
    if (fontSize > 16) {
      return { textType: 'heading', level: fontSize > 24 ? 1 : fontSize > 20 ? 2 : 3 };
    }

    // List detection
    if (/^[\d\.\)\-\•\*]\s/.test(text)) {
      return { textType: 'list' };
    }

    // Caption detection (short text near edges)
    if (text.length < 100 && (yPosition < pageHeight * 0.15 || yPosition > pageHeight * 0.85)) {
      return { textType: 'caption' };
    }

    return { textType: 'body' };
  }

  private detectTables(blocks: Block[]): Table[] {
    const tables: Table[] = [];

    blocks.forEach(block => {
      block.paragraphs.forEach(para => {
        // Look for grid-like patterns
        const lines = para.lines;
        if (lines.length < 2) return;

        // Check if lines are evenly spaced and aligned
        const yPositions = lines.map(l => l.bbox.y0);
        const spacings = yPositions.slice(1).map((y, i) => y - yPositions[i]);
        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const spacingVariance = spacings.map(s => Math.abs(s - avgSpacing)).reduce((a, b) => a + b, 0) / spacings.length;

        // Even spacing suggests a table
        if (spacingVariance < avgSpacing * 0.3) {
          // Check for column alignment
          const allWords = lines.flatMap(l => l.words);
          const xPositions = allWords.map(w => w.bbox.x0);
          const uniqueXPositions = [...new Set(xPositions.map(x => Math.round(x / 10) * 10))].sort((a, b) => a - b);

          // If we have multiple aligned columns
          if (uniqueXPositions.length >= 2) {
            const cols = uniqueXPositions.length;
            const rows = lines.length;

            // Extract data by matching words to columns
            const data: string[][] = [];
            const cells: TableCell[] = [];

            lines.forEach((line, rowIdx) => {
              const rowData: string[] = [];

              uniqueXPositions.forEach((colX, colIdx) => {
                const wordsInColumn = line.words.filter(w =>
                  Math.abs(w.bbox.x0 - colX) < 20
                );
                const cellText = wordsInColumn.map(w => w.text).join(' ');
                rowData.push(cellText);

                if (wordsInColumn.length > 0) {
                  cells.push({
                    text: cellText,
                    confidence: wordsInColumn.reduce((sum, w) => sum + w.confidence, 0) / wordsInColumn.length,
                    bbox: wordsInColumn[0].bbox,
                    rowIndex: rowIdx,
                    colIndex: colIdx
                  });
                }
              });

              data.push(rowData);
            });

            // Check if first row looks like headers (all caps or bold)
            const firstRow = data[0];
            const headers = firstRow.every(cell =>
              cell === cell.toUpperCase() || cell.length < 20
            ) ? firstRow : undefined;

            tables.push({
              bbox: para.bbox,
              confidence: para.confidence,
              rows,
              cols,
              headers,
              data: headers ? data.slice(1) : data,
              cells
            });
          }
        }
      });
    });

    return tables;
  }

  private extractKeyValuePairs(blocks: Block[]): KeyValuePair[] {
    const pairs: KeyValuePair[] = [];

    blocks.forEach(block => {
      block.paragraphs.forEach(para => {
        para.lines.forEach(line => {
          const text = line.text;

          // Pattern: "Label: Value" or "Label - Value"
          const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
          const dashMatch = text.match(/^([^-]+)\s*-\s*(.+)$/);

          if (colonMatch || dashMatch) {
            const match = colonMatch || dashMatch!;
            const key = match[1].trim();
            const value = match[2].trim();

            // Key should be short (< 50 chars) and value should exist
            if (key.length < 50 && value.length > 0 && value.length < 200) {
              // Estimate bounding boxes for key and value
              const keyWords = line.words.slice(0, Math.ceil(line.words.length * 0.4));
              const valueWords = line.words.slice(Math.ceil(line.words.length * 0.4));

              const keyBbox = keyWords.length > 0 ? keyWords[0].bbox : line.bbox;
              const valueBbox = valueWords.length > 0 ? valueWords[0].bbox : line.bbox;

              pairs.push({
                key,
                value,
                confidence: line.confidence,
                bbox: line.bbox,
                keyBbox,
                valueBbox
              });
            }
          }
        });
      });
    });

    return pairs;
  }

  private extractSmartFields(blocks: Block[], keyValuePairs: KeyValuePair[]): SmartField[] {
    const fields: SmartField[] = [];
    const allText = blocks.map(b => b.text).join('\n');

    // Invoice/PO number patterns
    const invoicePatterns = [
      /invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /inv\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /bill\s*#?\s*:?\s*([A-Z0-9\-]+)/i
    ];

    const poPatterns = [
      /p\.?o\.?\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /purchase\s*order\s*#?\s*:?\s*([A-Z0-9\-]+)/i
    ];

    // Total patterns
    const totalPatterns = [
      /total\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i,
      /grand\s*total\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i,
      /amount\s*due\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i
    ];

    // Subtotal patterns
    const subtotalPatterns = [
      /sub\s*total\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i,
      /subtotal\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i
    ];

    // Tax patterns
    const taxPatterns = [
      /tax\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i,
      /vat\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i,
      /sales\s*tax\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})/i
    ];

    // Date patterns
    const datePatterns = [
      /date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /invoice\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
    ];

    // Extract fields using patterns
    const extractField = (patterns: RegExp[], fieldType: SmartField['fieldType'], fieldName: string) => {
      for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) {
          // Find the block containing this match
          const matchingBlock = blocks.find(b => b.text.includes(match[0]));
          if (matchingBlock) {
            fields.push({
              fieldName,
              value: match[1],
              confidence: matchingBlock.confidence,
              bbox: matchingBlock.bbox,
              fieldType
            });
            return;
          }
        }
      }
    };

    extractField(invoicePatterns, 'invoice_number', 'Invoice Number');
    extractField(poPatterns, 'po_number', 'PO Number');
    extractField(totalPatterns, 'total', 'Total');
    extractField(subtotalPatterns, 'subtotal', 'Subtotal');
    extractField(taxPatterns, 'tax', 'Tax');
    extractField(datePatterns, 'date', 'Date');

    // Extract from key-value pairs
    keyValuePairs.forEach(pair => {
      const keyLower = pair.key.toLowerCase();

      if (keyLower.includes('email')) {
        fields.push({
          fieldName: 'Email',
          value: pair.value,
          confidence: pair.confidence,
          bbox: pair.bbox,
          fieldType: 'email'
        });
      } else if (keyLower.includes('phone') || keyLower.includes('tel')) {
        fields.push({
          fieldName: 'Phone',
          value: pair.value,
          confidence: pair.confidence,
          bbox: pair.bbox,
          fieldType: 'phone'
        });
      } else if (keyLower.includes('address')) {
        fields.push({
          fieldName: 'Address',
          value: pair.value,
          confidence: pair.confidence,
          bbox: pair.bbox,
          fieldType: 'address'
        });
      } else if (keyLower.includes('customer') || keyLower.includes('bill to')) {
        fields.push({
          fieldName: 'Customer Name',
          value: pair.value,
          confidence: pair.confidence,
          bbox: pair.bbox,
          fieldType: 'customer_name'
        });
      } else if (keyLower.includes('vendor') || keyLower.includes('from')) {
        fields.push({
          fieldName: 'Vendor Name',
          value: pair.value,
          confidence: pair.confidence,
          bbox: pair.bbox,
          fieldType: 'vendor_name'
        });
      }
    });

    return fields;
  }

  private classifyDocumentType(blocks: Block[], smartFields: SmartField[], tables: Table[]): DocumentStructure['documentType'] {
    const allText = blocks.map(b => b.text.toLowerCase()).join(' ');
    const hasInvoice = smartFields.some(f => f.fieldType === 'invoice_number');
    const hasTotal = smartFields.some(f => f.fieldType === 'total');
    const hasPO = smartFields.some(f => f.fieldType === 'po_number');

    // Invoice detection
    if ((allText.includes('invoice') || hasInvoice) && hasTotal) {
      return 'invoice';
    }

    // Receipt detection
    if (allText.includes('receipt') && hasTotal) {
      return 'receipt';
    }

    // Form detection (has many key-value pairs)
    if (smartFields.length > 5) {
      return 'form';
    }

    // Report detection (has headings and tables)
    if (blocks.some(b => b.blockType === 'heading') && tables.length > 0) {
      return 'report';
    }

    // Letter detection (has address and body text)
    if (smartFields.some(f => f.fieldType === 'address') && blocks.length > 3) {
      return 'letter';
    }

    return 'unknown';
  }

  private extractNotableData(blocks: Block[]): NotableData {
    const entities: Entity[] = [];
    const currencyAmounts: NotableData['currencyAmounts'] = [];
    const dates: NotableData['dates'] = [];
    const identifiers: NotableData['identifiers'] = [];

    const allText = blocks.map(b => b.text).join('\n');
    const allWords: Array<{ text: string; bbox: BoundingBox; confidence: number }> = [];

    // Collect all words with positions
    blocks.forEach(block => {
      block.paragraphs.forEach(para => {
        para.lines.forEach(line => {
          line.words.forEach(word => {
            allWords.push({
              text: word.text,
              bbox: word.bbox,
              confidence: word.confidence
            });
          });
        });
      });
    });

    // BTW/VAT Number (Dutch format) - must come BEFORE IBAN to avoid false matches
    // Format: NL + 9 digits + B + 2 digits (e.g., NL009292056B01)
    const btwPattern = /\b([A-Z]{2}\d{9}B\d{2})\b/g;
    let match: RegExpExecArray | null;
    while ((match = btwPattern.exec(allText)) !== null) {
      const value = match[1];
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'vat',
        value,
        confidence: matchingWord?.confidence || 90,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 },
        context: 'BTW/VAT Number'
      });
      identifiers.push({
        type: 'BTW/VAT Number',
        value,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // IBAN Pattern (International Bank Account Number) - handles spaces
    // Must NOT be preceded by letters (to avoid "IBAN" prefix) and must NOT be BTW format
    const ibanPattern = /(?<![A-Z])([A-Z]{2}\d{2}[\sA-Z0-9]{12,32})(?=\s|$)/g;
    while ((match = ibanPattern.exec(allText)) !== null) {
      const value = match[1].replace(/\s/g, ''); // Remove spaces for validation
      // Exclude BTW format (ends with B + 2 digits) and validate length
      if (value.length >= 15 && value.length <= 34 && !/B\d{2}$/.test(value)) {
        const matchingWord = allWords.find(w => w.text.includes(value));
        entities.push({
          type: 'iban',
          value,
          confidence: matchingWord?.confidence || 90,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
        identifiers.push({
          type: 'IBAN',
          value,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    }

    // Credit Card Pattern (masked for security)
    const ccPattern = /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b/g;
    while ((match = ccPattern.exec(allText)) !== null) {
      const value = match[1].replace(/[\s\-]/g, '');
      if (value.length === 16) {
        const masked = `****-****-****-${value.slice(-4)}`;
        const matchingWord = allWords.find(w => w.text.includes(value.slice(-4)));
        entities.push({
          type: 'credit_card',
          value,
          displayValue: masked,
          confidence: matchingWord?.confidence || 85,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
        identifiers.push({
          type: 'Credit Card',
          value: masked,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    }

    // SWIFT/BIC Code
    const swiftPattern = /\b([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)\b/g;
    while ((match = swiftPattern.exec(allText)) !== null) {
      const value = match[1];
      if (value.length === 8 || value.length === 11) {
        const matchingWord = allWords.find(w => w.text.includes(value));
        entities.push({
          type: 'swift_bic',
          value,
          confidence: matchingWord?.confidence || 88,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
        identifiers.push({
          type: 'SWIFT/BIC',
          value,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    }

    // VAT Number (European format)
    const vatPattern = /\b(VAT[\s:]?([A-Z]{2}[\d\s]{8,12}))\b/gi;
    while ((match = vatPattern.exec(allText)) !== null) {
      const value = match[2].replace(/\s/g, '');
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'vat',
        value,
        confidence: matchingWord?.confidence || 90,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 },
        context: match[0]
      });
      identifiers.push({
        type: 'VAT Number',
        value,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Tax ID / EIN (US format)
    const einPattern = /\b(\d{2}-\d{7})\b/g;
    while ((match = einPattern.exec(allText)) !== null) {
      const value = match[1];
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'tax_id',
        value,
        confidence: matchingWord?.confidence || 92,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
      identifiers.push({
        type: 'Tax ID / EIN',
        value,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // SSN (US Social Security Number - masked)
    const ssnPattern = /\b(\d{3}-\d{2}-\d{4})\b/g;
    while ((match = ssnPattern.exec(allText)) !== null) {
      const value = match[1];
      const masked = `***-**-${value.slice(-4)}`;
      const matchingWord = allWords.find(w => w.text.includes(value.slice(-4)));
      entities.push({
        type: 'ssn',
        value,
        displayValue: masked,
        confidence: matchingWord?.confidence || 90,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
      identifiers.push({
        type: 'SSN',
        value: masked,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Currency Amounts (various formats)
    const currencyPattern = /([$€£¥₹])\s*([\d,]+\.?\d{0,2})\b|([\d,]+\.?\d{0,2})\s*(USD|EUR|GBP|JPY|INR|CAD|AUD)/gi;
    while ((match = currencyPattern.exec(allText)) !== null) {
      const currency = match[1] || match[4];
      const amount = match[2] || match[3];
      const matchingWord = allWords.find(w => w.text.includes(amount));

      currencyAmounts.push({
        value: amount,
        currency: currency,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });

      entities.push({
        type: 'currency',
        value: `${currency}${amount}`,
        confidence: matchingWord?.confidence || 93,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Percentages
    const percentPattern = /\b(\d+\.?\d*)\s*%/g;
    while ((match = percentPattern.exec(allText)) !== null) {
      const percentValue = match[1];
      const value = `${percentValue}%`;
      const matchingWord = allWords.find(w => w.text.includes(percentValue));
      entities.push({
        type: 'percentage',
        value,
        confidence: matchingWord?.confidence || 95,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Email Addresses
    const emailPattern = /\b([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    while ((match = emailPattern.exec(allText)) !== null) {
      const value = match[1];
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'email',
        value,
        confidence: matchingWord?.confidence || 96,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Phone Numbers (various formats)
    const phonePattern = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    while ((match = phonePattern.exec(allText)) !== null) {
      const value = match[0];
      if (value.replace(/\D/g, '').length >= 10) {
        const matchingWord = allWords.find(w => w.text.includes(value.replace(/\D/g, '').slice(-4)));
        entities.push({
          type: 'phone',
          value,
          confidence: matchingWord?.confidence || 89,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    }

    // URLs
    const urlPattern = /\b(https?:\/\/[^\s]+|www\.[^\s]+)\b/gi;
    while ((match = urlPattern.exec(allText)) !== null) {
      const value = match[1];
      const matchingWord = allWords.find(w => w.text.includes(value.slice(0, 10)));
      entities.push({
        type: 'url',
        value,
        confidence: matchingWord?.confidence || 94,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // IP Addresses
    const ipPattern = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
    while ((match = ipPattern.exec(allText)) !== null) {
      const value = match[1];
      // Validate IP range
      const parts = value.split('.').map(Number);
      if (parts.every(p => p >= 0 && p <= 255)) {
        const matchingWord = allWords.find(w => w.text.includes(value));
        entities.push({
          type: 'ip_address',
          value,
          confidence: matchingWord?.confidence || 91,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    }

    // Helper function to validate numeric date parts
    const isValidDate = (dateStr: string): boolean => {
      // Check numeric date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
      const numericPattern = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
      const isoPattern = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;

      let match = dateStr.match(numericPattern);
      if (match) {
        const [, first, second, year] = match;
        const firstNum = parseInt(first, 10);
        const secondNum = parseInt(second, 10);
        const yearNum = parseInt(year, 10);

        // Validate ranges (support both DD/MM and MM/DD formats)
        const validYear = yearNum >= 1900 && yearNum <= 2099;
        const validFirstAsDay = firstNum >= 1 && firstNum <= 31;
        const validFirstAsMonth = firstNum >= 1 && firstNum <= 12;
        const validSecondAsDay = secondNum >= 1 && secondNum <= 31;
        const validSecondAsMonth = secondNum >= 1 && secondNum <= 12;

        // Accept if either DD/MM or MM/DD interpretation is valid
        return validYear && (
          (validFirstAsDay && validSecondAsMonth) ||
          (validFirstAsMonth && validSecondAsDay)
        );
      }

      match = dateStr.match(isoPattern);
      if (match) {
        const [, year, month, day] = match;
        const yearNum = parseInt(year, 10);
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);

        return yearNum >= 1900 && yearNum <= 2099 &&
               monthNum >= 1 && monthNum <= 12 &&
               dayNum >= 1 && dayNum <= 31;
      }

      // Text-based dates (e.g., "25 December 2024") are generally valid
      return true;
    };

    // Date Patterns (various formats)
    const datePatterns = [
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,  // MM/DD/YYYY or DD/MM/YYYY
      /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,    // YYYY-MM-DD
      /\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/gi,  // DD Month YYYY
      /\b((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi  // Month DD, YYYY
    ];

    datePatterns.forEach(pattern => {
      while ((match = pattern.exec(allText)) !== null) {
        const value = match[1] || match[0];

        // Validate date before adding
        if (!isValidDate(value)) {
          continue;
        }

        const matchingWord = allWords.find(w => w.text.includes(value.split(/[\s\/\-]/)[0]));
        dates.push({
          value,
          format: 'auto',
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
        entities.push({
          type: 'date',
          value,
          confidence: matchingWord?.confidence || 92,
          bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
        });
      }
    });

    // Reference Numbers (generic pattern)
    const refPattern = /\b(REF|Reference|Ref\.?|Tracking|Order)[\s#:]*([A-Z0-9\-]{6,20})\b/gi;
    while ((match = refPattern.exec(allText)) !== null) {
      const value = match[2];
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'reference_number',
        value,
        confidence: matchingWord?.confidence || 87,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 },
        context: match[1]
      });
      identifiers.push({
        type: 'Reference Number',
        value,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // Serial Numbers (generic pattern)
    const serialPattern = /\b(S\/N|Serial|SN)[\s#:]*([A-Z0-9\-]{8,20})\b/gi;
    while ((match = serialPattern.exec(allText)) !== null) {
      const value = match[2];
      const matchingWord = allWords.find(w => w.text.includes(value));
      entities.push({
        type: 'serial_number',
        value,
        confidence: matchingWord?.confidence || 86,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 },
        context: match[1]
      });
      identifiers.push({
        type: 'Serial Number',
        value,
        bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
      });
    }

    // US Routing Number
    const routingPattern = /\b(\d{9})\b/g;
    const routingMatches: string[] = [];
    while ((match = routingPattern.exec(allText)) !== null) {
      // Only consider it a routing number if it's near words like "routing", "ABA", "RTN"
      const context = allText.substring(Math.max(0, match.index - 20), match.index + 20);
      if (/routing|ABA|RTN/i.test(context)) {
        const value = match[1];
        if (!routingMatches.includes(value)) {
          routingMatches.push(value);
          const matchingWord = allWords.find(w => w.text.includes(value));
          entities.push({
            type: 'routing_number',
            value,
            confidence: matchingWord?.confidence || 88,
            bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 },
            context: 'Routing Number'
          });
          identifiers.push({
            type: 'Routing Number',
            value,
            bbox: matchingWord?.bbox || { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 }
          });
        }
      }
    }

    // Remove duplicate entities
    const uniqueEntities = entities.filter((entity, index, self) =>
      index === self.findIndex(e => e.type === entity.type && e.value === entity.value)
    );

    // Remove duplicate currency amounts
    const uniqueCurrency = currencyAmounts.filter((amount, index, self) =>
      index === self.findIndex(a => a.value === amount.value && a.currency === amount.currency)
    );

    // Remove duplicate dates
    const uniqueDates = dates.filter((date, index, self) =>
      index === self.findIndex(d => d.value === date.value)
    );

    // Remove duplicate identifiers
    const uniqueIdentifiers = identifiers.filter((id, index, self) =>
      index === self.findIndex(i => i.type === id.type && i.value === id.value)
    );

    return {
      entities: uniqueEntities,
      currencyAmounts: uniqueCurrency,
      dates: uniqueDates,
      identifiers: uniqueIdentifiers
    };
  }

  private analyzeDocumentStructure(blocks: Block[]): DocumentStructure {
    const headings: DocumentStructure['headings'] = [];
    const lists: DocumentStructure['lists'] = [];
    let hasHeader = false;
    let hasFooter = false;
    let totalTextArea = 0;
    let pageArea = 0;

    blocks.forEach(block => {
      block.paragraphs.forEach(para => {
        // Collect headings
        if (para.textType === 'heading' && para.level) {
          headings.push({
            level: para.level,
            text: para.text,
            bbox: para.bbox
          });
        }

        // Collect lists
        if (para.textType === 'list') {
          const items = para.lines.map(line => line.text.replace(/^[\d\.\)\-\•\*]\s+/, ''));
          lists.push({
            items,
            bbox: para.bbox
          });
        }

        // Check for header/footer
        if (para.textType === 'heading') hasHeader = true;
        if (para.textType === 'footer') hasFooter = true;

        // Calculate text density
        totalTextArea += para.bbox.width * para.bbox.height;
        pageArea = Math.max(pageArea, para.bbox.x1 * para.bbox.y1);
      });
    });

    // Detect title (first heading or largest heading)
    const title = headings.length > 0 ? headings[0].text : undefined;

    // Estimate columns (simplified)
    const xPositions = blocks.map(b => b.bbox.x0).sort((a, b) => a - b);
    const columnGaps = xPositions.filter((x, i) => i > 0 && x - xPositions[i-1] > 50);
    const columns = columnGaps.length > 0 ? columnGaps.length + 1 : 1;

    // Extract advanced features
    const tables = this.detectTables(blocks);
    const keyValuePairs = this.extractKeyValuePairs(blocks);
    const smartFields = this.extractSmartFields(blocks, keyValuePairs);
    const notableData = this.extractNotableData(blocks);
    const documentType = this.classifyDocumentType(blocks, smartFields, tables);

    return {
      title,
      headings,
      lists,
      tables,
      keyValuePairs,
      smartFields,
      notableData,
      documentType,
      pageLayout: {
        columns,
        hasHeader,
        hasFooter,
        textDensity: pageArea > 0 ? totalTextArea / pageArea : 0
      }
    };
  }

  private enrichBlocks(blocks: any[], pageWidth: number, pageHeight: number): Block[] {
    return blocks.map((block, idx) => {
      const enrichedParagraphs = block.paragraphs.map((para: any) => {
        const classification = this.classifyParagraph(para, pageHeight);

        const enrichedLines = para.lines.map((line: any) => {
          const lineBbox: BoundingBox = {
            ...line.bbox,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0
          };

          const enrichedWords = line.words.map((word: any) => {
            const wordBbox: BoundingBox = {
              ...word.bbox,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0
            };

            return {
              text: word.text,
              confidence: word.confidence,
              bbox: wordBbox,
              fontSize: this.estimateFontSize(wordBbox),
              contentType: this.detectContentType(word.text)
            };
          });

          return {
            text: line.text,
            confidence: line.confidence,
            bbox: lineBbox,
            words: enrichedWords,
            baseline: line.baseline,
            fontSize: this.estimateFontSize(lineBbox),
            alignment: this.detectAlignment(line, pageWidth)
          };
        });

        const paraBbox: BoundingBox = {
          ...para.bbox,
          width: para.bbox.x1 - para.bbox.x0,
          height: para.bbox.y1 - para.bbox.y0
        };

        return {
          text: para.text,
          confidence: para.confidence,
          bbox: paraBbox,
          lines: enrichedLines,
          textType: classification.textType,
          level: classification.level,
          indent: para.bbox.x0
        };
      });

      const blockBbox: BoundingBox = {
        ...block.bbox,
        width: block.bbox.x1 - block.bbox.x0,
        height: block.bbox.y1 - block.bbox.y0
      };

      // Determine block type based on paragraphs
      const hasHeadings = enrichedParagraphs.some((p: Paragraph) => p.textType === 'heading');
      const hasLists = enrichedParagraphs.some((p: Paragraph) => p.textType === 'list');
      const isHeader = enrichedParagraphs.every((p: Paragraph) => p.bbox.y0 < pageHeight * 0.1);
      const isFooter = enrichedParagraphs.every((p: Paragraph) => p.bbox.y0 > pageHeight * 0.9);

      let blockType: Block['blockType'] = 'text';
      if (isHeader) blockType = 'header';
      else if (isFooter) blockType = 'footer';
      else if (hasHeadings) blockType = 'heading';
      else if (hasLists) blockType = 'list';

      return {
        text: block.text,
        confidence: block.confidence,
        bbox: blockBbox,
        paragraphs: enrichedParagraphs,
        blockType,
        readingOrder: idx + 1
      };
    });
  }

  private async processImage(
    fileBuffer: Buffer,
    language: string,
    structured: boolean,
    startTime: number
  ): Promise<OCRResult> {
    const result = await Tesseract.recognize(fileBuffer, language, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const processingTime = Date.now() - startTime;

    // Calculate page dimensions
    const pageWidth = Math.max(...(result.data.blocks || []).map(b => b.bbox.x1));
    const pageHeight = Math.max(...(result.data.blocks || []).map(b => b.bbox.y1));

    // Count statistics
    const allWords = result.data.words || [];
    const allLines = result.data.lines || [];
    const wordCount = allWords.length;
    const lineCount = allLines.length;
    const avgConfidence = allWords.reduce((sum, w) => sum + w.confidence, 0) / (wordCount || 1);

    if (!structured) {
      // Return simple text result for backward compatibility
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        blocks: [],
        structure: {
          headings: [],
          lists: [],
          tables: [],
          keyValuePairs: [],
          smartFields: [],
          notableData: { entities: [], currencyAmounts: [], dates: [], identifiers: [] },
          documentType: 'unknown',
          pageLayout: { columns: 1, hasHeader: false, hasFooter: false, textDensity: 0 }
        },
        metadata: {
          language,
          processingTime,
          wordCount,
          lineCount,
          avgConfidence,
          textOrientation: (result.data as any).text_angle
        },
      };
    }

    // Build enriched structured output
    const rawBlocks = (result.data.blocks || []);
    const enrichedBlocks = this.enrichBlocks(rawBlocks, pageWidth, pageHeight);
    const structure = this.analyzeDocumentStructure(enrichedBlocks);

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      blocks: enrichedBlocks,
      structure,
      metadata: {
        language,
        processingTime,
        wordCount,
        lineCount,
        avgConfidence,
        textOrientation: (result.data as any).text_angle
      },
    };
  }

  private async processPDF(
    fileBuffer: Buffer,
    language: string,
    structured: boolean,
    startTime: number
  ): Promise<OCRResult> {
    // First, try to extract text directly from PDF
    const pdfData = await pdf(fileBuffer);
    const processingTime = Date.now() - startTime;

    if (pdfData.text && pdfData.text.trim().length > 0) {
      const text = pdfData.text.trim();

      // Count statistics
      const words = text.split(/\s+/);
      const lines = text.split('\n');
      const wordCount = words.length;
      const lineCount = lines.length;

      if (!structured) {
        return {
          text,
          confidence: 100,
          blocks: [],
          structure: {
            headings: [],
            lists: [],
            tables: [],
            keyValuePairs: [],
            smartFields: [],
            notableData: { entities: [], currencyAmounts: [], dates: [], identifiers: [] },
            documentType: 'unknown',
            pageLayout: { columns: 1, hasHeader: false, hasFooter: false, textDensity: 0 }
          },
          metadata: {
            pageCount: pdfData.numpages,
            language,
            processingTime,
            wordCount,
            lineCount,
            avgConfidence: 100
          },
        };
      }

      // Split into paragraphs for structure
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
      const headings: DocumentStructure['headings'] = [];
      const lists: DocumentStructure['lists'] = [];

      const enrichedParagraphs: Paragraph[] = paragraphs.map((paraText, idx) => {
        const paraLines = paraText.split('\n');
        const isHeading = paraLines.length === 1 && paraText.length < 100 && /^[A-Z]/.test(paraText);
        const isList = /^[\d\.\)\-\•\*]\s/.test(paraText);

        if (isHeading) {
          headings.push({
            level: 2,
            text: paraText,
            bbox: { x0: 0, y0: idx * 20, x1: 500, y1: (idx + 1) * 20, width: 500, height: 20 }
          });
        }

        if (isList) {
          const items = paraLines.map(line => line.replace(/^[\d\.\)\-\•\*]\s+/, ''));
          lists.push({
            items,
            bbox: { x0: 0, y0: idx * 100, x1: 500, y1: (idx + paraLines.length) * 20, width: 500, height: paraLines.length * 20 }
          });
        }

        return {
          text: paraText,
          confidence: 100,
          bbox: { x0: 0, y0: idx * 100, x1: 500, y1: (idx + 1) * 100, width: 500, height: 100 },
          textType: isHeading ? 'heading' : isList ? 'list' : 'body',
          level: isHeading ? 2 : undefined,
          lines: paraLines.map((lineText, lineIdx) => ({
            text: lineText,
            confidence: 100,
            bbox: { x0: 0, y0: lineIdx * 20, x1: 500, y1: (lineIdx + 1) * 20, width: 500, height: 20 },
            alignment: 'left' as const,
            words: lineText.split(/\s+/).map((wordText, wordIdx) => ({
              text: wordText,
              confidence: 100,
              bbox: { x0: wordIdx * 50, y0: 0, x1: (wordIdx + 1) * 50, y1: 20, width: 50, height: 20 },
              fontSize: 12,
              contentType: this.detectContentType(wordText)
            }))
          }))
        };
      });

      const blocks: Block[] = [{
        text,
        confidence: 100,
        bbox: { x0: 0, y0: 0, x1: 500, y1: 1000, width: 500, height: 1000 },
        blockType: 'text',
        readingOrder: 1,
        paragraphs: enrichedParagraphs
      }];

      // Extract notable data from the text
      const notableData = this.extractNotableData(blocks);

      return {
        text,
        confidence: 100,
        blocks,
        structure: {
          title: headings.length > 0 ? headings[0].text : undefined,
          headings,
          lists,
          tables: [],
          keyValuePairs: [],
          smartFields: [],
          notableData,
          documentType: 'unknown',
          pageLayout: {
            columns: 1,
            hasHeader: headings.length > 0,
            hasFooter: false,
            textDensity: 0.7
          }
        },
        metadata: {
          pageCount: pdfData.numpages,
          language,
          processingTime,
          wordCount,
          lineCount,
          avgConfidence: 100
        },
      };
    }

    // If no text found, return error structure
    return {
      text: 'PDF OCR requires image conversion. Text extraction returned no results.',
      confidence: 0,
      blocks: [],
      structure: {
        headings: [],
        lists: [],
        tables: [],
        keyValuePairs: [],
        smartFields: [],
        notableData: { entities: [], currencyAmounts: [], dates: [], identifiers: [] },
        documentType: 'unknown',
        pageLayout: { columns: 1, hasHeader: false, hasFooter: false, textDensity: 0 }
      },
      metadata: {
        pageCount: pdfData.numpages,
        language,
        processingTime,
        wordCount: 0,
        lineCount: 0,
        avgConfidence: 0
      },
    };
  }
}
