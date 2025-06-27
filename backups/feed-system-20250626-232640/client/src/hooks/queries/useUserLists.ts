import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface List {
  id: string;
  userId: string;
  name: string;
  description?: string;
  privacyLevel: 'public' | 'connections' | 'private';
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
  postCount?: number;
  collaboratorCount?: number;
}

export interface ListResponse {
  success: boolean;
  data?: List;
  error?: string;
  code?: number;
}

export interface ListsResponse {
  success: boolean;
  data?: List[];
  error?: string;
  code?: number;
}

export interface CreateListData {
  name: string;
  description?: string;
  privacyLevel: 'public' | 'connections' | 'private';
}

export interface UpdateListData {
  name?: string;
  description?: string;
  privacyLevel?: 'public' | 'connections' | 'private';
}

// Query key factory
export const listKeys = {
  all: ['lists'] as const,
  lists: () => [...listKeys.all, 'list'] as const,
  list: (filters: any) => [...listKeys.lists(), filters] as const,
  details: () => [...listKeys.all, 'detail'] as const,
  detail: (listId: string) => [...listKeys.details(), listId] as const,
  user: (userId: string) => [...listKeys.all, 'user', userId] as const,
  my: () => [...listKeys.all, 'my'] as const,
};

// Fetch all lists (with privacy filtering)
const fetchLists = async (): Promise<ListsResponse> => {
  const response = await apiRequest('GET', '/api/lists');
  return response.json();
};

// Fetch user's own lists
const fetchMyLists = async (): Promise<ListsResponse> => {
  const response = await apiRequest('GET', '/api/lists/my');
  return response.json();
};

// Fetch lists by user
const fetchUserLists = async (userId: string): Promise<ListsResponse> => {
  const response = await apiRequest('GET', `/api/lists/user/${userId}`);
  return response.json();
};

// Fetch single list
const fetchList = async (listId: string): Promise<ListResponse> => {
  const response = await apiRequest('GET', `/api/lists/${listId}`);
  return response.json();
};

// Create list
const createList = async (data: CreateListData): Promise<ListResponse> => {
  const response = await apiRequest('POST', '/api/lists', data);
  return response.json();
};

// Update list
const updateList = async (listId: string, data: UpdateListData): Promise<ListResponse> => {
  const response = await apiRequest('PUT', `/api/lists/${listId}`, data);
  return response.json();
};

// Update list privacy
const updateListPrivacy = async (listId: string, privacyLevel: string): Promise<ListResponse> => {
  const response = await apiRequest('PUT', `/api/lists/${listId}/privacy`, { privacyLevel });
  return response.json();
};

// Delete list
const deleteList = async (listId: string): Promise<ListResponse> => {
  const response = await apiRequest('DELETE', `/api/lists/${listId}`);
  return response.json();
};

// Hook for fetching all lists
export const useLists = () => {
  return useQuery({
    queryKey: listKeys.lists(),
    queryFn: fetchLists,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching user's own lists
export const useMyLists = () => {
  return useQuery({
    queryKey: listKeys.my(),
    queryFn: fetchMyLists,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for fetching lists by user
export const useUserLists = (userId: string) => {
  return useQuery({
    queryKey: listKeys.user(userId),
    queryFn: () => fetchUserLists(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching single list
export const useList = (listId: string) => {
  return useQuery({
    queryKey: listKeys.detail(listId),
    queryFn: () => fetchList(listId),
    enabled: !!listId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for creating list
export const useCreateList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createList,
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate and refetch lists
        queryClient.invalidateQueries({ queryKey: listKeys.my() });
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
        toast({
          title: "List Created",
          description: "Your list has been created successfully.",
        });
      } else {
        toast({
          title: "Creation Failed",
          description: data.error || "Failed to create list.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create list.",
        variant: "destructive",
      });
    },
  });
};

// Hook for updating list
export const useUpdateList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: UpdateListData }) =>
      updateList(listId, data),
    onSuccess: (data, { listId }) => {
      if (data.success) {
        // Invalidate and refetch specific list and lists
        queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
        queryClient.invalidateQueries({ queryKey: listKeys.my() });
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
        toast({
          title: "List Updated",
          description: "Your list has been updated successfully.",
        });
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update list.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update list.",
        variant: "destructive",
      });
    },
  });
};

// Hook for updating list privacy
export const useUpdateListPrivacy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ listId, privacyLevel }: { listId: string; privacyLevel: string }) =>
      updateListPrivacy(listId, privacyLevel),
    onSuccess: (data, { listId }) => {
      if (data.success) {
        // Invalidate and refetch specific list and lists
        queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
        queryClient.invalidateQueries({ queryKey: listKeys.my() });
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
        toast({
          title: "Privacy Updated",
          description: "List privacy has been updated successfully.",
        });
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update list privacy.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update list privacy.",
        variant: "destructive",
      });
    },
  });
};

// Hook for deleting list
export const useDeleteList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteList,
    onSuccess: (data, listId) => {
      if (data.success) {
        // Remove from cache and invalidate queries
        queryClient.removeQueries({ queryKey: listKeys.detail(listId) });
        queryClient.invalidateQueries({ queryKey: listKeys.my() });
        queryClient.invalidateQueries({ queryKey: listKeys.lists() });
        toast({
          title: "List Deleted",
          description: "Your list has been deleted successfully.",
        });
      } else {
        toast({
          title: "Deletion Failed",
          description: data.error || "Failed to delete list.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete list.",
        variant: "destructive",
      });
    },
  });
};
