import { BaseService } from './base-service';
import { ApiResponse, NotificationData } from '../types';

export class NotificationService extends BaseService {

  async createNotification(notificationData: NotificationData): Promise<ApiResponse<any>> {
    try {
      const notificationResponse = await this.storage.createNotification(notificationData);
      if (!notificationResponse.success) {
        return this.createErrorResponse('Failed to create notification');
      }

      return this.createSuccessResponse(notificationResponse.data);
    } catch (error) {
      this.logError('createNotification', error, { notificationData });
      return this.createErrorResponse('Failed to create notification');
    }
  }

  async getNotifications(userId: string, pagination?: any): Promise<ApiResponse<any[]>> {
    try {
      const notificationsResponse = await this.storage.getNotifications(userId, pagination);
      if (!notificationsResponse.success) {
        return this.createErrorResponse('Failed to get notifications');
      }

      return this.createSuccessResponse(notificationsResponse.data || []);
    } catch (error) {
      this.logError('getNotifications', error, { userId, pagination });
      return this.createErrorResponse('Failed to get notifications');
    }
  }

  async getUnreadCount(userId: string): Promise<ApiResponse<number>> {
    try {
      const countResponse = await this.storage.getUnreadNotificationCount(userId);
      if (!countResponse.success) {
        return this.createErrorResponse('Failed to get unread count');
      }

      return this.createSuccessResponse(countResponse.data || 0);
    } catch (error) {
      this.logError('getUnreadCount', error, { userId });
      return this.createErrorResponse('Failed to get unread count');
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Verify notification belongs to user
      const notificationResponse = await this.storage.getNotificationById(notificationId);
      if (!notificationResponse.success || !notificationResponse.data) {
        return this.createErrorResponse('Notification not found', 404);
      }

      if (notificationResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot modify another user\'s notification', 403);
      }

      const updateResponse = await this.storage.markNotificationAsRead(notificationId);
      if (!updateResponse.success) {
        return this.createErrorResponse('Failed to mark notification as read');
      }

      return this.createSuccessResponse(updateResponse.data);
    } catch (error) {
      this.logError('markAsRead', error, { notificationId, userId });
      return this.createErrorResponse('Failed to mark notification as read');
    }
  }

  async markAllAsRead(userId: string): Promise<ApiResponse<null>> {
    try {
      const updateResponse = await this.storage.markAllNotificationsAsRead(userId);
      if (!updateResponse.success) {
        return this.createErrorResponse('Failed to mark all notifications as read');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('markAllAsRead', error, { userId });
      return this.createErrorResponse('Failed to mark all notifications as read');
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      // Verify notification belongs to user
      const notificationResponse = await this.storage.getNotificationById(notificationId);
      if (!notificationResponse.success || !notificationResponse.data) {
        return this.createErrorResponse('Notification not found', 404);
      }

      if (notificationResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot delete another user\'s notification', 403);
      }

      const deleteResponse = await this.storage.deleteNotification(notificationId);
      if (!deleteResponse.success) {
        return this.createErrorResponse('Failed to delete notification');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('deleteNotification', error, { notificationId, userId });
      return this.createErrorResponse('Failed to delete notification');
    }
  }

  async createLikeNotification(postId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      // Don't notify if liking own post
      if (fromUserId === toUserId) {
        return this.createSuccessResponse(null);
      }

      const notificationData: NotificationData = {
        type: 'like',
        userId: toUserId,
        postId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createLikeNotification', error, { postId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create like notification');
    }
  }

  async createCommentNotification(postId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      // Don't notify if commenting on own post
      if (fromUserId === toUserId) {
        return this.createSuccessResponse(null);
      }

      const notificationData: NotificationData = {
        type: 'comment',
        userId: toUserId,
        postId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createCommentNotification', error, { postId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create comment notification');
    }
  }

  async createShareNotification(postId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      // Don't notify if sharing own post
      if (fromUserId === toUserId) {
        return this.createSuccessResponse(null);
      }

      const notificationData: NotificationData = {
        type: 'share',
        userId: toUserId,
        postId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createShareNotification', error, { postId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create share notification');
    }
  }

  async createFriendRequestNotification(fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'friend_request',
        userId: toUserId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createFriendRequestNotification', error, { fromUserId, toUserId });
      return this.createErrorResponse('Failed to create friend request notification');
    }
  }

  async createFriendAcceptNotification(fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'friend_accept',
        userId: toUserId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createFriendAcceptNotification', error, { fromUserId, toUserId });
      return this.createErrorResponse('Failed to create friend accept notification');
    }
  }

  async createTagNotification(postId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'tag',
        userId: toUserId,
        postId,
        fromUserId
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createTagNotification', error, { postId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create tag notification');
    }
  }

  async createListInviteNotification(listId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'list_invite',
        userId: toUserId,
        fromUserId,
        data: { listId }
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createListInviteNotification', error, { listId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create list invite notification');
    }
  }

  async createAccessRequestNotification(listId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'access_request',
        userId: toUserId,
        fromUserId,
        data: { listId }
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createAccessRequestNotification', error, { listId, fromUserId, toUserId });
      return this.createErrorResponse('Failed to create access request notification');
    }
  }

  async createAccessResponseNotification(listId: string, fromUserId: string, toUserId: string, granted: boolean): Promise<ApiResponse<any>> {
    try {
      const notificationData: NotificationData = {
        type: 'access_response',
        userId: toUserId,
        fromUserId,
        data: { listId, granted }
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      this.logError('createAccessResponseNotification', error, { listId, fromUserId, toUserId, granted });
      return this.createErrorResponse('Failed to create access response notification');
    }
  }
}
