import { storage } from "../storage-enterprise";
import { auth } from "../firebase-db";
import { ApiResponse } from "../types";

export abstract class BaseService {
  protected storage;
  protected auth;

  constructor() {
    this.storage = storage;
    this.auth = auth;
  }

  protected createSuccessResponse<T>(data: T, message?: string, code: number = 200): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      code
    };
  }

  protected createErrorResponse<T>(message: string, code: number = 500): ApiResponse<T> {
    return {
      success: false,
      error: message,
      code
    };
  }

  protected createEmptySuccessResponse(message?: string, code: number = 200): ApiResponse<null> {
    return {
      success: true,
      data: null,
      message,
      code
    };
  }

  protected createArraySuccessResponse<T>(data: T[], message?: string, code: number = 200): ApiResponse<T[]> {
    return {
      success: true,
      data,
      message,
      code
    };
  }

  protected async verifyUser(userId: string): Promise<ApiResponse<any>> {
    try {
      const userResponse = await this.storage.getUser(userId);
      if (!userResponse.success || !userResponse.data) {
        return this.createErrorResponse('User not found', 404);
      }
      return this.createSuccessResponse(userResponse.data);
    } catch (error) {
      console.error('Error verifying user:', error);
      return this.createErrorResponse('Failed to verify user');
    }
  }

  protected async verifyUserAccess(userId: string, resourceUserId: string): Promise<boolean> {
    // Users can always access their own resources
    if (userId === resourceUserId) {
      return true;
    }

    // Check if they are friends/connections
    const connectionResponse = await this.storage.getConnection(userId, resourceUserId);
    return connectionResponse.success && connectionResponse.data?.status === 'accepted';
  }

  protected logError(method: string, error: any, context?: any) {
    console.error(`[${this.constructor.name}.${method}] Error:`, error);
    if (context) {
      console.error('Context:', context);
    }
  }
}
