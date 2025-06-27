import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { createPostSchema, type CreatePostData } from '@shared/schema';

export class PostService extends BaseService {

  async createPost(userId: string, postData: CreatePostData, files?: Express.Multer.File[]): Promise<ApiResponse<any>> {
    try {
      // Validate user exists
      const userResponse = await this.verifyUser(userId);
      if (!userResponse.success) {
        return userResponse;
      }

      // Validate post data
      const validation = createPostSchema.safeParse(postData);
      if (!validation.success) {
        return this.createErrorResponse('Invalid post data', 400);
      }

      // Process uploaded files
      const processedFiles = this.processUploadedFiles(files);
      
      // Create post with processed data
      const postResponse = await this.storage.createPost({
        ...postData,
        userId,
        additionalPhotos: processedFiles.additionalPhotos,
        additionalPhotoData: processedFiles.additionalPhotoData
      });

      if (!postResponse.success) {
        return this.createErrorResponse('Failed to create post');
      }

      return this.createSuccessResponse(postResponse.data);
    } catch (error) {
      this.logError('createPost', error, { userId, postData });
      return this.createErrorResponse('Failed to create post');
    }
  }

  async getPosts(filters?: any, pagination?: any): Promise<ApiResponse<any[]>> {
    try {
      const postsResponse = await this.storage.getPosts(filters, pagination);
      if (!postsResponse.success) {
        return this.createErrorResponse('Failed to get posts');
      }

      return this.createSuccessResponse(postsResponse.data || []);
    } catch (error) {
      this.logError('getPosts', error, { filters, pagination });
      return this.createErrorResponse('Failed to get posts');
    }
  }

  async getPostById(postId: string, userId?: string): Promise<ApiResponse<any>> {
    try {
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      const post = postResponse.data;

      // Check privacy if user is provided
      if (userId && post.userId !== userId) {
        const hasAccess = await this.verifyUserAccess(userId, post.userId);
        if (!hasAccess && post.privacy === 'private') {
          return this.createErrorResponse('Post not found', 404);
        }
      }

      return this.createSuccessResponse(post);
    } catch (error) {
      this.logError('getPostById', error, { postId, userId });
      return this.createErrorResponse('Failed to get post');
    }
  }

  async getPostsByUser(userId: string, requestingUserId?: string): Promise<ApiResponse<any[]>> {
    try {
      // Check if requesting user has access to target user's posts
      if (requestingUserId && requestingUserId !== userId) {
        const hasAccess = await this.verifyUserAccess(requestingUserId, userId);
        if (!hasAccess) {
          return this.createErrorResponse('Access denied', 403);
        }
      }

      const postsResponse = await this.storage.getPostsByUserId(userId);
      if (!postsResponse.success) {
        return this.createErrorResponse('Failed to get user posts');
      }

      return this.createSuccessResponse(postsResponse.data || []);
    } catch (error) {
      this.logError('getPostsByUser', error, { userId, requestingUserId });
      return this.createErrorResponse('Failed to get user posts');
    }
  }

  async likePost(postId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if post exists
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      // Check if already liked
      const existingLike = await this.storage.getPostLike(postId, userId);
      if (existingLike.success && existingLike.data) {
        return this.createErrorResponse('Post already liked', 400);
      }

      // Create like
      const likeResponse = await this.storage.createPostLike(postId, userId);
      if (!likeResponse.success) {
        return this.createErrorResponse('Failed to like post');
      }

      return this.createSuccessResponse(likeResponse.data);
    } catch (error) {
      this.logError('likePost', error, { postId, userId });
      return this.createErrorResponse('Failed to like post');
    }
  }

  async unlikePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const unlikeResponse = await this.storage.deletePostLike(postId, userId);
      if (!unlikeResponse.success) {
        return this.createErrorResponse('Failed to unlike post');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('unlikePost', error, { postId, userId });
      return this.createErrorResponse('Failed to unlike post');
    }
  }

  async sharePost(postId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if post exists
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      // Create share
      const shareResponse = await this.storage.createPostShare(postId, userId);
      if (!shareResponse.success) {
        return this.createErrorResponse('Failed to share post');
      }

      return this.createSuccessResponse(shareResponse.data);
    } catch (error) {
      this.logError('sharePost', error, { postId, userId });
      return this.createErrorResponse('Failed to share post');
    }
  }

  async savePost(postId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if post exists
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      // Check if already saved
      const existingSave = await this.storage.getSavedPost(postId, userId);
      if (existingSave.success && existingSave.data) {
        return this.createErrorResponse('Post already saved', 400);
      }

      // Create save
      const saveResponse = await this.storage.createSavedPost(postId, userId);
      if (!saveResponse.success) {
        return this.createErrorResponse('Failed to save post');
      }

      return this.createSuccessResponse(saveResponse.data);
    } catch (error) {
      this.logError('savePost', error, { postId, userId });
      return this.createErrorResponse('Failed to save post');
    }
  }

  async unsavePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const unsaveResponse = await this.storage.deleteSavedPost(postId, userId);
      if (!unsaveResponse.success) {
        return this.createErrorResponse('Failed to unsave post');
      }

      return this.createSuccessResponse(null);
    } catch (error) {
      this.logError('unsavePost', error, { postId, userId });
      return this.createErrorResponse('Failed to unsave post');
    }
  }

  async flagPost(postId: string, userId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      // Check if post exists
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      // Create flag
      const flagResponse = await this.storage.createPostFlag(postId, userId, reason);
      if (!flagResponse.success) {
        return this.createErrorResponse('Failed to flag post');
      }

      return this.createSuccessResponse(flagResponse.data);
    } catch (error) {
      this.logError('flagPost', error, { postId, userId, reason });
      return this.createErrorResponse('Failed to flag post');
    }
  }

  async viewPost(postId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if post exists
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      // Create view
      const viewResponse = await this.storage.createPostView(postId, userId);
      if (!viewResponse.success) {
        return this.createErrorResponse('Failed to record view');
      }

      return this.createSuccessResponse(viewResponse.data);
    } catch (error) {
      this.logError('viewPost', error, { postId, userId });
      return this.createErrorResponse('Failed to record view');
    }
  }

  async getPostStats(postId: string): Promise<ApiResponse<any>> {
    try {
      const statsResponse = await this.storage.getPostStats(postId);
      if (!statsResponse.success) {
        return this.createErrorResponse('Failed to get post stats');
      }

      return this.createSuccessResponse(statsResponse.data);
    } catch (error) {
      this.logError('getPostStats', error, { postId });
      return this.createErrorResponse('Failed to get post stats');
    }
  }

  async getPostViews(postId: string): Promise<ApiResponse<any>> {
    try {
      const viewsResponse = await this.storage.getPostViews(postId);
      if (!viewsResponse.success) {
        return this.createErrorResponse('Failed to get post views');
      }

      return this.createSuccessResponse(viewsResponse.data);
    } catch (error) {
      this.logError('getPostViews', error, { postId });
      return this.createErrorResponse('Failed to get post views');
    }
  }

  async deletePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      // Check if post exists and user owns it
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      if (postResponse.data.userId !== userId) {
        return this.createErrorResponse('Cannot delete another user\'s post', 403);
      }

      // Delete post
      const deleteResponse = await this.storage.deletePost(postId);
      if (!deleteResponse.success) {
        return this.createErrorResponse('Failed to delete post');
      }

      return this.createSuccessResponse(null, 'Post deleted successfully');
    } catch (error) {
      this.logError('deletePost', error, { postId, userId });
      return this.createErrorResponse('Failed to delete post');
    }
  }

  private processUploadedFiles(files?: Express.Multer.File[]) {
    const additionalPhotos: string[] = [];
    const additionalPhotoData: any[] = [];

    if (files && files.length > 0) {
      files.forEach((file, index) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = `/uploads/${fileName}`;
        
        additionalPhotos.push(filePath);
        additionalPhotoData.push({
          url: filePath,
          link: '',
          description: '',
          discountCode: ''
        });
      });
    }

    return { additionalPhotos, additionalPhotoData };
  }
}
