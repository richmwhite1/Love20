import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import adminRoutes from "./admin-routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { auth } from "./firebase-db";
import { 
  createPostSchema, createPostRequestSchema, createCommentSchema, createListSchema, 
  createFriendshipSchema, createHashtagSchema, createReportSchema, createNotificationSchema,
  createListAccessSchema, respondListAccessSchema, createAccessRequestSchema,
  type AdditionalPhotoData, users, posts, lists, comments, postLikes, postShares, friendships, friendRequests, 
  hashtags, postHashtags, hashtagFollows, notifications, reports, blacklist, rsvps, postViews, savedPosts, 
  reposts, postFlags, taggedPosts, postEnergyRatings, profileEnergyRatings, taskAssignments, listAccess, accessRequests,
  moderationActions
} from "@shared/schema";
import { db } from "./firebase-db";
import { eq, desc, and, or, sql, like, exists, not, inArray, count, avg } from 'drizzle-orm';
import { 
  userService, 
  postService, 
  listService, 
  notificationService, 
  privacyService,
  auditService
} from "./services";
import { FeedService } from "./services/feed-service"; 
const feedService = FeedService.getInstance();
import { FeedTypeEnum, FeedGenerationContext } from "../shared/feed-schema";
import { getDoc, doc } from "firebase/firestore";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Always allow files to pass through - validation will happen later
    cb(null, true);
  }
});

// Middleware to verify Firebase token
const authenticateFirebaseToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      userId: decodedToken.uid,
      username: decodedToken.email?.split('@')[0] || decodedToken.uid
    };
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Helper function to save uploaded files
function saveUploadedFile(file: Express.Multer.File): string {
  const fileName = `${Date.now()}-${file.originalname}`;
  const filePath = path.join(process.cwd(), 'uploads', fileName);
  
  // Move file from temp location to uploads directory
  fs.renameSync(file.path, filePath);
  
  return `/uploads/${fileName}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================

  app.get('/api/auth/me', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getCurrentUser(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // USER ROUTES
  // ============================================================================

  // Create new user with default lists (called after Firebase Auth signup)
  app.post('/api/users', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const userData = req.body;
      const response = await userService.createUser(req.user.userId, userData);
      res.status(response.code || 200).json(response);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/user', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getCurrentUser(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const response = await userService.getUserProfile(req.params.id);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/users/:id', authenticateFirebaseToken, async (req: any, res) => {
    try {
      // Ensure user can only delete their own profile
      if (req.user.userId !== req.params.id) {
        return res.status(403).json({ message: 'Cannot delete another user\'s profile' });
      }

      const response = await userService.deleteUser(req.params.id);
      res.status(response.code || 200).json(response);
    } catch (error) {
      console.error('Error deleting user profile:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Profile picture upload route
  app.post('/api/upload-profile-picture', authenticateFirebaseToken, upload.single('profilePicture'), async (req: any, res) => {
    try {
      const response = await userService.uploadProfilePicture(req.user.userId, req.file);
      res.status(response.code || 200).json(response);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // List invitations route
  app.get('/api/user/list-invitations', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getUserListInvitations(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      console.error('Error getting list invitations:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // POST ROUTES
  // ============================================================================

  app.post('/api/posts', authenticateFirebaseToken, upload.fields([
    { name: 'primaryPhoto', maxCount: 1 },
    { name: 'additionalPhotos', maxCount: 10 }
  ]), async (req: any, res) => {
    try {
      const postData = JSON.parse(req.body.postData || '{}');
      const files = req.files ? Object.values(req.files).flat() as Express.Multer.File[] : [];
      
      const response = await postService.createPost(req.user.userId, postData, files);
      res.status(response.code || 200).json(response);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/posts', async (req, res) => {
    try {
      const filters = {
        privacy: req.query.privacy,
        userId: req.query.userId,
        listId: req.query.listId
      };
      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const response = await postService.getPosts(filters, pagination);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/posts/user', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.getPostsByUser(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/posts/:postId', async (req: any, res) => {
    try {
      const response = await postService.getPostById(req.params.postId, (req as any).user?.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/posts/:postId', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.deletePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Post interactions
  app.post('/api/posts/:postId/like', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.likePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/posts/:postId/like', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.unlikePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/posts/:postId/share', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.sharePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/posts/:postId/save', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.savePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/posts/:postId/save', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.unsavePost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/posts/:postId/flag', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.flagPost(req.params.postId, req.user.userId, req.body.reason);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/posts/:postId/view', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await postService.viewPost(req.params.postId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/posts/:postId/stats', async (req, res) => {
    try {
      const response = await postService.getPostStats(req.params.postId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/posts/:postId/views', async (req, res) => {
    try {
      const response = await postService.getPostViews(req.params.postId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // LIST ROUTES
  // ============================================================================

  app.get('/api/lists', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await listService.getMyLists((req as any).user?.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/lists/user/:userId', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await listService.getListsByUser(req.params.userId, (req as any).user?.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/lists', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await listService.createList(req.user.userId, req.body);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/lists/:id', async (req: any, res) => {
    try {
      const response = await listService.getListById(req.params.id, (req as any).user?.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/lists/:id/privacy', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await listService.updateListPrivacy(req.params.id, req.user.userId, req.body.privacyLevel);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // CONNECTION/FRIENDSHIP ROUTES
  // ============================================================================

  app.get('/api/connections', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getConnections(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/friends', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getConnections(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/friend-requests', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getFriendRequests(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/outgoing-friend-requests', authenticateFirebaseToken, async (req: any, res) => {
    try {
      // For now, return empty array since this feature might not be fully implemented
      // This prevents the frontend from crashing when this endpoint is called
      res.status(200).json({ success: true, data: [], code: 200 });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/friends/request', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.sendFriendRequest(req.user.userId, req.body.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/friends/request/:requestId/accept', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.acceptFriendRequest(req.params.requestId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/friends/request/:requestId/reject', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.rejectFriendRequest(req.params.requestId, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/friends/:userId', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.removeFriend(req.user.userId, req.params.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add missing routes that the frontend expects
  app.post('/api/friends/send-request', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.sendFriendRequest(req.user.userId, req.body.friendId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/friend-request/:requestId/respond', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const { action } = req.body;
      if (action === 'accept') {
        const response = await userService.acceptFriendRequest(req.params.requestId, req.user.userId);
        res.status(response.code || 200).json(response);
      } else if (action === 'reject') {
        const response = await userService.rejectFriendRequest(req.params.requestId, req.user.userId);
        res.status(response.code || 200).json(response);
      } else {
        res.status(400).json({ message: 'Invalid action' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // SEARCH ROUTES
  // ============================================================================

  app.get('/api/search/users', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.searchUsers(req.query.q as string, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Add missing hashtag routes
  app.get('/api/hashtags/trending', authenticateFirebaseToken, async (req: any, res) => {
    try {
      // For now, return empty array since hashtag service might not be fully implemented
      res.status(200).json({ success: true, data: [], code: 200 });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/hashtags/followed', authenticateFirebaseToken, async (req: any, res) => {
    try {
      // For now, return empty array since hashtag service might not be fully implemented
      res.status(200).json({ success: true, data: [], code: 200 });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // NOTIFICATION ROUTES
  // ============================================================================

  app.get('/api/notifications', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };
      const response = await notificationService.getNotifications(req.user.userId, pagination);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/notifications/unread-count', authenticateFirebaseToken, async (req: any, res) => {
    // const response = await notificationService.getUnreadCount(req.user.userId);
    // res.status(response.code || 200).json(response);
    res.status(200).json({ success: true, data: 0, code: 200 });
  });

  app.put('/api/notifications/:id/read', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await notificationService.markAsRead(req.params.id, req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // ADDITIONAL ROUTES (keeping some existing logic for now)
  // ============================================================================

  app.get('/api/connection-stories', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getConnectionStories(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/friends/recent-posts', authenticateFirebaseToken, async (req: any, res) => {
    try {
      const response = await userService.getRecentPostsFromConnections(req.user.userId);
      res.status(response.code || 200).json(response);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // ADMIN ROUTES
  // ============================================================================

  app.use('/api/admin', adminRoutes);

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Audit and Privacy Dashboard Routes
  app.get('/api/audit/logs', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 100;
      const startAfter = req.query.startAfter as string;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const response = await auditService.getUserAuditLogs(userId, limit, startAfter);
      res.json(response);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      res.status(500).json({ success: false, message: 'Failed to get audit logs' });
    }
  });

  app.get('/api/audit/privacy-dashboard', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const response = await auditService.getPrivacyDashboard(userId);
      res.json(response);
    } catch (error) {
      console.error('Error getting privacy dashboard:', error);
      res.status(500).json({ success: false, message: 'Failed to get privacy dashboard' });
    }
  });

  app.get('/api/audit/export-data', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const response = await auditService.exportUserData(userId);
      res.json(response);
    } catch (error) {
      console.error('Error exporting user data:', error);
      res.status(500).json({ success: false, message: 'Failed to export user data' });
    }
  });

  app.get('/api/audit/suspicious-activity', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const response = await auditService.getSuspiciousActivityPatterns(userId);
      res.json(response);
    } catch (error) {
      console.error('Error getting suspicious activity:', error);
      res.status(500).json({ success: false, message: 'Failed to get suspicious activity' });
    }
  });

  // Feed routes
  app.get('/api/feed/:feedType', authenticateFirebaseToken, async (req, res) => {
    try {
      const { feedType } = req.params;
      const { cursor, pageSize = 20 } = req.query;
      const userId = req.user?.uid;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      if (!Object.values(FeedTypeEnum).includes(feedType as FeedTypeEnum)) {
        return res.status(400).json({ success: false, error: 'Invalid feed type' });
      }

      const result = await feedService.getFeed(
        userId,
        feedType as FeedTypeEnum,
        parseInt(pageSize as string),
        cursor as string
      );

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Error getting feed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get feed' 
      });
    }
  });

  app.get('/api/feed/preferences', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const result = await feedService.getUserFeedPreferences(userId);
      res.json(result);
    } catch (error) {
      console.error('Error getting feed preferences:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get feed preferences' 
      });
    }
  });

  app.put('/api/feed/preferences', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const result = await feedService.updateUserFeedPreferences(userId, req.body);
      res.json(result);
    } catch (error) {
      console.error('Error updating feed preferences:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update feed preferences' 
      });
    }
  });

  app.post('/api/feed/generate', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { feedType, postId } = req.body;
      
      if (!feedType || !Object.values(FeedTypeEnum).includes(feedType)) {
        return res.status(400).json({ success: false, error: 'Invalid feed type' });
      }

      const result = await feedService.generateFeedForUser(userId, feedType, postId);
      res.json(result);
    } catch (error) {
      console.error('Error generating feed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate feed' 
      });
    }
  });

  app.post('/api/feed/jobs', authenticateFirebaseToken, async (req, res) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const { feedType, postId, affectedUserIds, priority } = req.body;
      
      if (!feedType || !Object.values(FeedTypeEnum).includes(feedType)) {
        return res.status(400).json({ success: false, error: 'Invalid feed type' });
      }

      const context: FeedGenerationContext = {
        userId,
        feedType,
        postId,
        affectedUserIds,
        priority
      };

      const result = await feedService.createFeedGenerationJob(context);
      res.json(result);
    } catch (error) {
      console.error('Error creating feed job:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create feed job' 
      });
    }
  });

  app.post('/api/feed/jobs/process', authenticateFirebaseToken, async (req, res) => {
    try {
      // Only allow admin users to process jobs
      const user = req.user;
      if (!user?.uid) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      // Check if user is admin (you'll need to implement this check based on your admin system)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      if (!userData?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const result = await feedService.processFeedGenerationJobs();
      res.json(result);
    } catch (error) {
      console.error('Error processing feed jobs:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process feed jobs' 
      });
    }
  });

  app.post('/api/feed/cleanup', authenticateFirebaseToken, async (req, res) => {
    try {
      // Only allow admin users to cleanup
      const user = req.user;
      if (!user?.uid) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      if (!userData?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const result = await feedService.cleanupOldFeedData();
      res.json(result);
    } catch (error) {
      console.error('Error cleaning up feed data:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cleanup feed data' 
      });
    }
  });

  const server = createServer(app);
  return server;
}
