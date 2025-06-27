import { authService } from './auth-service';
import { cacheService } from './cache-service';
import { cacheInvalidationService } from './cache-invalidation';

// API base URL
const API_BASE = '/api';

// Standard API response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  message?: string;
}

// API service options
export interface ApiOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipAuth?: boolean;
  skipLogging?: boolean;
  skipCache?: boolean;
  cacheKey?: string;
  cacheType?: string;
  cacheParams?: Record<string, any>;
}

// Default options
const DEFAULT_OPTIONS: Required<ApiOptions> = {
  headers: {},
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  skipAuth: false,
  skipLogging: false,
  skipCache: false,
  cacheKey: '',
  cacheType: '',
  cacheParams: {},
};

// Request/Response logging
interface LogEntry {
  timestamp: string;
  method: string;
  endpoint: string;
  requestId: string;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  error?: string;
  duration: number;
  cacheHit?: boolean;
}

class ApiLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  log(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      const { timestamp, method, endpoint, requestId, responseStatus, error, duration, cacheHit } = entry;
      const statusColor = responseStatus && responseStatus < 400 ? 'green' : 'red';
      const cacheIcon = cacheHit ? '💾' : '🌐';
      console.group(`${cacheIcon} API ${method} ${endpoint} (${requestId})`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Status: %c${responseStatus || 'ERROR'}`, `color: ${statusColor}`);
      if (cacheHit) {
        console.log('💾 Cache hit');
      }
      if (error) {
        console.error('❌ Error:', error);
      }
      console.groupEnd();
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

// Loading state management
class LoadingStateManager {
  private loadingStates = new Map<string, boolean>();
  private listeners = new Set<(endpoint: string, loading: boolean) => void>();

  setLoading(endpoint: string, loading: boolean) {
    this.loadingStates.set(endpoint, loading);
    this.notifyListeners(endpoint, loading);
  }

  isLoading(endpoint: string): boolean {
    return this.loadingStates.get(endpoint) || false;
  }

  addListener(listener: (endpoint: string, loading: boolean) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (endpoint: string, loading: boolean) => void) {
    this.listeners.delete(listener);
  }

  private notifyListeners(endpoint: string, loading: boolean) {
    this.listeners.forEach(listener => listener(endpoint, loading));
  }
}

// Global instances
const logger = new ApiLogger();
const loadingManager = new LoadingStateManager();

// Generate unique request ID
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Wait for specified time
const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry logic with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    await wait(delay);
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
};

// Parse response based on content type
const parseResponse = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  
  if (contentType?.includes('text/')) {
    return response.text();
  }
  
  return response.blob();
};

// Standardize error messages
const standardizeError = (error: any, status?: number): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (status) {
    switch (status) {
      case 400: return 'Bad request - please check your input';
      case 401: return 'Authentication required - please sign in';
      case 403: return 'Access denied - you don\'t have permission';
      case 404: return 'Resource not found';
      case 429: return 'Too many requests - please try again later';
      case 500: return 'Server error - please try again later';
      case 502: return 'Bad gateway - service temporarily unavailable';
      case 503: return 'Service unavailable - please try again later';
      default: return 'An unexpected error occurred';
    }
  }
  
  return 'Network error - please check your connection';
};

// Cache-aware request function
const makeCachedRequest = async <T>(
  method: string,
  endpoint: string,
  data?: any,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // For GET requests, try cache first
  if (method === 'GET' && !opts.skipCache && opts.cacheType && opts.cacheKey) {
    const cached = cacheService.get<T>(opts.cacheType, opts.cacheKey, opts.cacheParams);
    if (cached) {
      logger.log({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        requestId: 'cache-hit',
        duration: 0,
        cacheHit: true,
        responseStatus: 200,
        responseBody: cached
      });
      
      return {
        success: true,
        data: cached
      };
    }
  }
  
  // Make the actual request
  const response = await makeRequest<T>(method, endpoint, data, options);
  
  // Cache successful GET responses
  if (method === 'GET' && response.success && !opts.skipCache && opts.cacheType && opts.cacheKey) {
    cacheService.set(opts.cacheType, opts.cacheKey, response.data, opts.cacheParams);
  }
  
  return response;
};

// Core API request function
const makeRequest = async <T>(
  method: string,
  endpoint: string,
  data?: any,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const requestId = generateRequestId();
  const startTime = Date.now();
  const fullUrl = `${API_BASE}${endpoint}`;

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };

  // Add authentication token
  if (!opts.skipAuth) {
    try {
      const token = await authService.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
  }

  // Prepare request body
  let body: string | undefined;
  if (data && method !== 'GET') {
    if (data instanceof FormData) {
      body = undefined;
      delete headers['Content-Type']; // Let browser set multipart boundary
    } else {
      body = JSON.stringify(data);
    }
  }

  // Log request
  if (!opts.skipLogging) {
    logger.log({
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      requestId,
      requestHeaders: headers,
      requestBody: data,
      duration: 0,
    });
  }

  // Set loading state
  loadingManager.setLoading(endpoint, true);

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    // Make request with retry logic
    const response = await retryWithBackoff(async () => {
      const res = await fetch(fullUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!res.ok) {
        const errorData = await parseResponse(res).catch(() => ({}));
        throw new Error(errorData.message || standardizeError(null, res.status));
      }

      return res;
    }, opts.retries, opts.retryDelay);

    // Parse response
    const responseData = await parseResponse(response);
    const duration = Date.now() - startTime;

    // Log response
    if (!opts.skipLogging) {
      logger.log({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        requestId,
        responseStatus: response.status,
        responseBody: responseData,
        duration,
      });
    }

    // Return standardized response
    return {
      success: true,
      data: responseData,
      code: response.status,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = standardizeError(error);

    // Log error
    if (!opts.skipLogging) {
      logger.log({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        requestId,
        error: errorMessage,
        duration,
      });
    }

    // Handle specific error types
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout - please try again',
        code: 408,
      };
    }

    if (error.message?.includes('Failed to fetch')) {
      return {
        success: false,
        error: 'Network error - please check your connection',
        code: 0,
      };
    }

    return {
      success: false,
      error: errorMessage,
      code: error.status || 500,
    };

  } finally {
    // Clear loading state
    loadingManager.setLoading(endpoint, false);
  }
};

// Main API Service class
export class ApiService {
  // Cache-aware GET request
  static async getCached<T>(
    endpoint: string,
    cacheType: string,
    cacheKey: string,
    cacheParams?: Record<string, any>,
    options?: Omit<ApiOptions, 'cacheType' | 'cacheKey' | 'cacheParams'>
  ): Promise<ApiResponse<T>> {
    return makeCachedRequest<T>('GET', endpoint, undefined, {
      ...options,
      cacheType,
      cacheKey,
      cacheParams,
    });
  }

  // GET request
  static async get<T>(endpoint: string, options?: ApiOptions): Promise<ApiResponse<T>> {
    return makeRequest<T>('GET', endpoint, undefined, options);
  }

  // POST request
  static async post<T>(endpoint: string, data?: any, options?: ApiOptions): Promise<ApiResponse<T>> {
    const response = await makeRequest<T>('POST', endpoint, data, options);
    
    // Trigger cache invalidation based on endpoint
    if (response.success) {
      this.invalidateCacheForEndpoint(endpoint, data);
    }
    
    return response;
  }

  // PUT request
  static async put<T>(endpoint: string, data?: any, options?: ApiOptions): Promise<ApiResponse<T>> {
    const response = await makeRequest<T>('PUT', endpoint, data, options);
    
    // Trigger cache invalidation based on endpoint
    if (response.success) {
      this.invalidateCacheForEndpoint(endpoint, data);
    }
    
    return response;
  }

  // PATCH request
  static async patch<T>(endpoint: string, data?: any, options?: ApiOptions): Promise<ApiResponse<T>> {
    const response = await makeRequest<T>('PATCH', endpoint, data, options);
    
    // Trigger cache invalidation based on endpoint
    if (response.success) {
      this.invalidateCacheForEndpoint(endpoint, data);
    }
    
    return response;
  }

  // DELETE request
  static async delete<T>(endpoint: string, options?: ApiOptions): Promise<ApiResponse<T>> {
    const response = await makeRequest<T>('DELETE', endpoint, undefined, options);
    
    // Trigger cache invalidation based on endpoint
    if (response.success) {
      this.invalidateCacheForEndpoint(endpoint);
    }
    
    return response;
  }

  // Upload file
  static async upload<T>(endpoint: string, formData: FormData, options?: ApiOptions): Promise<ApiResponse<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const requestId = generateRequestId();
    const startTime = Date.now();
    const fullUrl = `${API_BASE}${endpoint}`;

    // Prepare headers (don't set Content-Type for FormData)
    const headers: Record<string, string> = {
      ...opts.headers,
    };

    // Add authentication header
    if (!opts.skipAuth) {
      try {
        const token = await authService.getIdToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn('Failed to get auth token:', error);
      }
    }

    const requestOptions: RequestInit = {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(opts.timeout),
    };

    try {
      loadingManager.setLoading(endpoint, true);
      const response = await retryWithBackoff(
        () => fetch(fullUrl, requestOptions),
        opts.retries,
        opts.retryDelay
      );

      const duration = Date.now() - startTime;
      const responseData = await parseResponse(response);

      if (response.ok) {
        // Trigger cache invalidation for uploads
        this.invalidateCacheForEndpoint(endpoint, { type: 'upload' });
        
        return {
          success: true,
          data: responseData,
          code: response.status,
        };
      }

      const errorMessage = standardizeError(responseData, response.status);
      return {
        success: false,
        error: errorMessage,
        code: response.status,
        message: responseData?.message || errorMessage,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = standardizeError(error);

      return {
        success: false,
        error: errorMessage,
      };

    } finally {
      loadingManager.setLoading(endpoint, false);
    }
  }

  // Smart cache invalidation based on endpoint
  private static invalidateCacheForEndpoint(endpoint: string, data?: any): void {
    const currentUser = authService.getCurrentUser();
    const userId = currentUser?.id;
    
    if (!userId) return;

    // User-related endpoints
    if (endpoint.startsWith('/users/')) {
      const userIdFromEndpoint = endpoint.split('/')[2];
      cacheInvalidationService.invalidateUserCache(userIdFromEndpoint || userId, 'update');
    }
    
    // Post-related endpoints
    else if (endpoint.startsWith('/posts/')) {
      const postId = endpoint.split('/')[2];
      if (postId && postId !== 'feed') {
        cacheInvalidationService.invalidatePostCache(postId, userId, 'update');
      } else {
        cacheInvalidationService.invalidatePostCache('feed', userId, 'update');
      }
    }
    
    // List-related endpoints
    else if (endpoint.startsWith('/lists/')) {
      const listId = endpoint.split('/')[2];
      if (listId) {
        cacheInvalidationService.invalidateListCache(listId, userId, 'update');
      }
    }
    
    // Friend-related endpoints
    else if (endpoint.startsWith('/friends/')) {
      const friendId = data?.friendId || endpoint.split('/')[2];
      if (friendId) {
        cacheInvalidationService.invalidateFriendCache(userId, friendId, 'update');
      }
    }
    
    // Privacy-related endpoints
    else if (endpoint.includes('/privacy')) {
      cacheInvalidationService.invalidatePrivacyCache(userId, 'update');
    }
    
    // Notification-related endpoints
    else if (endpoint.startsWith('/notifications/')) {
      const notificationId = endpoint.split('/')[2];
      cacheInvalidationService.invalidateNotificationCache(userId, notificationId, 'update');
    }
    
    // Hashtag-related endpoints
    else if (endpoint.startsWith('/hashtags/')) {
      const hashtagId = endpoint.split('/')[2];
      if (hashtagId) {
        cacheInvalidationService.invalidateHashtagCache(hashtagId, 'update');
      }
    }
  }

  // Get loading state for an endpoint
  static isLoading(endpoint: string): boolean {
    return loadingManager.isLoading(endpoint);
  }

  // Subscribe to loading state changes
  static onLoadingChange(listener: (endpoint: string, loading: boolean) => void): () => void {
    loadingManager.addListener(listener);
    return () => loadingManager.removeListener(listener);
  }

  // Get API logs
  static getLogs(): LogEntry[] {
    return logger.getLogs();
  }

  // Clear API logs
  static clearLogs(): void {
    logger.clearLogs();
  }

  // Health check
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health', { skipAuth: true, skipLogging: true });
      return response.success;
    } catch {
      return false;
    }
  }

  // Cache management methods
  static getCacheStats() {
    return cacheService.getStats();
  }

  static clearCache() {
    cacheService.clear();
  }

  static async warmUserCache(userId: string) {
    await cacheInvalidationService.warmCriticalCache(userId);
  }
}

// Convenience functions for common operations
export const api = {
  // User operations
  users: {
    getCurrent: () => ApiService.get('/user'),
    getProfile: (userId: string) => ApiService.get(`/users/${userId}`),
    updateProfile: (data: any) => ApiService.put('/user', data),
    uploadAvatar: (formData: FormData) => ApiService.upload('/upload-profile-picture', formData),
  },

  // Post operations
  posts: {
    getAll: () => ApiService.get('/posts'),
    getById: (postId: string) => ApiService.get(`/posts/${postId}`),
    create: (data: any) => ApiService.post('/posts', data),
    update: (postId: string, data: any) => ApiService.put(`/posts/${postId}`, data),
    delete: (postId: string) => ApiService.delete(`/posts/${postId}`),
    like: (postId: string) => ApiService.post(`/posts/${postId}/like`),
    unlike: (postId: string) => ApiService.delete(`/posts/${postId}/like`),
    share: (postId: string) => ApiService.post(`/posts/${postId}/share`),
    save: (postId: string) => ApiService.post(`/posts/${postId}/save`),
    unsave: (postId: string) => ApiService.delete(`/posts/${postId}/save`),
    flag: (postId: string, data: any) => ApiService.post(`/posts/${postId}/flag`, data),
    view: (postId: string) => ApiService.post(`/posts/${postId}/view`),
  },

  // List operations
  lists: {
    getAll: () => ApiService.get('/lists'),
    getById: (listId: string) => ApiService.get(`/lists/${listId}`),
    create: (data: any) => ApiService.post('/lists', data),
    update: (listId: string, data: any) => ApiService.put(`/lists/${listId}`, data),
    delete: (listId: string) => ApiService.delete(`/lists/${listId}`),
    getUserLists: (userId: string) => ApiService.get(`/lists/user/${userId}`),
  },

  // Connection operations
  connections: {
    getAll: () => ApiService.get('/connections'),
    getRequests: () => ApiService.get('/friend-requests'),
    sendRequest: (userId: string) => ApiService.post('/friends/request', { userId }),
    acceptRequest: (requestId: string) => ApiService.post(`/friends/request/${requestId}/accept`),
    rejectRequest: (requestId: string) => ApiService.post(`/friends/request/${requestId}/reject`),
    remove: (userId: string) => ApiService.delete(`/friends/${userId}`),
  },

  // Hashtag operations
  hashtags: {
    getTrending: () => ApiService.get('/hashtags/trending'),
    getFollowed: () => ApiService.get('/hashtags/followed'),
    follow: (hashtagId: string) => ApiService.post(`/hashtags/${hashtagId}/follow`),
    unfollow: (hashtagId: string) => ApiService.delete(`/hashtags/${hashtagId}/follow`),
    following: (hashtagId: string) => ApiService.get(`/hashtags/${hashtagId}/following`),
    search: (query: string) => ApiService.get(`/search/hashtags?q=${encodeURIComponent(query)}`),
  },

  // Comment operations
  comments: {
    getByPost: (postId: string) => ApiService.get(`/posts/${postId}/comments`),
    create: (postId: string, data: any) => ApiService.post(`/posts/${postId}/comments`, data),
    delete: (commentId: string) => ApiService.delete(`/comments/${commentId}`),
  },

  // Event operations
  events: {
    rsvp: (eventId: string, status: string) => ApiService.post(`/posts/${eventId}/rsvp`, { status }),
    getRsvpStats: (eventId: string) => ApiService.get(`/posts/${eventId}/rsvp/stats`),
    getRsvpList: (eventId: string, status?: string) => ApiService.get(`/posts/${eventId}/rsvp/list${status ? `?status=${status}` : ''}`),
  },

  // Notification operations
  notifications: {
    getAll: () => ApiService.get('/notifications'),
    getUnreadCount: () => ApiService.get('/notifications/unread-count'),
    markAsRead: (notificationId: string) => ApiService.put(`/notifications/${notificationId}/read`),
  },

  // Search operations
  search: {
    posts: (query: string) => ApiService.get(`/search/posts?q=${encodeURIComponent(query)}`),
    users: (query: string) => ApiService.get(`/search/users?q=${encodeURIComponent(query)}`),
    hashtags: (query: string) => ApiService.get(`/search/hashtags?q=${encodeURIComponent(query)}`),
  },

  // Admin operations (with separate auth)
  admin: {
    login: (credentials: any) => ApiService.post('/admin/login', credentials, { skipAuth: true }),
    getMetrics: () => ApiService.get('/admin/metrics'),
    getUsers: (params?: any) => ApiService.get('/admin/users', { headers: { 'Admin-Session': 'true' } }),
    moderateContent: (itemId: string, action: string, reason: string) => 
      ApiService.post(`/admin/review-queue/${itemId}`, { action, reason }, { headers: { 'Admin-Session': 'true' } }),
  },
};

// Export types for use in components
export type { LogEntry };
