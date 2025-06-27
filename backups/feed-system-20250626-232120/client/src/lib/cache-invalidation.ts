import { cacheService } from './cache-service';
import { imageCacheService } from './image-cache-service';

export interface CacheInvalidationEvent {
  type: 'user' | 'post' | 'list' | 'friend' | 'privacy' | 'notification' | 'hashtag';
  action: 'create' | 'update' | 'delete';
  id: string;
  userId?: string;
  data?: any;
}

class CacheInvalidationService {
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  // Invalidate cache based on user changes
  invalidateUserCache(userId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating user cache for ${userId} (${action})`);
    
    // Invalidate user profile
    cacheService.invalidate('userProfile', userId);
    
    // Invalidate related data
    cacheService.invalidateUserData(userId);
    
    // Invalidate friend lists that might include this user
    cacheService.invalidatePattern('friendList:*');
    
    // Invalidate post feeds that might show user info
    cacheService.invalidatePattern('postFeed:*');
    
    // Invalidate lists owned by this user
    cacheService.invalidatePattern(`list:*`);
    
    // Emit event for other listeners
    this.emit('user', action, userId);
  }

  // Invalidate cache based on post changes
  invalidatePostCache(postId: string, userId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating post cache for ${postId} (${action})`);
    
    // Invalidate specific post
    cacheService.invalidate('postDetail', postId);
    
    // Invalidate post feeds
    cacheService.invalidatePattern('postFeed:*');
    
    // Invalidate hashtag feeds if post has hashtags
    cacheService.invalidatePattern('hashtag:*');
    
    // Invalidate user's post list
    cacheService.invalidate('userPosts', userId);
    
    // Invalidate related user data
    cacheService.invalidateUserData(userId);
    
    // Emit event for other listeners
    this.emit('post', action, postId, { userId });
  }

  // Invalidate cache based on list changes
  invalidateListCache(listId: string, userId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating list cache for ${listId} (${action})`);
    
    // Invalidate specific list
    cacheService.invalidate('listDetail', listId);
    
    // Invalidate user's lists
    cacheService.invalidate('userLists', userId);
    
    // Invalidate list collaborators
    cacheService.invalidatePattern(`listCollaborators:${listId}`);
    
    // Invalidate related user data
    cacheService.invalidateUserData(userId);
    
    // Emit event for other listeners
    this.emit('list', action, listId, { userId });
  }

  // Invalidate cache based on friendship changes
  invalidateFriendCache(userId: string, friendId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating friend cache for ${userId} and ${friendId} (${action})`);
    
    // Invalidate friend lists for both users
    cacheService.invalidate('friendList', userId);
    cacheService.invalidate('friendList', friendId);
    
    // Invalidate friend requests
    cacheService.invalidatePattern('friendRequests:*');
    
    // Invalidate user profiles that might show friend status
    cacheService.invalidate('userProfile', userId);
    cacheService.invalidate('userProfile', friendId);
    
    // Invalidate post feeds that might show friend content
    cacheService.invalidatePattern('postFeed:*');
    
    // Emit event for other listeners
    this.emit('friend', action, userId, { friendId });
  }

  // Invalidate cache based on privacy setting changes
  invalidatePrivacyCache(userId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating privacy cache for ${userId} (${action})`);
    
    // Invalidate privacy settings
    cacheService.invalidate('privacySettings', userId);
    
    // Invalidate user profile
    cacheService.invalidate('userProfile', userId);
    
    // Invalidate post feeds that might be affected by privacy changes
    cacheService.invalidatePattern('postFeed:*');
    
    // Invalidate list visibility
    cacheService.invalidatePattern('list:*');
    
    // Invalidate friend lists that might be affected
    cacheService.invalidatePattern('friendList:*');
    
    // Emit event for other listeners
    this.emit('privacy', action, userId);
  }

  // Invalidate cache based on notification changes
  invalidateNotificationCache(userId: string, notificationId?: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating notification cache for ${userId} (${action})`);
    
    // Invalidate notifications
    cacheService.invalidate('notifications', userId);
    
    // Invalidate specific notification if provided
    if (notificationId) {
      cacheService.invalidate('notificationDetail', notificationId);
    }
    
    // Invalidate notification counts
    cacheService.invalidate('notificationCount', userId);
    
    // Emit event for other listeners
    this.emit('notification', action, userId, { notificationId });
  }

  // Invalidate cache based on hashtag changes
  invalidateHashtagCache(hashtagId: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    console.log(`Invalidating hashtag cache for ${hashtagId} (${action})`);
    
    // Invalidate hashtag detail
    cacheService.invalidate('hashtagDetail', hashtagId);
    
    // Invalidate hashtag feeds
    cacheService.invalidatePattern('hashtagFeed:*');
    
    // Invalidate post feeds that might include hashtag content
    cacheService.invalidatePattern('postFeed:*');
    
    // Invalidate hashtag suggestions
    cacheService.invalidate('hashtagSuggestions', 'global');
    
    // Emit event for other listeners
    this.emit('hashtag', action, hashtagId);
  }

  // Smart invalidation based on data changes
  smartInvalidate(data: any, type: string, action: 'create' | 'update' | 'delete' = 'update'): void {
    switch (type) {
      case 'user':
        this.invalidateUserCache(data.id || data.userId, action);
        break;
      case 'post':
        this.invalidatePostCache(data.id, data.userId, action);
        break;
      case 'list':
        this.invalidateListCache(data.id, data.userId, action);
        break;
      case 'friend':
        this.invalidateFriendCache(data.userId, data.friendId, action);
        break;
      case 'privacy':
        this.invalidatePrivacyCache(data.userId, action);
        break;
      case 'notification':
        this.invalidateNotificationCache(data.userId, data.id, action);
        break;
      case 'hashtag':
        this.invalidateHashtagCache(data.id, action);
        break;
      default:
        console.warn(`Unknown cache invalidation type: ${type}`);
    }
  }

  // Batch invalidation for multiple changes
  batchInvalidate(events: CacheInvalidationEvent[]): void {
    console.log(`Batch invalidating ${events.length} cache events`);
    
    const groupedEvents = this.groupEventsByType(events);
    
    // Process events by type to avoid redundant invalidations
    for (const [type, typeEvents] of Object.entries(groupedEvents)) {
      const uniqueIds = [...new Set(typeEvents.map(e => e.id))];
      
      switch (type) {
        case 'user':
          uniqueIds.forEach(id => this.invalidateUserCache(id, 'update'));
          break;
        case 'post':
          uniqueIds.forEach(id => {
            const event = typeEvents.find(e => e.id === id);
            this.invalidatePostCache(id, event?.userId || '', 'update');
          });
          break;
        case 'list':
          uniqueIds.forEach(id => {
            const event = typeEvents.find(e => e.id === id);
            this.invalidateListCache(id, event?.userId || '', 'update');
          });
          break;
        case 'friend':
          uniqueIds.forEach(id => {
            const event = typeEvents.find(e => e.id === id);
            this.invalidateFriendCache(id, event?.data?.friendId || '', 'update');
          });
          break;
        case 'privacy':
          uniqueIds.forEach(id => this.invalidatePrivacyCache(id, 'update'));
          break;
        case 'notification':
          uniqueIds.forEach(id => {
            const event = typeEvents.find(e => e.id === id);
            this.invalidateNotificationCache(id, event?.data?.notificationId, 'update');
          });
          break;
        case 'hashtag':
          uniqueIds.forEach(id => this.invalidateHashtagCache(id, 'update'));
          break;
      }
    }
  }

  private groupEventsByType(events: CacheInvalidationEvent[]): Record<string, CacheInvalidationEvent[]> {
    return events.reduce((groups, event) => {
      if (!groups[event.type]) {
        groups[event.type] = [];
      }
      groups[event.type].push(event);
      return groups;
    }, {} as Record<string, CacheInvalidationEvent[]>);
  }

  // Event system for cache invalidation
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Cache invalidation event handler error:', error);
        }
      });
    }
  }

  // Setup event listeners for automatic cache invalidation
  private setupEventListeners(): void {
    // Listen for user authentication changes
    this.on('user', (action: string, userId: string) => {
      if (action === 'update') {
        // Preload user data after profile update
        setTimeout(() => {
          cacheService.warmUserCache(userId);
        }, 1000);
      }
    });

    // Listen for post changes
    this.on('post', (action: string, postId: string, data: any) => {
      if (action === 'create') {
        // Preload related data for new posts
        setTimeout(() => {
          cacheService.warmUserCache(data.userId);
        }, 1000);
      }
    });

    // Listen for friend changes
    this.on('friend', (action: string, userId: string, data: any) => {
      if (action === 'create') {
        // Preload friend data
        setTimeout(() => {
          cacheService.warmUserCache(userId);
          cacheService.warmUserCache(data.friendId);
        }, 1000);
      }
    });
  }

  // Cache warming for critical data
  async warmCriticalCache(userId: string): Promise<void> {
    console.log(`Warming critical cache for user ${userId}`);
    
    try {
      await cacheService.preloadCriticalData(userId);
      
      // Preload user's recent posts
      const recentPostsResponse = await fetch(`/api/users/${userId}/posts?limit=10`);
      if (recentPostsResponse.ok) {
        const posts = await recentPostsResponse.json();
        cacheService.set('userPosts', userId, posts);
      }
      
      // Preload user's lists
      const listsResponse = await fetch(`/api/users/${userId}/lists`);
      if (listsResponse.ok) {
        const lists = await listsResponse.json();
        cacheService.set('userLists', userId, lists);
      }
      
      console.log(`Cache warming completed for user ${userId}`);
    } catch (error) {
      console.error(`Cache warming failed for user ${userId}:`, error);
    }
  }

  // Get cache statistics
  getCacheStats(): any {
    return {
      cache: cacheService.getStats(),
      imageCache: imageCacheService.getCacheStats()
    };
  }

  // Clear all caches
  clearAllCaches(): void {
    console.log('Clearing all caches');
    cacheService.clear();
    imageCacheService.clearCache();
  }
}

// Export singleton instance
export const cacheInvalidationService = new CacheInvalidationService();

// Export types for use in other modules
export type { CacheInvalidationEvent }; 