import { ImageData } from './types';

export interface ImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface LocalImage {
  localPath?: string;
  error?: string;
}

// Simplified image manager for Cloudflare Workers
// Focuses on URL validation and caching metadata rather than actual image processing
export class ImageManager {
  private cache: Map<string, string>;
  
  constructor() {
    this.cache = new Map();
  }
  
  // For Cloudflare Workers, we'll focus on URL validation and caching references
  async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return response.ok && (contentType?.startsWith('image/') || false);
    } catch (error) {
      console.error(`Failed to validate image URL: ${url}`, error);
      return false;
    }
  }
  
  // Simple URL hash for caching
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  // Process image URLs for templates - validate and cache metadata
  async processImageUrl(url: string, options?: ImageOptions): Promise<LocalImage> {
    if (!url) {
      return { error: 'No URL provided' };
    }
    
    const urlHash = this.hashUrl(url);
    
    // Check cache
    if (this.cache.has(urlHash)) {
      return { localPath: this.cache.get(urlHash)! };
    }
    
    try {
      const isValid = await this.validateImageUrl(url);
      if (!isValid) {
        return { error: 'Invalid image URL' };
      }
      
      // For now, we'll use the original URL
      // In the future, this could proxy through a service or CDN
      const processedUrl = this.buildProcessedUrl(url, options);
      this.cache.set(urlHash, processedUrl);
      
      return { localPath: processedUrl };
    } catch (error) {
      console.error(`Failed to process image: ${url}`, error);
      return { error: error.message };
    }
  }
  
  private buildProcessedUrl(url: string, options?: ImageOptions): string {
    // For Cloudflare Workers, we can use Cloudflare Images or a third-party service
    // For now, return the original URL with query parameters for future processing
    if (!options) return url;
    
    const params = new URLSearchParams();
    if (options.maxWidth) params.set('w', options.maxWidth.toString());
    if (options.maxHeight) params.set('h', options.maxHeight.toString());
    if (options.quality) params.set('q', options.quality.toString());
    
    const separator = url.includes('?') ? '&' : '?';
    return params.toString() ? `${url}${separator}${params.toString()}` : url;
  }
  
  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
  
  // Get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Batch image processor for handling multiple images in a proposal
export class BatchImageProcessor {
  private manager: ImageManager;
  private concurrency: number = 5;
  
  constructor() {
    this.manager = new ImageManager();
  }
  
  async processProposalImages(proposalData: any): Promise<any> {
    // Clone the proposal data to avoid mutations
    const processedData = JSON.parse(JSON.stringify(proposalData));
    
    // Extract and process all image URLs
    const imageUrls = this.extractImageUrls(processedData);
    if (imageUrls.length === 0) {
      return processedData;
    }
    
    // Process images in batches
    const results = await this.processBatch(imageUrls);
    
    // Update the proposal data with processed image URLs
    return this.updateImagePaths(processedData, results);
  }
  
  private extractImageUrls(data: any): string[] {
    const urls: string[] = [];
    
    if (data.hotels && Array.isArray(data.hotels)) {
      for (const hotel of data.hotels) {
        if (hotel.images && Array.isArray(hotel.images)) {
          for (const image of hotel.images) {
            if (image.url) {
              urls.push(image.url);
            }
          }
        }
      }
    }
    
    if (data.activities && Array.isArray(data.activities)) {
      for (const activity of data.activities) {
        if (activity.images && Array.isArray(activity.images)) {
          for (const image of activity.images) {
            if (image.url) {
              urls.push(image.url);
            }
          }
        }
      }
    }
    
    return [...new Set(urls)]; // Remove duplicates
  }
  
  private async processBatch(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Process URLs in chunks to respect rate limits
    for (let i = 0; i < urls.length; i += this.concurrency) {
      const chunk = urls.slice(i, i + this.concurrency);
      const promises = chunk.map(async (url) => {
        const result = await this.manager.processImageUrl(url, {
          maxWidth: 800,
          quality: 85
        });
        return { url, result };
      });
      
      const chunkResults = await Promise.allSettled(promises);
      
      for (const promiseResult of chunkResults) {
        if (promiseResult.status === 'fulfilled') {
          const { url, result } = promiseResult.value;
          if (result.localPath) {
            results.set(url, result.localPath);
          }
        }
      }
    }
    
    return results;
  }
  
  private updateImagePaths(data: any, imageMap: Map<string, string>): any {
    // Update hotel images
    if (data.hotels && Array.isArray(data.hotels)) {
      for (const hotel of data.hotels) {
        if (hotel.images && Array.isArray(hotel.images)) {
          for (const image of hotel.images) {
            if (image.url && imageMap.has(image.url)) {
              image.local_path = imageMap.get(image.url);
            }
          }
        }
      }
    }
    
    // Update activity images
    if (data.activities && Array.isArray(data.activities)) {
      for (const activity of data.activities) {
        if (activity.images && Array.isArray(activity.images)) {
          for (const image of activity.images) {
            if (image.url && imageMap.has(image.url)) {
              image.local_path = imageMap.get(image.url);
            }
          }
        }
      }
    }
    
    return data;
  }
}