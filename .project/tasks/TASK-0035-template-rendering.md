# Task: Template Rendering Pipeline
**Phase**: 3 - Proposal Generation System  
**Priority**: High  
**Duration**: 3-4 days  
**Dependencies**: phase2-1-chrome-mcp-extraction  

## Objective
Build a comprehensive template rendering system for generating professional travel proposals with image optimization and PDF generation capabilities.

## Deliverables
- [ ] Nunjucks template rendering system
- [ ] Image download and caching pipeline
- [ ] PDF generation with Puppeteer
- [ ] Version control for proposals

## Implementation Steps

### 1. Template System Setup (Day 1)
**Location**: `/remote-mcp-servers/d1-database-improved/src/render/`

#### Directory Structure
```
src/render/
├── templates/
│   ├── base/
│   │   ├── layout.njk
│   │   ├── header.njk
│   │   └── footer.njk
│   ├── components/
│   │   ├── hotel-card.njk
│   │   ├── itinerary-day.njk
│   │   ├── pricing-table.njk
│   │   └── activity-card.njk
│   ├── proposals/
│   │   ├── standard.njk
│   │   ├── luxury.njk
│   │   └── family.njk
│   └── emails/
│       ├── proposal-cover.njk
│       └── booking-confirmation.njk
├── engine.ts
├── image-manager.ts
├── pdf-generator.ts
└── types.ts
```

#### Template Engine Configuration
```typescript
// src/render/engine.ts
import nunjucks from 'nunjucks';

export class TemplateEngine {
  private env: nunjucks.Environment;
  
  constructor() {
    this.env = nunjucks.configure('templates', {
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    this.registerFilters();
    this.registerGlobals();
  }
  
  private registerFilters() {
    // Date formatting
    this.env.addFilter('date', (date, format) => {
      return formatDate(date, format);
    });
    
    // Currency formatting
    this.env.addFilter('currency', (amount, currency = 'USD') => {
      return formatCurrency(amount, currency);
    });
    
    // Markdown rendering
    this.env.addFilter('markdown', (text) => {
      return renderMarkdown(text);
    });
  }
  
  async render(templateName: string, data: any): Promise<string> {
    return this.env.render(`proposals/${templateName}.njk`, data);
  }
}
```

### 2. Base Templates (Day 1)
**Location**: `/src/render/templates/base/`

#### Layout Template
```nunjucks
{# layout.njk #}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{ title }} - {{ client.name }}</title>
  <style>
    {% include "styles/proposal.css" %}
  </style>
</head>
<body>
  {% block header %}
    {% include "header.njk" %}
  {% endblock %}
  
  <main class="proposal-content">
    {% block content %}{% endblock %}
  </main>
  
  {% block footer %}
    {% include "footer.njk" %}
  {% endblock %}
</body>
</html>
```

#### Component Templates
```nunjucks
{# components/hotel-card.njk #}
<div class="hotel-card" data-hotel-id="{{ hotel.id }}">
  <div class="hotel-images">
    {% for image in hotel.images[:3] %}
      <img src="{{ image.local_path | default(image.url) }}" 
           alt="{{ hotel.name }}" 
           loading="lazy">
    {% endfor %}
  </div>
  
  <div class="hotel-info">
    <h3>{{ hotel.name }}</h3>
    <div class="rating">{{ hotel.star_rating }} stars</div>
    <p class="location">{{ hotel.location }}</p>
    
    <div class="pricing">
      <span class="price">{{ hotel.lead_price | currency }}</span>
      <span class="per-night">per night</span>
      {% if hotel.commission_amount %}
        <span class="commission-indicator">✓</span>
      {% endif %}
    </div>
    
    <div class="features">
      {% for amenity in hotel.amenities[:5] %}
        <span class="amenity">{{ amenity }}</span>
      {% endfor %}
    </div>
    
    {% if hotel.refundable %}
      <div class="refundable-badge">
        Free cancellation until {{ hotel.cancellation_deadline | date }}
      </div>
    {% endif %}
  </div>
</div>
```

### 3. Image Management System (Day 2)
**Location**: `/src/render/image-manager.ts`

#### Image Downloader
```typescript
import crypto from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';

export class ImageManager {
  private storageRoot: string;
  private cache: Map<string, string>;
  
  constructor(storageRoot: string) {
    this.storageRoot = storageRoot;
    this.cache = new Map();
  }
  
  async downloadImage(url: string, options?: ImageOptions): Promise<LocalImage> {
    // Check cache by URL hash
    const urlHash = this.hashUrl(url);
    if (this.cache.has(urlHash)) {
      return { localPath: this.cache.get(urlHash)! };
    }
    
    try {
      // Download image
      const response = await fetch(url);
      const buffer = await response.buffer();
      
      // Calculate content hash for deduplication
      const contentHash = crypto
        .createHash('sha1')
        .update(buffer)
        .digest('hex');
      
      // Check if image already exists by content
      const existingPath = await this.findByContentHash(contentHash);
      if (existingPath) {
        this.cache.set(urlHash, existingPath);
        return { localPath: existingPath };
      }
      
      // Process and save image
      const processed = await this.processImage(buffer, options);
      const localPath = await this.saveImage(processed, contentHash);
      
      // Update cache and database
      this.cache.set(urlHash, localPath);
      await this.recordImage(url, localPath, contentHash);
      
      return { localPath };
    } catch (error) {
      console.error(`Failed to download image: ${url}`, error);
      return { localPath: null, error: error.message };
    }
  }
  
  private async processImage(
    buffer: Buffer, 
    options?: ImageOptions
  ): Promise<Buffer> {
    let pipeline = sharp(buffer);
    
    // Resize if needed
    if (options?.maxWidth || options?.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Optimize
    pipeline = pipeline.jpeg({ 
      quality: options?.quality || 85,
      progressive: true 
    });
    
    return pipeline.toBuffer();
  }
}
```

#### Batch Image Processing
```typescript
export class BatchImageProcessor {
  private manager: ImageManager;
  private concurrency: number = 5;
  
  async processProposalImages(
    proposal: ProposalData
  ): Promise<ProposalData> {
    const imageUrls = this.extractImageUrls(proposal);
    
    // Download images in batches
    const results = await this.downloadBatch(imageUrls);
    
    // Update proposal with local paths
    return this.updateImagePaths(proposal, results);
  }
  
  private async downloadBatch(
    urls: string[]
  ): Promise<Map<string, string>> {
    const results = new Map();
    
    // Process in chunks for rate limiting
    for (let i = 0; i < urls.length; i += this.concurrency) {
      const chunk = urls.slice(i, i + this.concurrency);
      const downloads = chunk.map(url => 
        this.manager.downloadImage(url)
          .then(result => ({ url, ...result }))
      );
      
      const chunkResults = await Promise.allSettled(downloads);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.url, result.value.localPath);
        }
      }
    }
    
    return results;
  }
}
```

### 4. PDF Generation (Day 2-3)
**Location**: `/src/render/pdf-generator.ts`

#### Puppeteer Setup
```typescript
import puppeteer from 'puppeteer';

export class PDFGenerator {
  private browser: puppeteer.Browser | null = null;
  
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  
  async generatePDF(
    html: string, 
    options?: PDFOptions
  ): Promise<Buffer> {
    if (!this.browser) {
      await this.initialize();
    }
    
    const page = await this.browser!.newPage();
    
    try {
      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1200,
        height: 800
      });
      
      // Load HTML with local file access
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });
      
      // Wait for images to load
      await page.evaluateHandle('document.fonts.ready');
      await this.waitForImages(page);
      
      // Generate PDF
      const pdf = await page.pdf({
        format: options?.format || 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: options?.includeHeaders || false,
        headerTemplate: options?.headerTemplate,
        footerTemplate: options?.footerTemplate
      });
      
      return pdf;
    } finally {
      await page.close();
    }
  }
  
  private async waitForImages(page: puppeteer.Page) {
    await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      }));
    });
  }
}
```

### 5. Proposal Generation Pipeline (Day 3)
**Location**: `/src/render/proposal-generator.ts`

#### Complete Pipeline
```typescript
export class ProposalGenerator {
  private templateEngine: TemplateEngine;
  private imageProcessor: BatchImageProcessor;
  private pdfGenerator: PDFGenerator;
  
  async generateProposal(
    tripId: string,
    templateName: string = 'standard'
  ): Promise<GeneratedProposal> {
    // 1. Load trip data
    const tripData = await this.loadTripData(tripId);
    
    // 2. Process images
    const processedData = await this.imageProcessor
      .processProposalImages(tripData);
    
    // 3. Render HTML
    const html = await this.templateEngine
      .render(templateName, processedData);
    
    // 4. Generate PDF
    const pdf = await this.pdfGenerator.generatePDF(html);
    
    // 5. Save proposal version
    const proposal = await this.saveProposal({
      trip_id: tripId,
      template_name: templateName,
      json_payload: JSON.stringify(processedData),
      rendered_html: html,
      pdf_buffer: pdf,
      total_cost: this.calculateTotalCost(processedData),
      total_commission: this.calculateTotalCommission(processedData)
    });
    
    return proposal;
  }
  
  private async loadTripData(tripId: string): Promise<TripData> {
    // Load from trip_facts for fast access
    const facts = await db.query(
      'SELECT facts FROM trip_facts WHERE trip_id = ?',
      [tripId]
    );
    
    return JSON.parse(facts.facts);
  }
}
```

### 6. Version Control System (Day 3-4)
**Location**: `/src/render/version-control.ts`

#### Proposal Versioning
```typescript
export class ProposalVersionControl {
  async createVersion(
    proposalId: number,
    changes: string
  ): Promise<ProposalVersion> {
    // Get current version
    const current = await this.getCurrentVersion(proposalId);
    
    // Create new version
    const newVersion = {
      proposal_id: proposalId,
      version: current.version + 1,
      changes,
      created_at: new Date().toISOString()
    };
    
    // Copy proposal data with new version
    await this.copyProposal(current, newVersion);
    
    return newVersion;
  }
  
  async compareVersions(
    proposalId: number,
    version1: number,
    version2: number
  ): Promise<VersionDiff> {
    const v1 = await this.getVersion(proposalId, version1);
    const v2 = await this.getVersion(proposalId, version2);
    
    return {
      changes: this.diffJSON(v1.json_payload, v2.json_payload),
      cost_difference: v2.total_cost - v1.total_cost,
      commission_difference: v2.total_commission - v1.total_commission
    };
  }
}
```

### 7. MCP Tool Integration (Day 4)
**Location**: `/src/tools/proposal-tools.ts`

#### Tool: `generate_proposal`
```typescript
{
  name: 'generate_proposal',
  description: 'Generate a travel proposal from trip data',
  inputSchema: {
    trip_id: string;
    template: string;
    options?: {
      include_images: boolean;
      generate_pdf: boolean;
      image_quality: number;
      custom_data?: any;
    };
  }
}
```

#### Tool: `preview_proposal`
```typescript
{
  name: 'preview_proposal',
  description: 'Preview proposal HTML without saving',
  inputSchema: {
    trip_id: string;
    template: string;
    custom_data?: any;
  }
}
```

## Testing Strategy

### Unit Tests
- [ ] Template rendering accuracy
- [ ] Image download and processing
- [ ] PDF generation quality
- [ ] Version control operations

### Integration Tests
- [ ] Complete pipeline flow
- [ ] Error handling
- [ ] Performance under load
- [ ] Image deduplication

### Visual Tests
- [ ] Template rendering consistency
- [ ] PDF layout accuracy
- [ ] Image quality validation
- [ ] Responsive design

## Success Criteria
- Proposals generate in <30 seconds
- Images download and optimize correctly
- PDFs render consistently across platforms
- Version control tracks all changes
- Templates are customizable and maintainable

## Notes
- Consider CDN for image storage in production
- Implement template caching for performance
- Add watermarking capability for drafts
- Plan for email delivery integration
- Consider accessibility in PDF generation