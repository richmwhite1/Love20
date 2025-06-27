import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  postId?: string;
  fromUserId?: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  fromUser?: {
    id: string;
    username: string;
    name: string;
    profilePictureUrl?: string;
  };
  post?: {
    id: string;
    primaryDescription: string;
    primaryPhotoUrl?: string;
  };
}

export interface NotificationsResponse {
  success: boolean;
  data?: Notification[];
  error?: string;
  code?: number;
}

export interface NotificationCountResponse {
  success: boolean;
  data?: number;
  error?: string;
  code?: number;
}

export interface NotificationResponse {
  success: boolean;
  data?: Notification;
  error?: string;
  code?: number;
}

// Query key factory
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: any) => [...notificationKeys.lists(), filters] as const,
  details: () => [...notificationKeys.all, 'detail'] as const,
  detail: (notificationId: string) => [...notificationKeys.details(), notificationId] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
};

// Fetch notifications
const fetchNotifications = async (pagination?: { page?: number; limit?: number }): Promise<NotificationsResponse> => {
  const params = new URLSearchParams();
  
  if (pagination?.page) {
    params.append('page', String(pagination.page));
  }
  if (pagination?.limit) {
    params.append('limit', String(pagination.limit));
  }
  
  const url = `/api/notifications${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await apiRequest('GET', url);
  return response.json();
};

// Fetch unread count
const fetchUnreadCount = async (): Promise<NotificationCountResponse> => {
  const response = await apiRequest('GET', '/api/notifications/unread-count');
  return response.json();
};

// Mark notification as read
const markAsRead = async (notificationId: string): Promise<NotificationResponse> => {
  const response = await apiRequest('PUT', `/api/notifications/${notificationId}/read`);
  return response.json();
};

// Mark all notifications as read
const markAllAsRead = async (): Promise<NotificationResponse> => {
  const response = await apiRequest('PUT', '/api/notifications/mark-all-read');
  return response.json();
};

// Delete notification
const deleteNotification = async (notificationId: string): Promise<NotificationResponse> => {
  const response = await apiRequest('DELETE', `/api/notifications/${notificationId}`);
  return response.json();
};

// Hook for fetching notifications
export const useNotifications = (pagination?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: notificationKeys.list(pagination || {}),
    queryFn: () => fetchNotifications(pagination),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Hook for fetching unread count
export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

// Hook for marking notification as read
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: (data, notificationId) => {
      if (data.success) {
        // Optimistically update the notification
        queryClient.setQueriesData(
          { queryKey: notificationKeys.lists() },
          (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((notification: Notification) =>
                notification.id === notificationId
                  ? { ...notification, isRead: true }
                  : notification
              ),
            };
          }
        );
        
        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
        
        toast({
          title: "Marked as Read",
          description: "Notification marked as read.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to Mark as Read",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    },
  });
};

// Hook for marking all notifications as read
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: (data) => {
      if (data.success) {
        // Optimistically update all notifications
        queryClient.setQueriesData(
          { queryKey: notificationKeys.lists() },
          (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((notification: Notification) => ({
                ...notification,
                isRead: true,
              })),
            };
          }
        );
        
        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
        
        toast({
          title: "All Marked as Read",
          description: "All notifications marked as read.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to Mark All as Read",
        description: "Failed to mark all notifications as read.",
        variant: "destructive",
      });
    },
  });
};

// Hook for deleting notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: (data, notificationId) => {
      if (data.success) {
        // Remove from cache
        queryClient.setQueriesData(
          { queryKey: notificationKeys.lists() },
          (old: any) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.filter((notification: Notification) => notification.id !== notificationId),
            };
          }
        );
        
        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
        
        toast({
          title: "Notification Deleted",
          description: "Notification has been deleted.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete notification.",
        variant: "destructive",
      });
    },
  });
};

// Hook for creating notification (for internal use)
export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  
  const createNotification = async (data: {
    type: string;
    userId: string;
    postId?: string;
    fromUserId?: string;
    data?: Record<string, any>;
  }): Promise<NotificationResponse> => {
    const response = await apiRequest('POST', '/api/notifications', data);
    return response.json();
  };
  
  return useMutation({
    mutationFn: createNotification,
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate notifications and unread count
        queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      }
    },
  });
};
