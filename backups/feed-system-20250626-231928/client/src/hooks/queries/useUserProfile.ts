import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from '@/lib/api-service';
import { User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { cacheInvalidationService } from '@/lib/cache-invalidation';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
  defaultPrivacy?: string;
}

export interface UserProfileResponse {
  success: boolean;
  data?: UserProfile;
  error?: string;
  code?: number;
}

// Query keys
export const userKeys = {
  all: ['users'] as const,
  profile: (userId: string) => [...userKeys.all, 'profile', userId] as const,
  privacy: (userId: string) => [...userKeys.all, 'privacy', userId] as const,
  posts: (userId: string) => [...userKeys.all, 'posts', userId] as const,
  lists: (userId: string) => [...userKeys.all, 'lists', userId] as const,
  friends: (userId: string) => [...userKeys.all, 'friends', userId] as const,
};

// Fetch user profile with caching
const fetchUserProfile = async (userId: string): Promise<User> => {
  const response = await ApiService.getCached<User>(
    `/users/${userId}`,
    'userProfile',
    userId
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch user profile');
  }

  return response.data;
};

// Fetch user privacy settings with caching
const fetchUserPrivacy = async (userId: string): Promise<any> => {
  const response = await ApiService.getCached<any>(
    `/users/${userId}/privacy`,
    'privacySettings',
    userId
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch privacy settings');
  }

  return response.data;
};

// Fetch user posts with caching
const fetchUserPosts = async (userId: string, page: number = 1): Promise<any> => {
  const response = await ApiService.getCached<any>(
    `/users/${userId}/posts?page=${page}`,
    'userPosts',
    userId,
    { page }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch user posts');
  }

  return response.data;
};

// Fetch user lists with caching
const fetchUserLists = async (userId: string): Promise<any> => {
  const response = await ApiService.getCached<any>(
    `/users/${userId}/lists`,
    'userLists',
    userId
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch user lists');
  }

  return response.data;
};

// Fetch user friends with caching
const fetchUserFriends = async (userId: string): Promise<any> => {
  const response = await ApiService.getCached<any>(
    `/users/${userId}/friends`,
    'friendList',
    userId
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch user friends');
  }

  return response.data;
};

// Update user profile
const updateUserProfile = async ({ userId, data }: { userId: string; data: Partial<User> }): Promise<User> => {
  const response = await ApiService.put<User>(`/users/${userId}`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update user profile');
  }

  return response.data;
};

// Update user privacy settings
const updateUserPrivacy = async ({ userId, data }: { userId: string; data: any }): Promise<any> => {
  const response = await ApiService.put<any>(`/users/${userId}/privacy`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update privacy settings');
  }

  return response.data;
};

// Upload profile picture
const uploadProfilePicture = async ({ userId, file }: { userId: string; file: File }): Promise<any> => {
  const formData = new FormData();
  formData.append('profilePicture', file);

  const response = await ApiService.upload<any>(`/users/${userId}/profile-picture`, formData);

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to upload profile picture');
  }

  return response.data;
};

// Hooks
export const useUserProfile = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: () => fetchUserProfile(userId),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
};

export const useUserPrivacy = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.privacy(userId),
    queryFn: () => fetchUserPrivacy(userId),
    enabled: enabled && !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

export const useUserPosts = (userId: string, page: number = 1, enabled: boolean = true) => {
  return useQuery({
    queryKey: [...userKeys.posts(userId), page],
    queryFn: () => fetchUserPosts(userId, page),
    enabled: enabled && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUserLists = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.lists(userId),
    queryFn: () => fetchUserLists(userId),
    enabled: enabled && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  });
};

export const useUserFriends = (userId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: userKeys.friends(userId),
    queryFn: () => fetchUserFriends(userId),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutations
export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data, { userId }) => {
      // Update cache
      queryClient.setQueryData(userKeys.profile(userId), data);
      
      // Invalidate related caches
      cacheInvalidationService.invalidateUserCache(userId, 'update');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateUserPrivacy = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updateUserPrivacy,
    onSuccess: (data, { userId }) => {
      // Update cache
      queryClient.setQueryData(userKeys.privacy(userId), data);
      
      // Invalidate privacy-related caches
      cacheInvalidationService.invalidatePrivacyCache(userId, 'update');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      
      toast({
        title: 'Privacy Updated',
        description: 'Your privacy settings have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update privacy settings',
        variant: 'destructive',
      });
    },
  });
};

export const useUploadProfilePicture = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: uploadProfilePicture,
    onSuccess: (data, { userId }) => {
      // Update user profile cache with new picture URL
      queryClient.setQueryData(userKeys.profile(userId), (old: User | undefined) => {
        if (!old) return old;
        return { ...old, profilePictureUrl: data.profilePictureUrl };
      });
      
      // Invalidate user cache
      cacheInvalidationService.invalidateUserCache(userId, 'update');
      
      toast({
        title: 'Picture Uploaded',
        description: 'Your profile picture has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload profile picture',
        variant: 'destructive',
      });
    },
  });
};

// Prefetch user data for better UX
export const usePrefetchUserData = () => {
  const queryClient = useQueryClient();

  return (userId: string) => {
    // Prefetch user profile
    queryClient.prefetchQuery({
      queryKey: userKeys.profile(userId),
      queryFn: () => fetchUserProfile(userId),
      staleTime: 5 * 60 * 1000,
    });

    // Prefetch user privacy settings
    queryClient.prefetchQuery({
      queryKey: userKeys.privacy(userId),
      queryFn: () => fetchUserPrivacy(userId),
      staleTime: 30 * 60 * 1000,
    });

    // Prefetch user lists
    queryClient.prefetchQuery({
      queryKey: userKeys.lists(userId),
      queryFn: () => fetchUserLists(userId),
      staleTime: 10 * 60 * 1000,
    });

    // Prefetch user friends
    queryClient.prefetchQuery({
      queryKey: userKeys.friends(userId),
      queryFn: () => fetchUserFriends(userId),
      staleTime: 5 * 60 * 1000,
    });
  };
};
