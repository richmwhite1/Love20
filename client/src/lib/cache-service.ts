import { User, Post, List, FriendRequest } from '@shared/schema';

export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate: number;
  maxSize: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  etag?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastCleanup: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    lastCleanup: Date.now()
  };

  private configs: Record<string, CacheConfig> = {
    userProfile: { maxAge: 5 * 60 * 1000, staleWhileRevalidate: 10 * 60 * 1000, maxSize: 100 },
    postFeed: { maxAge: 1 * 60 * 1000, staleWhileRevalidate: 5 * 60 * 1000, maxSize: 50 },
    postDetail: { maxAge: 2 * 60 * 1000, staleWhileRevalidate: 10 * 60 * 1000, maxSize: 200 },
    userLists: { maxAge: 10 * 60 * 1000, staleWhileRevalidate: 20 * 60 * 1000, maxSize: 50 },
    friendList: { maxAge: 5 * 60 * 1000, staleWhileRevalidate: 10 * 60 * 1000, maxSize: 100 },
    privacySettings: { maxAge: 30 * 60 * 1000, staleWhileRevalidate: 60 * 60 * 1000, maxSize: 50 },
    hashtags: { maxAge: 15 * 60 * 1000, staleWhileRevalidate: 30 * 60 * 1000, maxSize: 100 },
    notifications: { maxAge: 30 * 1000, staleWhileRevalidate: 2 * 60 * 1000, maxSize: 50 }
  };

  private invalidationPatterns: Record<string, string[]> = {
    userProfile: ['user:*', 'post:*', 'friend:*'],
    postFeed: ['post:*', 'user:*'],
    postDetail: ['post:*', 'comment:*', 'like:*'],
    userLists: ['list:*', 'user:*'],
    friendList: ['friend:*', 'user:*'],
    privacySettings: ['user:*', 'privacy:*'],
    hashtags: ['hashtag:*', 'post:*'],
    notifications: ['notification:*', 'user:*']
  };

  constructor() {
    this.setupPeriodicCleanup();
    this.loadFromStorage();
  }

  private getCacheKey(type: string, id: string, params?: Record<string, any>): string {
    const paramString = params ? `:${JSON.stringify(params)}` : '';
    return `${type}:${id}${paramString}`;
  }

  private getConfig(type: string): CacheConfig {
    return this.configs[type] || { maxAge: 5 * 60 * 1000, staleWhileRevalidate: 10 * 60 * 1000, maxSize: 100 };
  }

  set<T>(type: string, id: string, data: T, params?: Record<string, any>, etag?: string): void {
    const key = this.getCacheKey(type, id, params);
    const config = this.getConfig(type);
    const version = this.getDataVersion(type, data);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version,
      etag
    };

    // Check if we need to evict entries due to size limit
    if (this.cache.size >= config.maxSize) {
      this.evictOldest(type);
    }

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    this.saveToStorage();
  }

  get<T>(type: string, id: string, params?: Record<string, any>): T | null {
    const key = this.getCacheKey(type, id, params);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const config = this.getConfig(type);
    const age = Date.now() - entry.timestamp;

    // Check if entry is fresh
    if (age < config.maxAge) {
      this.stats.hits++;
      return entry.data;
    }

    // Check if entry is stale but can be used while revalidating
    if (age < config.maxAge + config.staleWhileRevalidate) {
      this.stats.hits++;
      // Trigger background revalidation
      this.triggerRevalidation(type, id, params);
      return entry.data;
    }

    // Entry is too old, remove it
    this.cache.delete(key);
    this.stats.misses++;
    this.stats.size = this.cache.size;
    return null;
  }

  private triggerRevalidation(type: string, id: string, params?: Record<string, any>): void {
    // This would trigger a background fetch to update the cache
    // For now, we'll just mark it for revalidation
    setTimeout(() => {
      this.invalidate(type, id, params);
    }, 100);
  }

  invalidate(type: string, id: string, params?: Record<string, any>): void {
    const key = this.getCacheKey(type, id, params);
    this.cache.delete(key);
    this.stats.size = this.cache.size;
    this.saveToStorage();
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
    this.saveToStorage();
  }

  invalidateByType(type: string): void {
    const patterns = this.invalidationPatterns[type] || [];
    patterns.forEach(pattern => this.invalidatePattern(pattern));
  }

  // Smart invalidation based on data changes
  invalidateUserData(userId: string): void {
    this.invalidatePattern(`user:${userId}`);
    this.invalidatePattern(`post:*`); // Posts might show user info
    this.invalidatePattern(`friend:*`); // Friend lists might change
    this.invalidatePattern(`list:*`); // User's lists might change
  }

  invalidatePostData(postId: string): void {
    this.invalidatePattern(`post:${postId}`);
    this.invalidatePattern(`postFeed:*`); // Feed caches need updating
    this.invalidatePattern(`hashtag:*`); // Hashtag feeds might change
  }

  invalidateFriendData(userId: string): void {
    this.invalidatePattern(`friend:${userId}`);
    this.invalidatePattern(`friendList:*`);
    this.invalidatePattern(`user:*`); // User profiles might show friend status
  }

  invalidatePrivacyData(userId: string): void {
    this.invalidatePattern(`privacy:${userId}`);
    this.invalidatePattern(`user:${userId}`);
    this.invalidatePattern(`post:*`); // Post visibility might change
    this.invalidatePattern(`list:*`); // List visibility might change
  }

  // Cache warming for critical user data
  async warmUserCache(userId: string): Promise<void> {
    const warmingTasks = [
      this.warmUserProfile(userId),
      this.warmUserLists(userId),
      this.warmUserFriends(userId),
      this.warmUserPrivacySettings(userId)
    ];

    await Promise.allSettled(warmingTasks);
  }

  private async warmUserProfile(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const user = await response.json();
        this.set('userProfile', userId, user);
      }
    } catch (error) {
      console.warn('Failed to warm user profile cache:', error);
    }
  }

  private async warmUserLists(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/users/${userId}/lists`);
      if (response.ok) {
        const lists = await response.json();
        this.set('userLists', userId, lists);
      }
    } catch (error) {
      console.warn('Failed to warm user lists cache:', error);
    }
  }

  private async warmUserFriends(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/friends`);
      if (response.ok) {
        const friends = await response.json();
        this.set('friendList', userId, friends);
      }
    } catch (error) {
      console.warn('Failed to warm user friends cache:', error);
    }
  }

  private async warmUserPrivacySettings(userId: string): Promise<void> {
    try {
      const response = await fetch(`/api/users/${userId}/privacy`);
      if (response.ok) {
        const privacy = await response.json();
        this.set('privacySettings', userId, privacy);
      }
    } catch (error) {
      console.warn('Failed to warm user privacy cache:', error);
    }
  }

  private getDataVersion(type: string, data: any): string {
    // Generate a version based on data content and timestamp
    const contentHash = JSON.stringify(data).length;
    return `${type}-${contentHash}-${Date.now()}`;
  }

  private evictOldest(type: string): void {
    const config = this.getConfig(type);
    const typeKeys = Array.from(this.cache.keys()).filter(key => key.startsWith(`${type}:`));
    
    if (typeKeys.length >= config.maxSize) {
      // Find the oldest entry for this type
      let oldestKey = typeKeys[0];
      let oldestTime = this.cache.get(oldestKey)?.timestamp || 0;

      for (const key of typeKeys) {
        const entry = this.cache.get(key);
        if (entry && entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      this.cache.delete(oldestKey);
    }
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const config = this.getConfig(key.split(':')[0]);
      const age = now - entry.timestamp;

      if (age > config.maxAge + config.staleWhileRevalidate) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;
    this.stats.lastCleanup = now;

    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} stale entries`);
      this.saveToStorage();
    }
  }

  private saveToStorage(): void {
    try {
      const cacheData = {
        entries: Array.from(this.cache.entries()),
        stats: this.stats
      };
      localStorage.setItem('app_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const cacheData = localStorage.getItem('app_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        this.cache = new Map(parsed.entries || []);
        this.stats = parsed.stats || this.stats;
        this.stats.size = this.cache.size;
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      lastCleanup: Date.now()
    };
    localStorage.removeItem('app_cache');
  }

  // Preload critical data for better UX
  async preloadCriticalData(userId: string): Promise<void> {
    const criticalData = [
      { type: 'userProfile', id: userId },
      { type: 'friendList', id: userId },
      { type: 'notifications', id: userId }
    ];

    const preloadPromises = criticalData.map(async ({ type, id }) => {
      const cached = this.get(type, id);
      if (!cached) {
        await this.warmUserCache(userId);
      }
    });

    await Promise.allSettled(preloadPromises);
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export types for use in other modules
export type { CacheConfig, CacheEntry, CacheStats }; 