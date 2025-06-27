import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { createListSchema, type CreateListData } from '@shared/schema';

export class ListService extends BaseService {

  async createList(userId: string, listData: CreateListData): Promise<ApiResponse<any>> {
    try {
      // Validate user exists
      const userResponse = await this.verifyUser(userId);
      if (!userResponse.success) {
        return userResponse;
      }

      // Validate list data
      const validation = createListSchema.safeParse(listData);
      if (!validation.success) {
        return this.createErrorResponse('Invalid list data', 400);
      }

      // Create list
      const listResponse = await this.storage.createList({
        ...listData,
        userId
      });

      if (!listResponse.success) {
        return this.createErrorResponse('Failed to create list');
      }

      return this.createSuccessResponse(listResponse.data);
    } catch (error) {
      this.logError('createList', error, { userId, listData });
      return this.createErrorResponse('Failed to create list');
    }
  }

  async getLists(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const listsResponse = await this.storage.getLists();
      if (!listsResponse.success) {
        return this.createErrorResponse('Failed to get lists');
      }

      // Filter lists based on privacy and user access
      const filteredLists = await Promise.all(
        (listsResponse.data || []).map(async (list: any) => {
          // Public lists are always visible
          if (list.privacyLevel === 'public') {
            return list;
          }

          // Private lists are only visible to owner
          if (list.privacyLevel === 'private' && list.userId === userId) {
            return list;
          }

          // Connections lists require friendship check
          if (list.privacyLevel === 'connections') {
            if (list.userId === userId) {
              return list;
            }
            
            const hasAccess = await this.verifyUserAccess(userId, list.userId);
            if (hasAccess) {
              return list;
            }
          }

          return null;
        })
      );

      return this.createSuccessResponse(filteredLists.filter(Boolean));
    } catch (error) {
      this.logError('getLists', error, { userId });
      return this.createErrorResponse('Failed to get lists');
    }
  }

  async getMyLists(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const listsResponse = await this.storage.getListsByUserId(userId);
      if (!listsResponse.success) {
        return this.createErrorResponse('Failed to get user lists');
      }

      return this.createSuccessResponse(listsResponse.data || []);
    } catch (error) {
      this.logError('getMyLists', error, { userId });
      return this.createErrorResponse('Failed to get user lists');
    }
  }

  async getListById(listId: string, userId?: string): Promise<ApiResponse<any>> {
    try {
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      const list = listResponse.data;

      // Check privacy if user is provided
      if (userId && list.userId !== userId) {
        if (list.privacyLevel === 'private') {
          return this.createErrorResponse('List not found', 404);
        }

        if (list.privacyLevel === 'connections') {
          const hasAccess = await this.verifyUserAccess(userId, list.userId);
          if (!hasAccess) {
            return this.createErrorResponse('List not found', 404);
          }
        }
      }

      return this.createSuccessResponse(list);
    } catch (error) {
      this.logError('getListById', error, { listId, userId });
      return this.createErrorResponse('Failed to get list');
    }
  }

  async getListsByUser(targetUserId: string, requestingUserId?: string): Promise<ApiResponse<any[]>> {
    try {
      // Check if requesting user has access to target user's lists
      if (requestingUserId && requestingUserId !== targetUserId) {
        const hasAccess = await this.verifyUserAccess(requestingUserId, targetUserId);
        if (!hasAccess) {
          return this.createErrorResponse('Access denied', 403);
        }
      }

      const listsResponse = await this.storage.getListsByUserId(targetUserId);
      if (!listsResponse.success) {
        return this.createErrorResponse('Failed to get user lists');
      }

      // Filter based on privacy
      const filteredLists = (listsResponse.data || []).filter((list: any) => {
        if (list.privacyLevel === 'public') return true;
        if (list.privacyLevel === 'private' && requestingUserId === targetUserId) return true;
        if (list.privacyLevel === 'connections' && requestingUserId) return true;
        return false;
      });

      return this.createSuccessResponse(filteredLists);
    } catch (error) {
      this.logError('getListsByUser', error, { targetUserId, requestingUserId });
      return this.createErrorResponse('Failed to get user lists');
    }
  }

  async updateListPrivacy(listId: string, userId: string, privacyLevel: string): Promise<ApiResponse<any>> {
    try {
      // Check if list exists and user owns it
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      if (listResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot modify another user\'s list', 403);
      }

      // Validate privacy level
      const validLevels = ['public', 'connections', 'private'];
      if (!validLevels.includes(privacyLevel)) {
        return this.createErrorResponse('Invalid privacy level', 400);
      }

      // Update list privacy
      const updateResponse = await this.storage.updateList(listId, {
        privacyLevel,
        isPublic: privacyLevel === 'public'
      });

      if (!updateResponse.success) {
        return this.createErrorResponse('Failed to update list privacy');
      }

      return this.createSuccessResponse(updateResponse.data);
    } catch (error) {
      this.logError('updateListPrivacy', error, { listId, userId, privacyLevel });
      return this.createErrorResponse('Failed to update list privacy');
    }
  }

  async deleteList(listId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      // Check if list exists and user owns it
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      if (listResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot delete another user\'s list', 403);
      }

      // Prevent deletion of General list
      if (listResponse.data.name === 'General') {
        return this.createErrorResponse('Cannot delete the General list', 400);
      }

      // Delete list
      const deleteResponse = await this.storage.deleteList(listId);
      if (!deleteResponse.success) {
        return this.createErrorResponse('Failed to delete list');
      }

      return this.createSuccessResponse(null, 'List deleted successfully');
    } catch (error) {
      this.logError('deleteList', error, { listId, userId });
      return this.createErrorResponse('Failed to delete list');
    }
  }

  async getListCollaborators(listId: string, userId: string): Promise<ApiResponse<any[]>> {
    try {
      // Check if list exists and user has access
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      const list = listResponse.data;
      if (list.userId !== userId) {
        const hasAccess = await this.verifyUserAccess(userId, list.userId);
        if (!hasAccess) {
          return this.createErrorResponse('Access denied', 403);
        }
      }

      const collaboratorsResponse = await this.storage.getListCollaborators(listId);
      if (!collaboratorsResponse.success) {
        return this.createErrorResponse('Failed to get list collaborators');
      }

      return this.createSuccessResponse(collaboratorsResponse.data || []);
    } catch (error) {
      this.logError('getListCollaborators', error, { listId, userId });
      return this.createErrorResponse('Failed to get list collaborators');
    }
  }

  async addListCollaborator(listId: string, userId: string, collaboratorId: string): Promise<ApiResponse<any>> {
    try {
      // Check if list exists and user owns it
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      if (listResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot modify another user\'s list', 403);
      }

      // Check if collaborator exists
      const collaboratorResponse = await this.verifyUser(collaboratorId);
      if (!collaboratorResponse.success) {
        return this.createErrorResponse('Collaborator not found', 404);
      }

      // Add collaborator
      const addResponse = await this.storage.addListCollaborator(listId, collaboratorId);
      if (!addResponse.success) {
        return this.createErrorResponse('Failed to add collaborator');
      }

      return this.createSuccessResponse(addResponse.data);
    } catch (error) {
      this.logError('addListCollaborator', error, { listId, userId, collaboratorId });
      return this.createErrorResponse('Failed to add collaborator');
    }
  }

  async removeListCollaborator(listId: string, userId: string, collaboratorId: string): Promise<ApiResponse<null>> {
    try {
      // Check if list exists and user owns it
      const listResponse = await this.storage.getListById(listId);
      if (!listResponse.success || !listResponse.data) {
        return this.createErrorResponse('List not found', 404);
      }

      if (listResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot modify another user\'s list', 403);
      }

      // Remove collaborator
      const removeResponse = await this.storage.removeListCollaborator(listId, collaboratorId);
      if (!removeResponse.success) {
        return this.createErrorResponse('Failed to remove collaborator');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('removeListCollaborator', error, { listId, userId, collaboratorId });
      return this.createErrorResponse('Failed to remove collaborator');
    }
  }
}
