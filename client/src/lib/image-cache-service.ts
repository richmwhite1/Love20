export interface ImageCacheEntry {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
  width?: number;
  height?: number;
}

export interface ImageLoadOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  lazy?: boolean;
  placeholder?: string;
}

class ImageCacheService {
  private cache = new Map<string, ImageCacheEntry>();
  private loadingPromises = new Map<string, Promise<ImageCacheEntry>>();
  private observer: IntersectionObserver | null = null;
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private currentCacheSize = 0;

  constructor() {
    this.setupIntersectionObserver();
    this.loadFromStorage();
  }

  private setupIntersectionObserver(): void {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              const url = img.dataset.src;
              if (url) {
                this.loadImage(url, img.dataset.options ? JSON.parse(img.dataset.options) : {})
                  .then((entry) => {
                    img.src = URL.createObjectURL(entry.blob);
                    img.classList.remove('lazy');
                    img.classList.add('loaded');
                  })
                  .catch((error) => {
                    console.warn('Failed to load lazy image:', error);
                    img.classList.add('error');
                  });
                this.observer?.unobserve(img);
              }
            }
          });
        },
        {
          rootMargin: '50px 0px',
          threshold: 0.01
        }
      );
    }
  }

  async loadImage(url: string, options: ImageLoadOptions = {}): Promise<ImageCacheEntry> {
    const cacheKey = this.getCacheKey(url, options);
    
    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
      return cached;
    }

    // Load and cache the image
    const loadPromise = this.fetchAndCacheImage(url, options);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const entry = await loadPromise;
      this.cache.set(cacheKey, entry);
      this.currentCacheSize += entry.size;
      this.cleanupIfNeeded();
      this.saveToStorage();
      return entry;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async fetchAndCacheImage(url: string, options: ImageLoadOptions): Promise<ImageCacheEntry> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      let blob = await response.blob();
      
      // Optimize image if options are provided
      if (options.width || options.height || options.quality || options.format) {
        blob = await this.optimizeImage(blob, options);
      }

      const entry: ImageCacheEntry = {
        url,
        blob,
        timestamp: Date.now(),
        size: blob.size
      };

      // Get image dimensions if possible
      try {
        const dimensions = await this.getImageDimensions(blob);
        entry.width = dimensions.width;
        entry.height = dimensions.height;
      } catch (error) {
        console.warn('Failed to get image dimensions:', error);
      }

      return entry;
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  }

  private async optimizeImage(blob: Blob, options: ImageLoadOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img;
          if (options.width && options.height) {
            width = options.width;
            height = options.height;
          } else if (options.width) {
            height = (img.height * options.width) / img.width;
            width = options.width;
          } else if (options.height) {
            width = (img.width * options.height) / img.height;
            height = options.height;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and optimize
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to desired format
          const quality = options.quality || 0.8;
          const format = options.format || 'webp';
          
          canvas.toBlob(
            (optimizedBlob) => {
              if (optimizedBlob) {
                resolve(optimizedBlob);
              } else {
                resolve(blob); // Fallback to original
              }
            },
            `image/${format}`,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for optimization'));
      img.src = URL.createObjectURL(blob);
    });
  }

  private async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to get image dimensions'));
      img.src = URL.createObjectURL(blob);
    });
  }

  private getCacheKey(url: string, options: ImageLoadOptions): string {
    const optionsString = JSON.stringify(options);
    return `${url}:${optionsString}`;
  }

  private cleanupIfNeeded(): void {
    if (this.currentCacheSize > this.maxCacheSize) {
      // Remove oldest entries until we're under the limit
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      for (const [key, entry] of entries) {
        this.cache.delete(key);
        this.currentCacheSize -= entry.size;
        
        if (this.currentCacheSize <= this.maxCacheSize * 0.8) { // Leave 20% buffer
          break;
        }
      }
    }
  }

  // Lazy loading helper
  setupLazyImage(img: HTMLImageElement, url: string, options: ImageLoadOptions = {}): void {
    if (!this.observer) {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(url, options)
        .then((entry) => {
          img.src = URL.createObjectURL(entry.blob);
          img.classList.remove('lazy');
          img.classList.add('loaded');
        })
        .catch((error) => {
          console.warn('Failed to load image:', error);
          img.classList.add('error');
        });
      return;
    }

    // Set up lazy loading
    img.dataset.src = url;
    img.dataset.options = JSON.stringify(options);
    img.classList.add('lazy');
    
    // Set placeholder if provided
    if (options.placeholder) {
      img.src = options.placeholder;
    }

    this.observer.observe(img);
  }

  // Preload critical images
  async preloadImages(urls: string[], options: ImageLoadOptions = {}): Promise<void> {
    const preloadPromises = urls.map(url => 
      this.loadImage(url, options).catch(error => {
        console.warn(`Failed to preload image ${url}:`, error);
      })
    );

    await Promise.allSettled(preloadPromises);
  }

  // Generate responsive image URLs
  generateResponsiveUrls(baseUrl: string, sizes: number[]): string[] {
    // This would integrate with your image CDN or generate different sizes
    // For now, return the base URL
    return [baseUrl];
  }

  // Create image placeholder
  createPlaceholder(width: number, height: number, color: string = '#f0f0f0'): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    }

    return canvas.toDataURL();
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.loadingPromises.clear();
    localStorage.removeItem('image_cache');
  }

  getCacheStats(): { size: number; entries: number; cacheSize: number } {
    return {
      size: this.currentCacheSize,
      entries: this.cache.size,
      cacheSize: this.maxCacheSize
    };
  }

  private saveToStorage(): void {
    try {
      // Only save metadata to avoid localStorage size limits
      const metadata = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        url: entry.url,
        timestamp: entry.timestamp,
        size: entry.size,
        width: entry.width,
        height: entry.height
      }));

      localStorage.setItem('image_cache_metadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to save image cache metadata:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const metadata = localStorage.getItem('image_cache_metadata');
      if (metadata) {
        const parsed = JSON.parse(metadata);
        // Reconstruct cache entries (without blob data)
        for (const item of parsed) {
          // We'll need to reload the actual images when needed
          this.currentCacheSize += item.size || 0;
        }
      }
    } catch (error) {
      console.warn('Failed to load image cache metadata:', error);
    }
  }

  // Cleanup on page unload
  destroy(): void {
    this.observer?.disconnect();
    this.loadingPromises.clear();
  }
}

// Export singleton instance
export const imageCacheService = new ImageCacheService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    imageCacheService.destroy();
  });
}

export type { ImageCacheEntry, ImageLoadOptions }; 