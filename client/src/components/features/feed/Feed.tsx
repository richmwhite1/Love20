import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FeedTypeEnum } from '../../../../shared/feed-schema';
import { ApiService } from '../../../lib/api-service';
import { PostCard } from '../posts/PostCard';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Skeleton } from '../../ui/skeleton';
import { useToast } from '../../../hooks/use-toast';
import { useAuth } from '../../../lib/auth';
import { Loader2, RefreshCw, TrendingUp, Clock, Users, Sparkles } from 'lucide-react';

interface FeedProps {
  initialFeedType?: FeedTypeEnum;
  pageSize?: number;
  showFeedSelector?: boolean;
  className?: string;
  onRefresh?: () => void;
}

export const Feed: React.FC<FeedProps> = ({
  initialFeedType = FeedTypeEnum.CHRONOLOGICAL,
  pageSize = 20,
  showFeedSelector = true,
  className = '',
  onRefresh,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentFeedType, setCurrentFeedType] = useState<FeedTypeEnum>(initialFeedType);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Feed data query with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', currentFeedType],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const response = await ApiService.get(`/feed/${currentFeedType}`, {
        headers: {
          'X-Page-Size': pageSize.toString(),
          ...(pageParam && { 'X-Cursor': pageParam }),
        },
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load feed');
      }
      
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.success && lastPage.data?.nextCursor) {
        return lastPage.data.nextCursor;
      }
      return undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Intersection observer for infinite scrolling
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    
    if (node) {
      observerRef.current.observe(node);
    }
  }, [isLoading, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle feed type change
  const handleFeedTypeChange = useCallback((newFeedType: FeedTypeEnum) => {
    setCurrentFeedType(newFeedType);
    toast({
      title: 'Feed Updated',
      description: `Switched to ${newFeedType} feed`,
    });
  }, [toast]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      onRefresh?.();
      toast({
        title: 'Feed Refreshed',
        description: 'Your feed has been updated',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh feed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, onRefresh, toast]);

  // Auto-refresh on focus (mobile optimization)
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [refetch]);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: 'Feed Error',
        description: error instanceof Error ? error.message : 'Failed to load feed',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Flatten all posts from all pages
  const allPosts = data?.pages?.flatMap(page => 
    page.success ? page.data?.posts || [] : []
  ) || [];

  // Feed type options
  const feedTypeOptions = [
    { value: FeedTypeEnum.CHRONOLOGICAL, label: 'Latest', icon: Clock },
    { value: FeedTypeEnum.ALGORITHMIC, label: 'For You', icon: Sparkles },
    { value: FeedTypeEnum.FRIENDS, label: 'Friends', icon: Users },
    { value: FeedTypeEnum.TRENDING, label: 'Trending', icon: TrendingUp },
  ];

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
        <Clock className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
      <p className="text-muted-foreground mb-4">
        {currentFeedType === FeedTypeEnum.FRIENDS 
          ? 'Follow some friends to see their posts here'
          : 'Be the first to share something amazing!'}
      </p>
      <Button onClick={handleRefresh} disabled={isRefreshing}>
        {isRefreshing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showFeedSelector && (
            <Select value={currentFeedType} onValueChange={handleFeedTypeChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {feedTypeOptions.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Performance indicator */}
        {data?.pages?.[0]?.data?.loadTime && (
          <div className="text-sm text-muted-foreground">
            Loaded in {data.pages[0].data.loadTime}ms
            {data.pages[0].data.cacheHit && (
              <span className="ml-2 text-green-600">💾 Cached</span>
            )}
          </div>
        )}
      </div>

      {/* Feed Content */}
      <div className="space-y-4">
        {isLoading ? (
          <LoadingSkeleton />
        ) : allPosts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Posts */}
            {allPosts.map((post, index) => (
              <div
                key={`${post.id}-${index}`}
                ref={index === allPosts.length - 1 ? lastElementRef : undefined}
              >
                <PostCard
                  post={post}
                  showActions={true}
                  showUserInfo={true}
                  className="transition-all duration-200 hover:shadow-md"
                />
              </div>
            ))}

            {/* Load more indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading more posts...</span>
                </div>
              </div>
            )}

            {/* End of feed */}
            {!hasNextPage && allPosts.length > 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">You're all caught up!</h3>
                <p className="text-muted-foreground">
                  Check back later for more amazing content.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile optimization: Pull to refresh indicator */}
      <div ref={loadMoreRef} className="h-1" />
    </div>
  );
};

// Mobile-optimized feed component
export const MobileFeed: React.FC<FeedProps> = (props) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef<number>(0);
  const currentY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - touchStartY.current;
    
    if (distance > 0 && window.scrollY === 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance * 0.5, 100));
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullDistance > 50) {
      // Trigger refresh
      props.onRefresh?.();
    }
    setIsPulling(false);
    setPullDistance(0);
  };

  return (
    <div
      className="min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {isPulling && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center bg-background/80 backdrop-blur-sm"
          style={{ height: `${pullDistance}px` }}
        >
          <div className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Pull to refresh...</span>
          </div>
        </div>
      )}

      <Feed {...props} />
    </div>
  );
};

// Virtual scrolling feed for very large feeds
export const VirtualFeed: React.FC<FeedProps> = ({ pageSize = 10, ...props }) => {
  const [virtualItems, setVirtualItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['virtual-feed', props.initialFeedType, cursor],
    queryFn: async () => {
      const response = await ApiService.get(`/feed/${props.initialFeedType}`, {
        headers: {
          'X-Page-Size': pageSize.toString(),
          ...(cursor && { 'X-Cursor': cursor }),
        },
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load feed');
      }
      
      return response;
    },
    enabled: !!props.initialFeedType,
  });

  useEffect(() => {
    if (data?.success && data.data) {
      const newPosts = data.data.posts || [];
      setVirtualItems(prev => [...prev, ...newPosts]);
      setHasMore(data.data.hasMore);
      setCursor(data.data.nextCursor);
    }
  }, [data]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && cursor) {
      refetch();
    }
  }, [hasMore, isLoading, cursor, refetch]);

  return (
    <div className="space-y-4">
      {virtualItems.map((post, index) => (
        <PostCard
          key={`${post.id}-${index}`}
          post={post}
          showActions={true}
          showUserInfo={true}
        />
      ))}
      
      {hasMore && (
        <Button
          onClick={loadMore}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            'Load More'
          )}
        </Button>
      )}
    </div>
  );
}; 