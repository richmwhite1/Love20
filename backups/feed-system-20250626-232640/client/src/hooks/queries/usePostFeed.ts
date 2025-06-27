import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface Post {
  id: string;
  userId: string;
  primaryPhotoUrl?: string;
  primaryLink?: string;
  linkLabel?: string;
  primaryDescription: string;
  discountCode?: string;
  additionalPhotos?: string[];
  additionalPhotoData?: any[];
  listId?: string;
  spotifyUrl?: string;
  spotifyLabel?: string;
  youtubeUrl?: string;
  youtubeLabel?: string;
  hashtags?: string[];
  privacy: 'public' | 'connections' | 'private';
  taggedUsers?: string[];
  isEvent?: boolean;
  eventDate?: string;
  reminders?: string[];
  isRecurring?: boolean;
  recurringType?: string;
  taskList?: any[];
  attachedLists?: string[];
  allowRsvp?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
  stats?: {
    likes: number;
    shares: number;
    views: number;
    comments: number;
  };
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface PostFeedResponse {
  success: boolean;
  data?: Post[];
  error?: string;
  code?: number;
}

export interface PostResponse {
  success: boolean;
  data?: Post;
  error?: string;
  code?: number;
}

export interface PostFilters {
  privacy?: string;
  userId?: string;
  listId?: string;
  hashtags?: string[];
  isEvent?: boolean;
}

export interface PostPagination {
  page?: number;
  limit?: number;
  offset?: number;
}

// Query key factory
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filters: PostFilters) => [...postKeys.lists(), filters] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (postId: string) => [...postKeys.details(), postId] as const,
  user: (userId: string) => [...postKeys.all, 'user', userId] as const,
  feed: (filters: PostFilters) => [...postKeys.all, 'feed', filters] as const,
};

// Fetch posts with filters
const fetchPosts = async (filters: PostFilters = {}, pagination: PostPagination = {}): Promise<PostFeedResponse> => {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, String(value));
      }
    }
  });
  
  Object.entries(pagination).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });
  
  const url = `/api/posts${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await apiRequest('GET', url);
  return response.json();
};

// Fetch single post
const fetchPost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('GET', `/api/posts/${postId}`);
  return response.json();
};

// Fetch user posts
const fetchUserPosts = async (userId: string): Promise<PostFeedResponse> => {
  const response = await apiRequest('GET', `/api/posts/user`);
  return response.json();
};

// Like post
const likePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('POST', `/api/posts/${postId}/like`);
  return response.json();
};

// Unlike post
const unlikePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('DELETE', `/api/posts/${postId}/like`);
  return response.json();
};

// Save post
const savePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('POST', `/api/posts/${postId}/save`);
  return response.json();
};

// Unsave post
const unsavePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('DELETE', `/api/posts/${postId}/save`);
  return response.json();
};

// Share post
const sharePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('POST', `/api/posts/${postId}/share`);
  return response.json();
};

// View post
const viewPost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('POST', `/api/posts/${postId}/view`);
  return response.json();
};

// Delete post
const deletePost = async (postId: string): Promise<PostResponse> => {
  const response = await apiRequest('DELETE', `/api/posts/${postId}`);
  return response.json();
};

// Hook for fetching posts with infinite scroll
export const usePostFeed = (filters: PostFilters = {}) => {
  return useInfiniteQuery({
    queryKey: postKeys.feed(filters),
    queryFn: ({ pageParam = 1 }) => fetchPosts(filters, { page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.success || !lastPage.data || lastPage.data.length < 20) {
        return undefined;
      }
      return allPages.length + 1;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching posts (paginated)
export const usePosts = (filters: PostFilters = {}, pagination: PostPagination = {}) => {
  return useQuery({
    queryKey: postKeys.list(filters),
    queryFn: () => fetchPosts(filters, pagination),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching single post
export const usePost = (postId: string) => {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => fetchPost(postId),
    enabled: !!postId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for fetching user posts
export const useUserPosts = (userId: string) => {
  return useQuery({
    queryKey: postKeys.user(userId),
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for liking/unliking posts with optimistic updates
export const useLikePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: likePost,
    onMutate: async (postId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      
      // Snapshot the previous value
      const previousPost = queryClient.getQueryData(postKeys.detail(postId));
      
      // Optimistically update the post
      queryClient.setQueryData(postKeys.detail(postId), (old: PostResponse | undefined) => {
        if (!old?.success || !old.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            isLiked: true,
            stats: {
              ...old.data.stats,
              likes: (old.data.stats?.likes || 0) + 1,
            },
          },
        };
      });
      
      // Also update in feed queries
      queryClient.setQueriesData(
        { queryKey: postKeys.all },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data?.map((post: Post) =>
                post.id === postId
                  ? {
                      ...post,
                      isLiked: true,
                      stats: {
                        ...post.stats,
                        likes: (post.stats?.likes || 0) + 1,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );
      
      return { previousPost };
    },
    onError: (err, postId, context) => {
      // Rollback on error
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      toast({
        title: "Like Failed",
        description: "Failed to like post. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (data, error, postId) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
};

// Hook for unliking posts with optimistic updates
export const useUnlikePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unlikePost,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      
      const previousPost = queryClient.getQueryData(postKeys.detail(postId));
      
      queryClient.setQueryData(postKeys.detail(postId), (old: PostResponse | undefined) => {
        if (!old?.success || !old.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            isLiked: false,
            stats: {
              ...old.data.stats,
              likes: Math.max(0, (old.data.stats?.likes || 0) - 1),
            },
          },
        };
      });
      
      queryClient.setQueriesData(
        { queryKey: postKeys.all },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data?.map((post: Post) =>
                post.id === postId
                  ? {
                      ...post,
                      isLiked: false,
                      stats: {
                        ...post.stats,
                        likes: Math.max(0, (post.stats?.likes || 0) - 1),
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );
      
      return { previousPost };
    },
    onError: (err, postId, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      toast({
        title: "Unlike Failed",
        description: "Failed to unlike post. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (data, error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
};

// Hook for saving/unsaving posts
export const useSavePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: savePost,
    onSuccess: (data, postId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
        queryClient.invalidateQueries({ queryKey: postKeys.all });
        toast({
          title: "Post Saved",
          description: "Post has been saved to your collection.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Failed to save post. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUnsavePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unsavePost,
    onSuccess: (data, postId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
        queryClient.invalidateQueries({ queryKey: postKeys.all });
        toast({
          title: "Post Unsaved",
          description: "Post has been removed from your collection.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Unsave Failed",
        description: "Failed to unsave post. Please try again.",
        variant: "destructive",
      });
    },
  });
};

// Hook for sharing posts
export const useSharePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sharePost,
    onSuccess: (data, postId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
        queryClient.invalidateQueries({ queryKey: postKeys.all });
        toast({
          title: "Post Shared",
          description: "Post has been shared successfully.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Share Failed",
        description: "Failed to share post. Please try again.",
        variant: "destructive",
      });
    },
  });
};

// Hook for viewing posts
export const useViewPost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: viewPost,
    onSuccess: (data, postId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      }
    },
  });
};

// Hook for deleting posts
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePost,
    onSuccess: (data, postId) => {
      if (data.success) {
        // Remove from all queries
        queryClient.removeQueries({ queryKey: postKeys.detail(postId) });
        queryClient.invalidateQueries({ queryKey: postKeys.all });
        toast({
          title: "Post Deleted",
          description: "Post has been deleted successfully.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });
};
