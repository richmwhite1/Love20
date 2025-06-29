import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { auth } from '../firebase-db';

export class UserService extends BaseService {
  
  async ensureUser(userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if user exists in our database
      let userResponse = await this.storage.getUser(userId);
      let user = userResponse.success ? userResponse.data : null;
      
      if (!user) {
        // User doesn't exist, create them
        const firebaseUser = await this.auth.getUser(userId);
        const createUserResponse = await this.storage.createUser({
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || userId,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || userId,
          email: firebaseUser.email || '',
          profilePictureUrl: firebaseUser.photoURL || null,
        });
        user = createUserResponse.success ? createUserResponse.data : null;
      }
      
      // Ensure user has a General list
      const listsResponse = await this.storage.getListsByUserId(userId);
      const lists = listsResponse.success ? listsResponse.data || [] : [];
      if (lists.length === 0) {
        await this.storage.createList({
          userId,
          name: 'General',
          description: 'Default list for all posts',
          privacyLevel: 'public',
          isPublic: true,
        });
      }
      
      return this.createSuccessResponse(user);
    } catch (error) {
      this.logError('ensureUser', error, { userId });
      return this.createErrorResponse('Failed to ensure user');
    }
  }

  async getCurrentUser(userId: string): Promise<ApiResponse<any>> {
    try {
      const userResponse = await this.storage.getUser(userId);
      if (!userResponse.success || !userResponse.data) {
        return this.createErrorResponse('User not found', 404);
      }

      const user = userResponse.data;
      return this.createSuccessResponse({
        id: user.id,
        username: user.username,
        name: user.name,
        profilePictureUrl: user.profilePictureUrl,
        defaultPrivacy: user.defaultPrivacy
      });
    } catch (error) {
      this.logError('getCurrentUser', error, { userId });
      return this.createErrorResponse('Failed to get current user');
    }
  }

  async getUserProfile(userId: string): Promise<ApiResponse<any>> {
    try {
      const userResponse = await this.storage.getUser(userId);
      
      if (!userResponse.success || !userResponse.data) {
        return this.createErrorResponse('User not found', 404);
      }

      const user = userResponse.data;
      return this.createSuccessResponse({
        id: user.id,
        username: user.username,
        name: user.name,
        profilePictureUrl: user.profilePictureUrl,
        defaultPrivacy: user.defaultPrivacy
      });
    } catch (error) {
      this.logError('getUserProfile', error, { userId });
      return this.createErrorResponse('Failed to get user profile');
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse<null>> {
    try {
      // Check if user exists
      const user = await this.storage.getUser(userId);
      if (!user.success) {
        return this.createErrorResponse('User not found', 404);
      }

      // Delete user and all associated data
      await this.storage.deleteUser(userId);
      
      return this.createSuccessResponse(null, 'Profile and all associated data deleted successfully');
    } catch (error) {
      this.logError('deleteUser', error, { userId });
      return this.createErrorResponse('Failed to delete user');
    }
  }

  async createUser(userId: string, userData: any): Promise<ApiResponse<any>> {
    try {
      // Create user in storage
      const createUserResponse = await this.storage.createUser({
        ...userData,
        id: userId
      });

      if (!createUserResponse.success) {
        return this.createErrorResponse('Failed to create user');
      }

      // Create three default lists for new user
      const defaultLists = [
        {
          userId,
          name: 'General',
          description: 'Default list for all posts',
          privacyLevel: 'public',
          isPublic: true
        },
        {
          userId,
          name: 'Favorites',
          description: 'Your favorite posts',
          privacyLevel: 'public',
          isPublic: true
        },
        {
          userId,
          name: 'Wishlist',
          description: 'Posts you want to remember',
          privacyLevel: 'connections',
          isPublic: false
        }
      ];

      // Create all default lists
      for (const listData of defaultLists) {
        await this.storage.createList(listData);
      }

      return this.createSuccessResponse(createUserResponse.data, 'User created successfully with default lists');
    } catch (error) {
      this.logError('createUser', error, { userId, userData });
      return this.createErrorResponse('Failed to create user');
    }
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<ApiResponse<any>> {
    try {
      // Check if user exists
      const user = await this.storage.getUser(userId);
      if (!user.success) {
        return this.createErrorResponse('User not found', 404);
      }

      // Validate file
      if (!file) {
        return this.createErrorResponse('No file uploaded', 400);
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return this.createErrorResponse('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.', 400);
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return this.createErrorResponse('File too large. Maximum size is 5MB.', 400);
      }

      // Save file and get URL
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `/uploads/${fileName}`;
      
      // Update user profile picture
      const updateResponse = await this.storage.updateUser(userId, {
        profilePictureUrl: filePath
      });

      if (!updateResponse.success) {
        return this.createErrorResponse('Failed to update profile picture');
      }

      return this.createSuccessResponse({ profilePictureUrl: filePath });
    } catch (error) {
      this.logError('uploadProfilePicture', error, { userId });
      return this.createErrorResponse('Failed to upload profile picture');
    }
  }

  async searchUsers(query: string, currentUserId: string): Promise<ApiResponse<any[]>> {
    try {
      const usersResponse = await this.storage.searchUsers(query);
      if (!usersResponse.success) {
        return this.createErrorResponse('Failed to search users');
      }

      // Filter out current user and add connection status
      const users = await Promise.all(
        usersResponse.data
          .filter((user: any) => user.id !== currentUserId)
          .map(async (user: any) => {
            const connectionResponse = await this.storage.getConnection(currentUserId, user.id);
            const connection = connectionResponse.success ? connectionResponse.data : null;
            
            return {
              ...user,
              connectionStatus: connection ? connection.status : null,
              isConnection: connection?.status === 'accepted'
            };
          })
      );

      return this.createSuccessResponse(users);
    } catch (error) {
      this.logError('searchUsers', error, { query, currentUserId });
      return this.createErrorResponse('Failed to search users');
    }
  }

  async getConnectionStories(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const connectionsResponse = await this.storage.getConnections(userId);
      if (!connectionsResponse.success) {
        return this.createErrorResponse('Failed to get connections');
      }

      const connections = connectionsResponse.data || [];
      const stories = await Promise.all(
        connections.map(async (connection: any) => {
          const userResponse = await this.storage.getUser(connection.friendId);
          const user = userResponse.success ? userResponse.data : null;
          
          if (!user) return null;

          // Get recent posts for story preview
          const postsResponse = await this.storage.getPostsByUserId(user.id, { limit: 1 });
          const recentPost = postsResponse.success && postsResponse.data?.length > 0 
            ? postsResponse.data[0] 
            : null;

          return {
            user: {
              id: user.id,
              username: user.username,
              name: user.name,
              profilePictureUrl: user.profilePictureUrl
            },
            hasNewPosts: !!recentPost,
            lastPostDate: recentPost?.createdAt
          };
        })
      );

      return this.createSuccessResponse(stories.filter(Boolean));
    } catch (error) {
      this.logError('getConnectionStories', error, { userId });
      return this.createErrorResponse('Failed to get connection stories');
    }
  }

  async getRecentPostsFromConnections(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const connectionsResponse = await this.storage.getConnections(userId);
      if (!connectionsResponse.success) {
        return this.createErrorResponse('Failed to get connections');
      }

      const connections = connectionsResponse.data || [];
      const connectionIds = connections.map((c: any) => c.friendId);
      
      if (connectionIds.length === 0) {
        return this.createSuccessResponse([]);
      }

      const postsResponse = await this.storage.getPostsByUserIds(connectionIds, { limit: 20 });
      if (!postsResponse.success) {
        return this.createErrorResponse('Failed to get recent posts');
      }

      return this.createSuccessResponse(postsResponse.data || []);
    } catch (error) {
      this.logError('getRecentPostsFromConnections', error, { userId });
      return this.createErrorResponse('Failed to get recent posts from connections');
    }
  }

  async getConnections(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const connectionsResponse = await this.storage.getConnections(userId);
      if (!connectionsResponse.success) {
        return this.createErrorResponse('Failed to get connections');
      }

      return this.createSuccessResponse(connectionsResponse.data || []);
    } catch (error) {
      this.logError('getConnections', error, { userId });
      return this.createErrorResponse('Failed to get connections');
    }
  }

  async getFriendRequests(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const requestsResponse = await this.storage.getIncomingFriendRequests(userId);
      if (!requestsResponse.success) {
        return this.createErrorResponse('Failed to get friend requests');
      }

      return this.createSuccessResponse(requestsResponse.data || []);
    } catch (error) {
      this.logError('getFriendRequests', error, { userId });
      return this.createErrorResponse('Failed to get friend requests');
    }
  }

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    try {
      if (fromUserId === toUserId) {
        return this.createErrorResponse('Cannot send friend request to yourself', 400);
      }

      // Check if target user exists
      const targetUserResponse = await this.verifyUser(toUserId);
      if (!targetUserResponse.success) {
        return this.createErrorResponse('User not found', 404);
      }

      // Check if request already exists
      const existingRequest = await this.storage.getFriendRequest(fromUserId, toUserId);
      if (existingRequest.success && existingRequest.data) {
        return this.createErrorResponse('Friend request already sent', 400);
      }

      // Send friend request
      const requestResponse = await this.storage.sendConnectionRequest(fromUserId, toUserId);
      if (!requestResponse.success) {
        return this.createErrorResponse('Failed to send friend request');
      }

      return this.createSuccessResponse(requestResponse.data);
    } catch (error) {
      this.logError('sendFriendRequest', error, { fromUserId, toUserId });
      return this.createErrorResponse('Failed to send friend request');
    }
  }

  async acceptFriendRequest(requestId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Verify the request exists and belongs to the user
      const requestResponse = await this.storage.getFriendRequestById(requestId);
      if (!requestResponse.success || !requestResponse.data) {
        return this.createErrorResponse('Friend request not found', 404);
      }

      if (requestResponse.data.toUserId !== userId) {
        return this.createErrorResponse('Cannot accept another user\'s friend request', 403);
      }

      // Accept the request
      const acceptResponse = await this.storage.acceptConnectionRequest(requestId);
      if (!acceptResponse.success) {
        return this.createErrorResponse('Failed to accept friend request');
      }

      return this.createSuccessResponse(acceptResponse.data);
    } catch (error) {
      this.logError('acceptFriendRequest', error, { requestId, userId });
      return this.createErrorResponse('Failed to accept friend request');
    }
  }

  async rejectFriendRequest(requestId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      // Verify the request exists and belongs to the user
      const requestResponse = await this.storage.getFriendRequestById(requestId);
      if (!requestResponse.success || !requestResponse.data) {
        return this.createErrorResponse('Friend request not found', 404);
      }

      if (requestResponse.data.toUserId !== userId) {
        return this.createErrorResponse('Cannot reject another user\'s friend request', 403);
      }

      // Reject the request
      const rejectResponse = await this.storage.rejectConnectionRequest(requestId);
      if (!rejectResponse.success) {
        return this.createErrorResponse('Failed to reject friend request');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('rejectFriendRequest', error, { requestId, userId });
      return this.createErrorResponse('Failed to reject friend request');
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<ApiResponse<null>> {
    try {
      // Check if they are actually friends
      const connectionResponse = await this.storage.getConnection(userId, friendId);
      if (!connectionResponse.success || connectionResponse.data?.status !== 'accepted') {
        return this.createErrorResponse('Users are not friends', 400);
      }

      // Remove the friendship
      const removeResponse = await this.storage.removeConnection(userId, friendId);
      if (!removeResponse.success) {
        return this.createErrorResponse('Failed to remove friend');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('removeFriend', error, { userId, friendId });
      return this.createErrorResponse('Failed to remove friend');
    }
  }

  async getUserListInvitations(userId: string): Promise<ApiResponse<any[]>> {
    try {
      // For now, return empty array since this feature might not be fully implemented
      // This prevents the frontend from crashing when this endpoint is called
      return this.createSuccessResponse([]);
    } catch (error) {
      this.logError('getUserListInvitations', error, { userId });
      return this.createErrorResponse('Failed to get list invitations');
    }
  }
}
