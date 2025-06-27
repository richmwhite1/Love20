import { BaseService } from './base-service';
import { ApiResponse, PrivacyLevel } from '../types';

export class PrivacyService extends BaseService {

  async checkPostAccess(postId: string, requestingUserId: string): Promise<ApiResponse<boolean>> {
    try {
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      const post = postResponse.data;
      const hasAccess = await this.checkPrivacyAccess(post.privacy, post.userId, requestingUserId);
      
      return this.createSuccessResponse(hasAccess);
    } catch (error) {
      this.logError('checkPostAccess', error, { postId, requestingUserId });
      return this.createErrorResponse('Failed to check post access');
    }
  }

  async checkListAccess(listId: string, requestingUserId: string): Promise<ApiResponse<boolean>> {
    try {
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      const list = listResponse.data;
      const hasAccess = await this.checkPrivacyAccess(list.privacyLevel, list.userId, requestingUserId);
      
      return this.createSuccessResponse(hasAccess);
    } catch (error) {
      this.logError('checkListAccess', error, { listId, requestingUserId });
      return this.createErrorResponse('Failed to check list access');
    }
  }

  async checkUserProfileAccess(targetUserId: string, requestingUserId: string): Promise<ApiResponse<boolean>> {
    try {
      // Users can always access their own profile
      if (targetUserId === requestingUserId) {
        return this.createSuccessResponse(true);
      }

      // Check if they are friends/connections
      const connectionResponse = await this.storage.getConnection(requestingUserId, targetUserId);
      const isConnected = connectionResponse.success && connectionResponse.data?.status === 'accepted';
      
      return this.createSuccessResponse(isConnected);
    } catch (error) {
      this.logError('checkUserProfileAccess', error, { targetUserId, requestingUserId });
      return this.createErrorResponse('Failed to check user profile access');
    }
  }

  async filterPostsByPrivacy(posts: any[], requestingUserId: string): Promise<ApiResponse<any[]>> {
    try {
      const filteredPosts = await Promise.all(
        posts.map(async (post) => {
          const hasAccess = await this.checkPrivacyAccess(post.privacy, post.userId, requestingUserId);
          return hasAccess ? post : null;
        })
      );

      return this.createSuccessResponse(filteredPosts.filter(Boolean));
    } catch (error) {
      this.logError('filterPostsByPrivacy', error, { requestingUserId });
      return this.createErrorResponse('Failed to filter posts by privacy');
    }
  }

  async filterListsByPrivacy(lists: any[], requestingUserId: string): Promise<ApiResponse<any[]>> {
    try {
      const filteredLists = await Promise.all(
        lists.map(async (list) => {
          const hasAccess = await this.checkPrivacyAccess(list.privacyLevel, list.userId, requestingUserId);
          return hasAccess ? list : null;
        })
      );

      return this.createSuccessResponse(filteredLists.filter(Boolean));
    } catch (error) {
      this.logError('filterListsByPrivacy', error, { requestingUserId });
      return this.createErrorResponse('Failed to filter lists by privacy');
    }
  }

  async validatePrivacyLevel(privacyLevel: string): Promise<ApiResponse<boolean>> {
    try {
      const validLevels = ['public', 'connections', 'private'];
      const isValid = validLevels.includes(privacyLevel);
      
      return this.createSuccessResponse(isValid);
    } catch (error) {
      this.logError('validatePrivacyLevel', error, { privacyLevel });
      return this.createErrorResponse('Failed to validate privacy level');
    }
  }

  async getPrivacySettings(userId: string): Promise<ApiResponse<any>> {
    try {
      const userResponse = await this.storage.getUser(userId);
      if (!userResponse.success || !userResponse.data) {
        return this.createErrorResponse('User not found', 404);
      }

      const user = userResponse.data;
      return this.createSuccessResponse({
        defaultPrivacy: user.defaultPrivacy,
        profileVisibility: user.defaultPrivacy
      });
    } catch (error) {
      this.logError('getPrivacySettings', error, { userId });
      return this.createErrorResponse('Failed to get privacy settings');
    }
  }

  async updatePrivacySettings(userId: string, settings: any): Promise<ApiResponse<any>> {
    try {
      // Validate privacy level
      if (settings.defaultPrivacy) {
        const validationResponse = await this.validatePrivacyLevel(settings.defaultPrivacy);
        if (!validationResponse.success || !validationResponse.data) {
          return this.createErrorResponse('Invalid privacy level', 400);
        }
      }

      const updateResponse = await this.storage.updateUser(userId, settings);
      if (!updateResponse.success) {
        return this.createErrorResponse('Failed to update privacy settings');
      }

      return this.createSuccessResponse(updateResponse.data);
    } catch (error) {
      this.logError('updatePrivacySettings', error, { userId, settings });
      return this.createErrorResponse('Failed to update privacy settings');
    }
  }

  async checkConnectionStatus(userId1: string, userId2: string): Promise<ApiResponse<string>> {
    try {
      // Check if they are the same user
      if (userId1 === userId2) {
        return this.createSuccessResponse('self');
      }

      // Check for existing connection
      const connectionResponse = await this.storage.getConnection(userId1, userId2);
      if (!connectionResponse.success || !connectionResponse.data) {
        return this.createSuccessResponse('none');
      }

      return this.createSuccessResponse(connectionResponse.data.status);
    } catch (error) {
      this.logError('checkConnectionStatus', error, { userId1, userId2 });
      return this.createErrorResponse('Failed to check connection status');
    }
  }

  async getPublicContent(userId?: string): Promise<ApiResponse<any>> {
    try {
      // Get public posts
      const publicPostsResponse = await this.storage.getPosts({ privacy: 'public' });
      const publicPosts = publicPostsResponse.success ? publicPostsResponse.data || [] : [];

      // Get public lists
      const publicListsResponse = await this.storage.getLists({ privacyLevel: 'public' });
      const publicLists = publicListsResponse.success ? publicListsResponse.data || [] : [];

      // If user is provided, also include their connections-only content
      let connectionsContent = { posts: [], lists: [] };
      if (userId) {
        const connectionsResponse = await this.storage.getConnections(userId);
        if (connectionsResponse.success && connectionsResponse.data) {
          const connectionIds = connectionsResponse.data
            .filter((c: any) => c.status === 'accepted')
            .map((c: any) => c.friendId);

          if (connectionIds.length > 0) {
            const connectionsPostsResponse = await this.storage.getPostsByUserIds(connectionIds, { privacy: 'connections' });
            const connectionsListsResponse = await this.storage.getListsByUserIds(connectionIds, { privacyLevel: 'connections' });
            
            connectionsContent = {
              posts: connectionsPostsResponse.success ? connectionsPostsResponse.data || [] : [],
              lists: connectionsListsResponse.success ? connectionsListsResponse.data || [] : []
            };
          }
        }
      }

      return this.createSuccessResponse({
        public: {
          posts: publicPosts,
          lists: publicLists
        },
        connections: connectionsContent
      });
    } catch (error) {
      this.logError('getPublicContent', error, { userId });
      return this.createErrorResponse('Failed to get public content');
    }
  }

  private async checkPrivacyAccess(privacyLevel: string, resourceUserId: string, requestingUserId: string): Promise<boolean> {
    // Public content is always accessible
    if (privacyLevel === 'public') {
      return true;
    }

    // Users can always access their own content
    if (resourceUserId === requestingUserId) {
      return true;
    }

    // Private content is only accessible to the owner
    if (privacyLevel === 'private') {
      return false;
    }

    // Connections content requires friendship check
    if (privacyLevel === 'connections') {
      const connectionResponse = await this.storage.getConnection(requestingUserId, resourceUserId);
      return connectionResponse.success && connectionResponse.data?.status === 'accepted';
    }

    return false;
  }
}
