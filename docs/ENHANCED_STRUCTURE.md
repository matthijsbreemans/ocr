# Enhanced Semantic Structure - OCR API v3.0

## 🎯 Overview

The OCR API now includes **advanced semantic analysis** that goes beyond simple text extraction. The system automatically detects document structure, classifies content types, identifies layout patterns, and provides rich metadata for intelligent document processing.

## 🆕 What's New in v3.0

### **1. Content Type Detection**
Automatically identifies special content types in text:
- 📧 **Email addresses** - `user@domain.com`
- 🔗 **URLs** - `https://example.com`
- 📞 **Phone numbers** - `(555) 123-4567`
- 💰 **Currency** - `$123.45`, `€50.00`
- 📅 **Dates** - `01/15/2024`, `2024-01-15`
- 🔢 **Numbers** - `1234`, `3.14`

### **2. Text Classification**
Each paragraph is automatically classified:
- **heading** (H1-H6) - Based on font size and position
- **body** - Regular paragraph text
- **list** - Numbered or bulleted lists
- **caption** - Short descriptive text
- **footer** - Page footer content

### **3. Layout Analysis**
- **Column detection** - Identifies multi-column layouts
- **Header/Footer detection** - Finds recurring page elements
- **Text density** - Measures how much space is filled with text
- **Reading order** - Numbers blocks in logical reading sequence

### **4. Typography Detection**
- **Font size estimation** - Based on bounding box height
- **Text alignment** - left, center, right, or justified
- **Baseline detection** - Identifies text baseline for proper alignment
- **Indentation tracking** - Measures paragraph indents

### **5. Document Structure Extraction**
- **Title detection** - Identifies the main document title
- **Heading hierarchy** - Extracts all headings with levels
- **List extraction** - Finds and parses bulleted/numbered lists
- **Block classification** - Categorizes blocks as text, heading, list, table, etc.

## 📊 Enhanced Data Structure

### New OCRResult Format

```typescript
{
  // Plain text (unchanged)
  "text": "Full extracted text...",
  "confidence": 92.5,

  // Enhanced blocks with semantic info
  "blocks": [
    {
      "text": "Block content",
      "confidence": 95.0,
      "bbox": { "x0": 10, "y0": 10, "x1": 200, "y1": 50, "width": 190, "height": 40 },
      "blockType": "heading",  // NEW: text | heading | list | table | header | footer
      "readingOrder": 1,       // NEW: Logical reading sequence
      "paragraphs": [
        {
          "text": "Paragraph text",
          "textType": "heading",  // NEW: heading | body | list | caption | footer
          "level": 1,             // NEW: For headings (1-6)
          "indent": 0,            // NEW: Indentation in pixels
          "lines": [
            {
              "text": "Line text",
              "fontSize": 24,       // NEW: Estimated font size
              "alignment": "center", // NEW: left | center | right | justified
              "words": [
                {
                  "text": "Word",
                  "fontSize": 24,
                  "contentType": "text"  // NEW: text | number | date | email | url | currency | phone
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  // NEW: Document structure analysis
  "structure": {
    "title": "Document Title",  // Detected title
    "headings": [               // All headings
      { "level": 1, "text": "Main Heading", "bbox": {...} },
      { "level": 2, "text": "Sub Heading", "bbox": {...} }
    ],
    "lists": [                  // All detected lists
      {
        "items": ["Item 1", "Item 2", "Item 3"],
        "bbox": {...}
      }
    ],
    "pageLayout": {
      "columns": 2,             // Number of text columns
      "hasHeader": true,        // Has page header
      "hasFooter": true,        // Has page footer
      "textDensity": 0.65       // Percentage of page covered by text
    }
  },

  // Enhanced metadata
  "metadata": {
    "language": "eng",
    "processingTime": 2500,
    "wordCount": 150,          // NEW: Total word count
    "lineCount": 45,           // NEW: Total line count
    "avgConfidence": 94.2,     // NEW: Average confidence across all words
    "textOrientation": 0       // NEW: Text rotation in degrees
  }
}
```

## 🎨 New Web UI Features

### **4-Tab Result Viewer**

#### 1. 📄 **Plain Text**
- Clean, readable extracted text
- No formatting or metadata
- Copy to clipboard

#### 2. 🔍 **Document Analysis** (NEW!)
Shows semantic document structure:
- **Document Overview** - Word count, line count, confidence, processing time
- **Page Layout** - Columns, headers/footers, text density
- **Detected Title** - Automatically identified document title
- **Headings** - All headings with hierarchy levels (H1-H6)
- **Lists** - All detected lists with items
- **Content Types Found** - Email, URL, phone, currency, dates, numbers
- **Block Analysis** - Type and confidence for each block

#### 3. 🏗️ **Block Hierarchy**
- Visual hierarchy of blocks → paragraphs → lines
- Confidence scores at each level
- Color-coded blocks for easy scanning

#### 4. 💻 **Raw JSON**
- Complete structured data
- All metadata and bounding boxes
- Suitable for API integration

## 🚀 Use Cases

### **1. Invoice Processing**
```javascript
// Extract structured invoice data
const result = JSON.parse(job.ocrResult);

// Find currency amounts
const amounts = [];
result.blocks.forEach(block => {
  block.paragraphs.forEach(para => {
    para.lines.forEach(line => {
      line.words.forEach(word => {
        if (word.contentType === 'currency') {
          amounts.push(word.text);
        }
      });
    });
  });
});

// Find dates
const dates = [];
result.blocks.forEach(block => {
  block.paragraphs.forEach(para => {
    para.lines.forEach(line => {
      line.words.forEach(word => {
        if (word.contentType === 'date') {
          dates.push(word.text);
        }
      });
    });
  });
});
```

### **2. Table of Contents Generation**
```javascript
// Extract document headings
const toc = result.structure.headings.map(h => ({
  level: h.level,
  title: h.text,
  page: Math.floor(h.bbox.y0 / 800) + 1  // Approximate page number
}));
```

### **3. Contact Information Extraction**
```javascript
// Find emails and phone numbers
const contacts = {
  emails: [],
  phones: []
};

result.blocks.forEach(block => {
  block.paragraphs.forEach(para => {
    para.lines.forEach(line => {
      line.words.forEach(word => {
        if (word.contentType === 'email') contacts.emails.push(word.text);
        if (word.contentType === 'phone') contacts.phones.push(word.text);
      });
    });
  });
});
```

### **4. Document Classification**
```javascript
// Classify document type based on structure
const hasLists = result.structure.lists.length > 0;
const headingCount = result.structure.headings.length;
const textDensity = result.structure.pageLayout.textDensity;

if (headingCount > 5 && hasLists) {
  return 'report';
} else if (textDensity > 0.7 && result.blocks.some(b => b.blockType === 'list')) {
  return 'form';
} else if (result.structure.title && headingCount < 3) {
  return 'letter';
}
```

### **5. Text Extraction by Position**
```javascript
// Extract header content (top 10%)
const headerText = result.blocks
  .filter(b => b.blockType === 'header')
  .map(b => b.text)
  .join('\n');

// Extract footer content (bottom 10%)
const footerText = result.blocks
  .filter(b => b.blockType === 'footer')
  .map(b => b.text)
  .join('\n');

// Extract main content (exclude header/footer)
const mainContent = result.blocks
  .filter(b => b.blockType !== 'header' && b.blockType !== 'footer')
  .map(b => b.text)
  .join('\n\n');
```

## 🔬 Technical Implementation

### **Semantic Analysis Pipeline**

```
1. OCR Processing (Tesseract.js)
   └─> Raw text + blocks + paragraphs + lines + words + bounding boxes

2. Content Type Detection
   └─> Regex patterns for email, URL, phone, currency, date, number

3. Font Size Estimation
   └─> Calculate from bounding box height (height * 0.75)

4. Alignment Detection
   └─> Analyze margins and center position

5. Paragraph Classification
   └─> Position + font size + content patterns → heading/body/list/caption/footer

6. Block Classification
   └─> Aggregate paragraph types → text/heading/list/table/header/footer

7. Document Structure Analysis
   └─> Extract title, headings, lists, detect columns

8. Reading Order Assignment
   └─> Number blocks in logical sequence (left-to-right, top-to-bottom)
```

### **Detection Algorithms**

#### **Content Type Detection**
- **Email**: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **URL**: `/^(https?:\/\/|www\.)/i`
- **Phone**: `/^[\d\s\-\(\)+]{7,}$/ && /\d{3,}/`
- **Currency**: `/^[$€£¥]?\s*\d+([,\.]\d+)*(\.\d{2})?$/`
- **Date**: `/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/`
- **Number**: `/^\d+([,\.]\d+)*$/`

#### **Text Classification**
```javascript
// Heading: Top 10% + large font OR font size > 16px
if (yPos < pageHeight * 0.1 || fontSize > 16) → heading

// Footer: Bottom 10% of page
if (yPos > pageHeight * 0.9) → footer

// List: Starts with bullet/number pattern
if (/^[\d\.\)\-\•\*]\s/.test(text)) → list

// Caption: Short text near edges
if (textLength < 100 && nearEdge) → caption

// Default
else → body
```

#### **Alignment Detection**
```javascript
const centerPos = (bbox.x0 + bbox.x1) / 2;
const pageCenter = pageWidth / 2;

if (|centerPos - pageCenter| < pageWidth * 0.1) → center
if (rightMargin < 10% && leftMargin > 20%) → right
if (|leftMargin - rightMargin| < 5% && both < 10%) → justified
else → left
```

## 📈 Performance

### **Processing Time Impact**
- **Previous**: ~15-25 seconds per document
- **Current**: ~18-30 seconds per document
- **Overhead**: ~20% slower due to semantic analysis
- **Worth it?**: YES - far more useful output

### **Storage Impact**
- **Previous**: ~2-5 KB per result (plain text + basic structure)
- **Current**: ~15-25 KB per result (full semantic analysis)
- **Increase**: ~5-10x larger
- **Worth it?**: YES - comprehensive structured data

### **Memory Usage**
- **Minimal increase**: Analysis done during processing, not stored in memory
- **No additional worker resources needed**

## 🎯 API Integration

### **Filtering by Content Type**
```javascript
// Get all email addresses
const emails = [];
result.blocks.forEach(block => {
  block.paragraphs.forEach(para => {
    para.lines.forEach(line => {
      line.words.filter(w => w.contentType === 'email')
                .forEach(w => emails.push(w.text));
    });
  });
});
```

### **Building Custom Parsers**
```javascript
// Extract invoice fields by position
const topRight = result.blocks.find(b =>
  b.bbox.x0 > pageWidth * 0.6 &&
  b.bbox.y0 < pageHeight * 0.2
);

// Extract table data (aligned columns)
const tables = result.blocks.filter(b =>
  b.paragraphs.every(p =>
    p.lines.every(l => l.alignment === 'justified')
  )
);
```

## 🚧 Known Limitations

1. **Font detection**: Font family not detected (only size estimation)
2. **Table parsing**: Tables detected but not parsed into rows/columns
3. **Image regions**: Cannot distinguish text from image areas
4. **Multi-language**: Analysis optimized for English
5. **PDF position data**: Approximated for native PDF text (no actual positions)

## 🔮 Future Enhancements

- [ ] **Table extraction** - Parse tables into rows and columns
- [ ] **Font family detection** - Identify font names
- [ ] **Color detection** - Identify text colors
- [ ] **Reading order optimization** - Better handling of complex layouts
- [ ] **Language-specific rules** - Different patterns for different languages
- [ ] **Form field detection** - Identify input fields and checkboxes
- [ ] **Signature detection** - Locate signature areas
- [ ] **Barcode/QR code detection** - Find and decode barcodes

## 📚 Documentation

- **Main README**: `/README.md`
- **Basic Structure**: `/STRUCTURED_OUTPUT.md`
- **This Document**: `/ENHANCED_STRUCTURE.md`
- **API Docs**: http://localhost:3040/api-docs
- **Project Summary**: `/SHORT_MEMORY.md`

## 🧪 Testing

### **Upload a Test Document**
1. Visit http://localhost:3040
2. Upload an invoice, report, or form
3. Wait for processing
4. Switch between the 4 tabs to see:
   - Plain Text view
   - **Document Analysis** (NEW!)
   - Block Hierarchy
   - Raw JSON

### **API Testing**
```bash
# Upload document
curl -X POST http://localhost:3040/api/upload \
  -F "file=@invoice.pdf" \
  -F "documentType=invoice" \
  -F "email=test@example.com"

# Get structured results
curl http://localhost:3040/api/status/{job-id}

# Parse the structure
cat result.json | jq '.structure.headings'
cat result.json | jq '.structure.lists'
cat result.json | jq '.blocks[].blockType'
```

---

**Version**: 3.0.0
**Status**: ✅ Production Ready
**Last Updated**: 2025-10-21
**Breaking Changes**: None (backward compatible)
