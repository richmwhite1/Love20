import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface Connection {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  friend?: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
}

export interface ConnectionResponse {
  success: boolean;
  data?: Connection;
  error?: string;
  code?: number;
}

export interface ConnectionsResponse {
  success: boolean;
  data?: Connection[];
  error?: string;
  code?: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
  connectionStatus?: string;
  isConnection?: boolean;
}

export interface UsersResponse {
  success: boolean;
  data?: User[];
  error?: string;
  code?: number;
}

// Query key factory
export const connectionKeys = {
  all: ['connections'] as const,
  lists: () => [...connectionKeys.all, 'list'] as const,
  list: (filters: any) => [...connectionKeys.lists(), filters] as const,
  details: () => [...connectionKeys.all, 'detail'] as const,
  detail: (connectionId: string) => [...connectionKeys.details(), connectionId] as const,
  user: (userId: string) => [...connectionKeys.all, 'user', userId] as const,
  requests: () => [...connectionKeys.all, 'requests'] as const,
  outgoing: () => [...connectionKeys.all, 'outgoing'] as const,
  search: (query: string) => [...connectionKeys.all, 'search', query] as const,
};

// Fetch connections
const fetchConnections = async (): Promise<ConnectionsResponse> => {
  const response = await apiRequest('GET', '/api/connections');
  return response.json();
};

// Fetch user connections
const fetchUserConnections = async (userId: string): Promise<ConnectionsResponse> => {
  const response = await apiRequest('GET', `/api/connections/${userId}`);
  return response.json();
};

// Fetch friend requests
const fetchFriendRequests = async (): Promise<ConnectionsResponse> => {
  const response = await apiRequest('GET', '/api/friend-requests');
  return response.json();
};

// Fetch outgoing friend requests
const fetchOutgoingFriendRequests = async (): Promise<ConnectionsResponse> => {
  const response = await apiRequest('GET', '/api/outgoing-friend-requests');
  return response.json();
};

// Send friend request
const sendFriendRequest = async (userId: string): Promise<ConnectionResponse> => {
  const response = await apiRequest('POST', '/api/friends/request', { userId });
  return response.json();
};

// Accept friend request
const acceptFriendRequest = async (requestId: string): Promise<ConnectionResponse> => {
  const response = await apiRequest('POST', `/api/friends/request/${requestId}/accept`);
  return response.json();
};

// Reject friend request
const rejectFriendRequest = async (requestId: string): Promise<ConnectionResponse> => {
  const response = await apiRequest('POST', `/api/friends/request/${requestId}/reject`);
  return response.json();
};

// Remove friend
const removeFriend = async (userId: string): Promise<ConnectionResponse> => {
  const response = await apiRequest('DELETE', `/api/friends/${userId}`);
  return response.json();
};

// Search users
const searchUsers = async (query: string): Promise<UsersResponse> => {
  const response = await apiRequest('GET', `/api/search/users?q=${encodeURIComponent(query)}`);
  return response.json();
};

// Hook for fetching connections
export const useConnections = () => {
  return useQuery({
    queryKey: connectionKeys.lists(),
    queryFn: fetchConnections,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching user connections
export const useUserConnections = (userId: string) => {
  return useQuery({
    queryKey: connectionKeys.user(userId),
    queryFn: () => fetchUserConnections(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching friend requests
export const useFriendRequests = () => {
  return useQuery({
    queryKey: connectionKeys.requests(),
    queryFn: fetchFriendRequests,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for fetching outgoing friend requests
export const useOutgoingFriendRequests = () => {
  return useQuery({
    queryKey: connectionKeys.outgoing(),
    queryFn: fetchOutgoingFriendRequests,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for searching users
export const useSearchUsers = (query: string) => {
  return useQuery({
    queryKey: connectionKeys.search(query),
    queryFn: () => searchUsers(query),
    enabled: !!query && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for sending friend request
export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (data, userId) => {
      if (data.success) {
        // Invalidate connections and search results
        queryClient.invalidateQueries({ queryKey: connectionKeys.lists() });
        queryClient.invalidateQueries({ queryKey: connectionKeys.outgoing() });
        queryClient.invalidateQueries({ queryKey: connectionKeys.search('') });
        
        toast({
          title: "Friend Request Sent",
          description: "Friend request has been sent successfully.",
        });
      } else {
        toast({
          title: "Request Failed",
          description: data.error || "Failed to send friend request.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to send friend request.",
        variant: "destructive",
      });
    },
  });
};

// Hook for accepting friend request
export const useAcceptFriendRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: (data, requestId) => {
      if (data.success) {
        // Invalidate connections and requests
        queryClient.invalidateQueries({ queryKey: connectionKeys.lists() });
        queryClient.invalidateQueries({ queryKey: connectionKeys.requests() });
        
        toast({
          title: "Friend Request Accepted",
          description: "Friend request has been accepted.",
        });
      } else {
        toast({
          title: "Accept Failed",
          description: data.error || "Failed to accept friend request.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Accept Failed",
        description: error instanceof Error ? error.message : "Failed to accept friend request.",
        variant: "destructive",
      });
    },
  });
};

// Hook for rejecting friend request
export const useRejectFriendRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: rejectFriendRequest,
    onSuccess: (data, requestId) => {
      if (data.success) {
        // Invalidate requests
        queryClient.invalidateQueries({ queryKey: connectionKeys.requests() });
        
        toast({
          title: "Friend Request Rejected",
          description: "Friend request has been rejected.",
        });
      } else {
        toast({
          title: "Reject Failed",
          description: data.error || "Failed to reject friend request.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Reject Failed",
        description: error instanceof Error ? error.message : "Failed to reject friend request.",
        variant: "destructive",
      });
    },
  });
};

// Hook for removing friend
export const useRemoveFriend = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: removeFriend,
    onSuccess: (data, userId) => {
      if (data.success) {
        // Invalidate connections
        queryClient.invalidateQueries({ queryKey: connectionKeys.lists() });
        queryClient.invalidateQueries({ queryKey: connectionKeys.user('') });
        
        toast({
          title: "Friend Removed",
          description: "Friend has been removed from your connections.",
        });
      } else {
        toast({
          title: "Remove Failed",
          description: data.error || "Failed to remove friend.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Remove Failed",
        description: error instanceof Error ? error.message : "Failed to remove friend.",
        variant: "destructive",
      });
    },
  });
};
