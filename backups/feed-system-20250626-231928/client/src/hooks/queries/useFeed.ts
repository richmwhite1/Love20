import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { ApiService } from '../../lib/api-service';
import { FeedTypeEnum, FeedResponse, UserFeedPreference } from '../../../shared/feed-schema';

// Hook for getting user feed preferences
export const useFeedPreferences = () => {
  return useQuery({
    queryKey: ['feed-preferences'],
    queryFn: () => ApiService.get('/feed/preferences'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime)
  });
};

// Hook for updating feed preferences
export const useUpdateFeedPreferences = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferences: Partial<UserFeedPreference>) =>
      ApiService.put('/feed/preferences', preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-preferences'] });
    },
  });
};

// Hook for infinite feed with cursor-based pagination
export const useInfiniteFeed = (feedType: FeedTypeEnum, pageSize: number = 20) => {
  return useInfiniteQuery({
    queryKey: ['feed', feedType],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      ApiService.get(`/feed/${feedType}`, {
        params: {
          cursor: pageParam,
          pageSize,
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => {
      if (lastPage.success && lastPage.data?.nextCursor) {
        return lastPage.data.nextCursor;
      }
      return undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (replaces cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

// Hook for single page feed (for mobile optimization)
export const useFeed = (feedType: FeedTypeEnum, pageSize: number = 20, cursor?: string) => {
  return useQuery({
    queryKey: ['feed', feedType, cursor],
    queryFn: () =>
      ApiService.get(`/feed/${feedType}`, {
        params: {
          cursor,
          pageSize,
        },
      }),
    enabled: !!feedType,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (replaces cacheTime)
    refetchOnWindowFocus: false,
  });
};

// Hook for generating feed
export const useGenerateFeed = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ feedType, postId }: { feedType: FeedTypeEnum; postId?: string }) =>
      ApiService.post('/feed/generate', { feedType, postId }),
    onSuccess: (_, { feedType }) => {
      // Invalidate the specific feed type
      queryClient.invalidateQueries({ queryKey: ['feed', feedType] });
    },
  });
};

// Hook for creating feed generation jobs
export const useCreateFeedJob = () => {
  return useMutation({
    mutationFn: (jobData: {
      feedType: FeedTypeEnum;
      postId?: string;
      affectedUserIds?: string[];
      priority?: number;
    }) => ApiService.post('/feed/jobs', jobData),
  });
};

// Hook for processing feed jobs (admin only)
export const useProcessFeedJobs = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => ApiService.post('/feed/jobs/process'),
    onSuccess: () => {
      // Invalidate all feed queries
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
};

// Hook for feed cleanup (admin only)
export const useCleanupFeed = () => {
  return useMutation({
    mutationFn: () => ApiService.post('/feed/cleanup'),
  });
};

// Hook for real-time feed updates
export const useFeedUpdates = (
  userId: string,
  feedType: FeedTypeEnum,
  onUpdate: (updates: any[]) => void
) => {
  const queryClient = useQueryClient();
  
  // Set up real-time listener
  React.useEffect(() => {
    if (!userId || !feedType) return;
    
    // Note: This would need to be implemented in the ApiService
    // For now, we'll use a placeholder
    const unsubscribe = () => {
      // Placeholder for real-time subscription
    };
    
    return unsubscribe;
  }, [userId, feedType, queryClient, onUpdate]);
};

// Hook for feed analytics
export const useFeedAnalytics = (userId: string, feedType: FeedTypeEnum, date: Date) => {
  return useQuery({
    queryKey: ['feed-analytics', userId, feedType, date.toISOString().split('T')[0]],
    queryFn: () =>
      ApiService.get('/feed/analytics', {
        params: {
          userId,
          feedType,
          date: date.toISOString().split('T')[0],
        },
      }),
    enabled: !!userId && !!feedType,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for feed performance monitoring
export const useFeedPerformance = (feedType: FeedTypeEnum) => {
  const [performance, setPerformance] = React.useState<{
    loadTime: number;
    cacheHit: boolean;
    totalPosts: number;
  }>({
    loadTime: 0,
    cacheHit: false,
    totalPosts: 0,
  });
  
  const updatePerformance = React.useCallback((metrics: any) => {
    setPerformance(metrics);
  }, []);
  
  return { performance, updatePerformance };
};

// Hook for mobile-optimized feed with virtual scrolling
export const useVirtualFeed = (feedType: FeedTypeEnum, pageSize: number = 10) => {
  const [virtualItems, setVirtualItems] = React.useState<any[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [cursor, setCursor] = React.useState<string | undefined>();
  
  const { data, isLoading, error, refetch } = useFeed(feedType, pageSize, cursor);
  
  React.useEffect(() => {
    if (data?.success && data.data) {
      const newPosts = data.data.posts || [];
      setVirtualItems(prev => [...prev, ...newPosts]);
      setHasMore(data.data.hasMore);
      setCursor(data.data.nextCursor);
    }
  }, [data]);
  
  const loadMore = React.useCallback(() => {
    if (hasMore && !isLoading && cursor) {
      refetch();
    }
  }, [hasMore, isLoading, cursor, refetch]);
  
  const reset = React.useCallback(() => {
    setVirtualItems([]);
    setHasMore(true);
    setCursor(undefined);
  }, []);
  
  return {
    posts: virtualItems,
    isLoading,
    error,
    hasMore,
    loadMore,
    reset,
  };
};

// Hook for feed customization
export const useFeedCustomization = () => {
  const { data: preferences } = useFeedPreferences();
  const updatePreferences = useUpdateFeedPreferences();
  
  const availableFeedTypes = React.useMemo(() => {
    if (!preferences?.success) return [FeedTypeEnum.CHRONOLOGICAL];
    
    const prefs = preferences.data;
    const types = [];
    
    if (prefs.chronologicalEnabled) types.push(FeedTypeEnum.CHRONOLOGICAL);
    if (prefs.algorithmicEnabled) types.push(FeedTypeEnum.ALGORITHMIC);
    if (prefs.friendsEnabled) types.push(FeedTypeEnum.FRIENDS);
    if (prefs.trendingEnabled) types.push(FeedTypeEnum.TRENDING);
    
    return types;
  }, [preferences]);
  
  const defaultFeedType = preferences?.success 
    ? preferences.data.defaultFeedType 
    : FeedTypeEnum.CHRONOLOGICAL;
  
  return {
    preferences: preferences?.success ? preferences.data : null,
    availableFeedTypes,
    defaultFeedType,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
};

// Hook for feed caching and optimization
export const useFeedOptimization = (feedType: FeedTypeEnum) => {
  const queryClient = useQueryClient();
  
  const prefetchFeed = React.useCallback((cursor?: string) => {
    queryClient.prefetchQuery({
      queryKey: ['feed', feedType, cursor],
      queryFn: () =>
        ApiService.get(`/feed/${feedType}`, {
          params: { cursor, pageSize: 20 },
        }),
      staleTime: 2 * 60 * 1000,
    });
  }, [feedType, queryClient]);
  
  const warmCache = React.useCallback(() => {
    // Prefetch first few pages
    prefetchFeed();
    prefetchFeed('next-cursor-placeholder');
  }, [prefetchFeed]);
  
  const clearCache = React.useCallback(() => {
    queryClient.removeQueries({ queryKey: ['feed', feedType] });
  }, [feedType, queryClient]);
  
  return {
    prefetchFeed,
    warmCache,
    clearCache,
  };
}; 