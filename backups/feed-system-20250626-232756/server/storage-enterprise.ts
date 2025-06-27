import { users, type User, type InsertUser, type UserWithFriends, posts, type Post, type PostWithUser, type InsertPost, 
  lists, type List, type ListWithPosts, type InsertList, comments, type Comment, type CommentWithUser, type InsertComment, 
  hashtags, type Hashtag, postHashtags, postLikes, friendRequests, friendships, notifications, type Notification, type CreateNotificationData,
  blacklist, reports, postTags, taggedPosts, profileEnergyRatings, postEnergyRatings, rsvps, hashtagFollows, urlClicks } from "@shared/schema";
import { db } from "./firebase-db";
import { AuditService } from "./services/audit-service";

// Firebase-specific type overrides for string IDs
type FirebaseUser = Omit<User, 'id'> & { id: string };
type FirebaseList = Omit<List, 'id' | 'userId'> & { id: string; userId: string; deletedAt?: Date | null };
type FirebasePost = Omit<Post, 'id' | 'userId' | 'listId'> & { id: string; userId: string; listId?: string };
type FirebaseComment = Omit<Comment, 'id' | 'postId' | 'userId'> & { id: string; postId: string; userId: string };
type FirebaseHashtag = Omit<Hashtag, 'id'> & { id: string };
type FirebasePostWithUser = Omit<PostWithUser, 'id' | 'userId' | 'user'> & { 
  id: string; 
  userId: string; 
  user: Pick<FirebaseUser, 'id' | 'username' | 'name' | 'profilePictureUrl'>;
};
type FirebaseListWithPosts = Omit<ListWithPosts, 'id' | 'userId'> & { 
  id: string; 
  userId: string; 
  posts: FirebasePostWithUser[];
};
type FirebaseCommentWithUser = Omit<CommentWithUser, 'id' | 'postId' | 'userId' | 'user'> & { 
  id: string; 
  postId: string; 
  userId: string; 
  user: Pick<FirebaseUser, 'id' | 'username' | 'name' | 'profilePictureUrl'>;
};

// Standardized response type for all methods
type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  message?: string;
};

// Helper function to safely cast Firestore data to Firebase types
function castToFirebaseList(data: any, id: string, userId: string): FirebaseListWithPosts {
  return {
    id,
    userId,
    name: data.name || '',
    description: data.description || null,
    isPublic: data.isPublic || false,
    privacyLevel: data.privacyLevel || 'public',
    createdAt: data.createdAt?.toDate() || new Date(),
    posts: [],
    postCount: 0,
    ...data
  };
}

function castToFirebasePostWithUser(data: any, id: string, userId: string, user: any): FirebasePostWithUser {
  return {
    id,
    userId,
    listId: data.listId || undefined,
    primaryPhotoUrl: data.primaryPhotoUrl || '',
    primaryLink: data.primaryLink || '',
    linkLabel: data.linkLabel || null,
    primaryDescription: data.primaryDescription || '',
    discountCode: data.discountCode || null,
    additionalPhotos: data.additionalPhotos || [],
    additionalPhotoData: data.additionalPhotoData || null,
    spotifyUrl: data.spotifyUrl || null,
    spotifyLabel: data.spotifyLabel || null,
    youtubeUrl: data.youtubeUrl || null,
    youtubeLabel: data.youtubeLabel || null,
    mediaMetadata: data.mediaMetadata || null,
    privacy: data.privacy || 'public',
    engagement: data.engagement || 0,
    isEvent: data.isEvent || false,
    eventDate: data.eventDate?.toDate() || null,
    reminders: data.reminders || [],
    isRecurring: data.isRecurring || false,
    recurringType: data.recurringType || null,
    taskList: data.taskList || null,
    attachedLists: data.attachedLists || [],
    allowRsvp: data.allowRsvp || false,
    createdAt: data.createdAt?.toDate() || new Date(),
    user: {
      id: user?.id || userId,
      username: user?.username || 'Unknown User',
      name: user?.name || 'Unknown User',
      profilePictureUrl: user?.profilePictureUrl || null
    },
    ...data
  };
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<ApiResponse<FirebaseUser>>;
  getUserByUsername(username: string): Promise<ApiResponse<FirebaseUser>>;
  createUser(user: InsertUser): Promise<ApiResponse<FirebaseUser>>;
  getUserWithFriends(id: string): Promise<ApiResponse<UserWithFriends>>;
  searchUsers(query: string): Promise<ApiResponse<FirebaseUser[]>>;
  updateUser(userId: string, updates: Partial<FirebaseUser>): Promise<ApiResponse<null>>;
  updateUserPrivacy(userId: string, privacy: string): Promise<ApiResponse<null>>;
  deleteUser(userId: string): Promise<ApiResponse<null>>;

  // List methods - Enterprise Scale
  createList(list: InsertList & { userId: string }): Promise<ApiResponse<FirebaseList>>;
  getListsByUserId(userId: string): Promise<ApiResponse<FirebaseListWithPosts[]>>;
  getList(id: string, viewerId?: string): Promise<ApiResponse<FirebaseListWithPosts>>;
  getListWithPosts(id: string): Promise<ApiResponse<FirebaseListWithPosts>>;
  getListsWithAccess(viewerId?: string): Promise<ApiResponse<FirebaseListWithPosts[]>>;
  updateListPrivacy(listId: string, privacyLevel: string): Promise<ApiResponse<null>>;
  deleteList(listId: string): Promise<ApiResponse<null>>;
  getListWithCreator(id: string): Promise<ApiResponse<any>>;
  getListById(listId: string): Promise<ApiResponse<FirebaseList>>;
  
  // List access control - Enterprise Collaboration
  inviteToList(listId: string, userId: string, role: string, invitedBy: string): Promise<ApiResponse<null>>;
  addListCollaborator(listId: string, userId: string, role: string, invitedBy: string): Promise<ApiResponse<null>>;
  respondToListInvite(accessId: string, action: string): Promise<ApiResponse<null>>;
  respondToListInviteByUserAndList(userId: string, listId: string, action: string): Promise<ApiResponse<null>>;
  getListAccess(listId: string): Promise<ApiResponse<Array<{ userId: string; role: string; status: string; user: any }>>>;
  getUserListAccess(userId: string): Promise<ApiResponse<Array<{ listId: string; role: string; status: string; list: any }>>>;
  getPendingListInvitations(userId: string): Promise<ApiResponse<Array<{ listId: string; role: string; status: string; list: any; invitedBy: any }>>>;
  hasListAccess(userId: string, listId: string): Promise<ApiResponse<{ hasAccess: boolean; role?: string }>>;
  removeListAccess(listId: string, userId: string): Promise<ApiResponse<null>>;
  createAccessRequest(listId: string, userId: string, requestedRole: string, message?: string): Promise<ApiResponse<null>>;
  getAccessRequests(listId: string): Promise<ApiResponse<Array<{ id: string; userId: string; requestedRole: string; message?: string; user: any }>>>;
  respondToAccessRequest(requestId: string, action: string): Promise<ApiResponse<null>>;
  
  // Post methods - Content Management
  createPost(post: InsertPost & { userId: string; listId?: string; hashtags?: string[]; taggedUsers?: string[] }): Promise<ApiResponse<FirebasePost>>;
  getPost(id: string): Promise<ApiResponse<FirebasePostWithUser>>;
  getAllPosts(viewerId?: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getPostsByUserId(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getPostsByListId(listId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getPostsByHashtag(hashtagName: string, viewerId?: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getPostsByMultipleHashtags(hashtagNames: string[]): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getPostsByPrivacy(privacy: string, userId?: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  deletePost(postId: string): Promise<ApiResponse<null>>;
  updatePost(postId: string, updates: Partial<FirebasePost>): Promise<ApiResponse<null>>;
  getTaggedPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;
  getFriendsPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;

  // Engagement - Likes, Shares, Views
  likePost(postId: string, userId: string): Promise<ApiResponse<null>>;
  unlikePost(postId: string, userId: string): Promise<ApiResponse<null>>;
  isPostLiked(postId: string, userId: string): Promise<ApiResponse<boolean>>;
  getPostLikeCount(postId: string): Promise<ApiResponse<number>>;
  getUserLike(postId: string, userId: string): Promise<ApiResponse<boolean>>;
  sharePost(postId: string, userId: string): Promise<ApiResponse<null>>;
  getPostShareCount(postId: string): Promise<ApiResponse<number>>;
  getUserTotalShares(userId: string): Promise<ApiResponse<number>>;
  recordPostView(postId: string, userId?: string): Promise<ApiResponse<null>>;
  getPostViewCount(postId: string): Promise<ApiResponse<number>>;
  trackView(postId: string, userId: string): Promise<ApiResponse<null>>;
  getPostViews(postId: string): Promise<ApiResponse<number>>;

  // Repost system
  repost(postId: string, userId: string): Promise<ApiResponse<null>>;
  unrepost(postId: string, userId: string): Promise<ApiResponse<null>>;
  isReposted(postId: string, userId: string): Promise<ApiResponse<boolean>>;
  getReposts(postId: string): Promise<ApiResponse<number>>;
  repostPost(postId: string, userId: string): Promise<ApiResponse<null>>;

  // Save system
  savePost(postId: string, userId: string): Promise<ApiResponse<null>>;
  unsavePost(postId: string, userId: string): Promise<ApiResponse<null>>;
  isSaved(postId: string, userId: string): Promise<ApiResponse<boolean>>;
  getSavedPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;

  // Comments
  createComment(comment: InsertComment & { postId: string; userId: string }): Promise<ApiResponse<FirebaseComment>>;
  getCommentsByPostId(postId: string): Promise<ApiResponse<FirebaseCommentWithUser[]>>;
  deleteComment(commentId: string): Promise<ApiResponse<null>>;

  // Hashtag system - Discovery & Following
  createHashtag(name: string): Promise<ApiResponse<FirebaseHashtag>>;
  getHashtagsByPostId(postId: string): Promise<ApiResponse<FirebaseHashtag[]>>;
  getTrendingHashtags(limit?: number): Promise<ApiResponse<FirebaseHashtag[]>>;
  followHashtag(userId: string, hashtagId: string): Promise<ApiResponse<null>>;
  unfollowHashtag(userId: string, hashtagId: string): Promise<ApiResponse<null>>;
  getFollowedHashtags(userId: string): Promise<ApiResponse<FirebaseHashtag[]>>;
  isFollowingHashtag(userId: string, hashtagId: string): Promise<ApiResponse<boolean>>;

  // Tagging system
  tagFriendInPost(postId: string, userId: string, taggedUserId: string): Promise<void>;
  tagFriendsToPost(postId: string, friendIds: string[], taggedBy: string): Promise<void>;

  // Moderation & Safety
  flagPost(postId: string, userId: string, reason: string, comment?: string): Promise<void>;
  unflagPost(postId: string, userId: string): Promise<void>;
  getPostFlags(postId: string): Promise<any[]>;
  checkAutoDelete(postId: string): Promise<boolean>;
  createReport(report: any): Promise<any>;
  getReports(): Promise<any[]>;
  deleteReport(reportId: string): Promise<void>;
  flagUser(userId: string, flaggedBy: string, reason: string): Promise<void>;
  unflagUser(userId: string): Promise<void>;

  // Analytics & Stats
  getPostStats(postId: string): Promise<ApiResponse<{ likeCount: number; commentCount: number; shareCount: number; viewCount: number }>>;
  getUserEnergyStats(userId: string): Promise<ApiResponse<{ average: number; count: number }>>;
  getAnalytics(): Promise<ApiResponse<any>>;

  // Social Network - Connections (formerly Friends)
  getConnectionsWithRecentPosts(userId: string): Promise<ApiResponse<Array<{ user: FirebaseUser; hasRecentPosts: boolean }>>>;
  getConnections(userId: string): Promise<ApiResponse<FirebaseUser[]>>;
  getConnectionsOrderedByRecentTags(userId: string): Promise<ApiResponse<FirebaseUser[]>>;
  sendConnectionRequest(fromUserId: string, toUserId: string): Promise<ApiResponse<null>>;
  getConnectionRequests(userId: string): Promise<ApiResponse<any[]>>;
  getOutgoingConnectionRequests(userId: string): Promise<ApiResponse<Array<{ id: string; toUser: FirebaseUser; createdAt: Date }>>>;
  respondToConnectionRequest(requestId: string, action: 'accept' | 'reject'): Promise<ApiResponse<null>>;
  areConnected(userId1: string, userId2: string): Promise<ApiResponse<boolean>>;
  getConnectionsPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>>;

  // Events & RSVP
  getRsvp(eventId: string, userId: string): Promise<ApiResponse<any>>;
  createRsvp(eventId: string, userId: string, status: string): Promise<ApiResponse<null>>;
  updateRsvp(eventId: string, userId: string, status: string): Promise<ApiResponse<null>>;
  getRsvpStats(eventId: string): Promise<ApiResponse<{ going: number; maybe: number; notGoing: number }>>;
  getRsvpList(eventId: string, status?: string): Promise<ApiResponse<Array<{ user: FirebaseUser; status: string }>>>;

  // Notifications
  createNotification(notification: CreateNotificationData): Promise<any>;
  getNotifications(userId: string): Promise<any[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markNotificationAsViewed(notificationId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Privacy & Blocking
  getBlacklist(userId: string): Promise<any[]>;
  addToBlacklist(userId: string, blockedUserId: string): Promise<void>;
  getSharedWithMePosts(userId: string): Promise<FirebasePostWithUser[]>;
  markTaggedPostViewed(postId: string, userId: string): Promise<void>;

  // Energy Rating System
  getPostEnergyStats(postId: string): Promise<{ average: number; count: number }>;
  getUserPostEnergyRating(postId: string, userId: string): Promise<number | null>;
  submitPostEnergyRating(postId: string, userId: string, rating: number): Promise<void>;
  getProfileEnergyStats(profileId: string): Promise<{ average: number; count: number }>;
  getUserProfileEnergyRating(profileId: string, userId: string): Promise<number | null>;
  submitProfileEnergyRating(profileId: string, userId: string, rating: number): Promise<void>;

  // Get attached lists for a post
  getAttachedListsByPostId(postId: string): Promise<Array<{ id: string; name: string; userId: string; user?: { username: string } }>>;

  // Missing methods that routes are calling
  getConnectionStories(userId: string): Promise<any[]>;
  getUserListInvitations(userId: string): Promise<any[]>;
  getFriendsRecentPosts(userId: string): Promise<FirebasePostWithUser[]>;

  // Additional methods needed by routes
  isPostLikedByUser(postId: string, userId: string): Promise<boolean>;
  trackPostView(postId: string, userId: string): Promise<void>;
}

export class EnterpriseStorage implements IStorage {
  private auditService = new AuditService();

  // Helper methods for creating standardized responses
  private createSuccessResponse<T>(data?: T): ApiResponse<T> {
    return {
      success: true,
      data,
      message: 'Operation completed successfully'
    };
  }

  private createErrorResponse(message: string, code?: number): ApiResponse {
    return {
      success: false,
      error: message,
      message,
      code
    };
  }

  // CORE USER METHODS
  async getUser(id: string): Promise<ApiResponse<FirebaseUser>> {
    try {
      const userDoc = await db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (!userData) return { success: false, error: 'User data not found' };
        return { success: true, data: { id: userDoc.id, ...userData } as FirebaseUser };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: 'Error getting user' };
    }
  }

  async getUserByUsername(username: string): Promise<ApiResponse<FirebaseUser>> {
    try {
      const userSnap = await db.collection('users').where('username', '==', username).limit(1).get();
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        if (!userData) return { success: false, error: 'User data not found' };
        return { success: true, data: { id: userSnap.docs[0].id, ...userData } as FirebaseUser };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Error getting user by username:', error);
      return { success: false, error: 'Error getting user by username' };
    }
  }

  async createUser(insertUser: InsertUser): Promise<ApiResponse<FirebaseUser>> {
    try {
      const userRef = await db.collection('users').add({
        ...insertUser,
        createdAt: new Date(),
        deletedAt: null
      });
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      if (!userData) throw new Error('Failed to create user - no data returned');
      const user = { id: userDoc.id, ...userData } as FirebaseUser;
      // Auto-create General list for new user
      await this.createList({
        userId: user.id,
        name: 'General',
        description: 'Default list for all posts',
        privacyLevel: 'public',
        isPublic: true
      });
      return { success: true, data: user };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: 'Error creating user' };
    }
  }

  async getUserWithFriends(id: string): Promise<ApiResponse<UserWithFriends>> {
    try {
      const userDoc = await db.collection('users').doc(id).get();
      if (!userDoc.exists) {
        return { success: false, error: 'User not found' };
      }
      const userData = userDoc.data();
      if (!userData) {
        return { success: false, error: 'User data not found' };
      }
      const connectionsResponse = await this.getConnections(id);
      const friends = (connectionsResponse.success && connectionsResponse.data ? connectionsResponse.data : []).map(f => ({
        id: f.id,
        username: f.username,
        name: f.name,
        profilePictureUrl: f.profilePictureUrl ?? null
      }));
      const userWithFriends: UserWithFriends = {
        id: userDoc.id,
        username: userData.username,
        password: userData.password,
        name: userData.name,
        profilePictureUrl: userData.profilePictureUrl ?? null,
        defaultPrivacy: userData.defaultPrivacy,
        auraRating: userData.auraRating ?? null,
        ratingCount: userData.ratingCount ?? null,
        createdAt: userData.createdAt,
        deletedAt: userData.deletedAt ?? null,
        friends,
        friendCount: friends.length
      };
      return { success: true, data: userWithFriends };
    } catch (error) {
      console.error('Error getting user with friends:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchUsers(query: string): Promise<ApiResponse<FirebaseUser[]>> {
    try {
      // Search by username (case-insensitive)
      const usersSnapshot = await db.collection('users')
        .orderBy('username')
        .startAt(query.toLowerCase())
        .endAt(query.toLowerCase() + '\uf8ff')
        .limit(10)
        .get();

      const users: FirebaseUser[] = [];
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        users.push({
          id: doc.id,
          ...userData
        } as FirebaseUser);
      }

      // Also search by display name if username search didn't find enough results
      if (users.length < 10) {
        const nameSnapshot = await db.collection('users')
          .orderBy('displayName')
          .startAt(query)
          .endAt(query + '\uf8ff')
          .limit(10 - users.length)
          .get();

        for (const doc of nameSnapshot.docs) {
          const userData = doc.data();
          const existingUser = users.find(u => u.id === doc.id);
          if (!existingUser) {
            users.push({
              id: doc.id,
              ...userData
            } as FirebaseUser);
          }
        }
      }

      return { success: true, data: users };
    } catch (error) {
      console.error('Error searching users:', error);
      return { success: false, error: 'Error searching users' };
    }
  }

  async updateUser(userId: string, updates: Partial<FirebaseUser>): Promise<ApiResponse<null>> {
    try {
      await db.collection('users').doc(userId).update({
        ...updates,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: 'Error updating user' };
    }
  }

  async updateUserPrivacy(userId: string, privacy: string): Promise<ApiResponse<null>> {
    try {
      // Get current privacy setting for audit log
      const userDoc = await db.collection('users').doc(userId).get();
      const oldPrivacy = userDoc.exists ? userDoc.data()?.privacy || 'public' : 'public';

      await db.collection('users').doc(userId).update({
        privacy,
        updatedAt: new Date()
      });

      // Log privacy change for audit
      await this.auditService.logPrivacyChange(
        userId,
        'privacy',
        oldPrivacy,
        privacy
      );

      return this.createSuccessResponse(null);
    } catch (error) {
      console.error('Error updating user privacy:', error);
      return this.createErrorResponse('Failed to update user privacy');
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('users').doc(userId).update({
        deletedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: 'Error deleting user' };
    }
  }

  // ENTERPRISE LIST MANAGEMENT
  async createList(list: InsertList & { userId: string }): Promise<ApiResponse<FirebaseList>> {
    try {
      const privacyLevel = list.privacyLevel || 'public';
      const createdAt = new Date();
      const docRef = await db.collection('lists').add({
        ...list,
        privacyLevel,
        createdAt,
        deletedAt: null
      });
      return { success: true, data: {
        ...list,
        id: docRef.id,
        privacyLevel,
        createdAt,
        deletedAt: null,
        description: list.description ?? null,
        isPublic: list.isPublic ?? false,
        userId: list.userId
      } as FirebaseList };
    } catch (error) {
      console.error('Error creating list:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getListsByUserId(userId: string): Promise<ApiResponse<FirebaseListWithPosts[]>> {
    try {
      // Get all lists owned by the user
      let listsSnapshot = await db.collection('lists').where('userId', '==', userId).get();
      let lists: FirebaseListWithPosts[] = [];
      for (const doc of listsSnapshot.docs) {
        const list = doc.data();
        // Only include lists that are not deleted (if you have a deletedAt field)
        if (!list.deletedAt) {
          lists.push(castToFirebaseList(list, doc.id, userId));
        }
      }
      // If no lists found, auto-create General list and refetch
      if (lists.length === 0) {
        await this.createList({
          userId,
          name: 'General',
          description: 'Default list for all posts',
          privacyLevel: 'public',
          isPublic: true
        });
        // Refetch lists
        listsSnapshot = await db.collection('lists').where('userId', '==', userId).get();
        for (const doc of listsSnapshot.docs) {
          const list = doc.data();
          if (!list.deletedAt) {
            lists.push(castToFirebaseList(list, doc.id, userId));
          }
        }
      }
      return { success: true, data: lists };
    } catch (error) {
      console.error('getListsByUserId error:', error);
      throw error;
    }
  }

  async getList(listId: string, viewerId?: string): Promise<ApiResponse<FirebaseListWithPosts>> {
    try {
      const listDoc = await db.collection('lists').doc(listId).get();
      if (!listDoc.exists) return { success: false, error: 'List not found' };
      const listData = listDoc.data();
      if (!listData) return { success: false, error: 'List data not found' };
      // Privacy check: allow if public, or if owner, or if viewer is in access subcollection
      if (listData.privacyLevel === 'public' || listData.userId === viewerId) {
        return { success: true, data: castToFirebaseList(listData, listDoc.id, listData?.userId || '') };
      }
      // Check if viewer has access (if privacyLevel is 'connections' or 'private')
      if (viewerId) {
        const accessDoc = await db.collection('lists').doc(listId).collection('access').doc(viewerId).get();
        if (accessDoc.exists) {
          return { success: true, data: castToFirebaseList(listData, listDoc.id, listData?.userId || '') };
        }
      }
      // Otherwise, no access
      return { success: false, error: 'No access to this list' };
    } catch (error) {
      console.error('Error getting list:', error);
      return { success: false, error: 'Error getting list' };
    }
  }

  async getListById(listId: string): Promise<ApiResponse<FirebaseList>> {
    try {
      const listDoc = await db.collection('lists').doc(listId).get();
      if (!listDoc.exists) {
        return { success: false, error: 'List not found' };
      }
      const listData = listDoc.data();
      return { success: true, data: castToFirebaseList(listData, listDoc.id, listData?.userId || '') };
    } catch (error) {
      console.error('Error getting list by ID:', error);
      return { success: false, error: 'Error getting list by ID' };
    }
  }

  async getListWithCreator(id: string): Promise<ApiResponse<any>> {
    try {
      const listDoc = await db.collection('lists').doc(id).get();
      if (!listDoc.exists) {
        return { success: false, error: 'List not found' };
      }
      
      const listData = listDoc.data();
      if (!listData) {
        return { success: false, error: 'List data not found' };
      }
      
      // Get the creator user
      const creatorResponse = await this.getUser(listData.userId);
      const creator = creatorResponse.success ? creatorResponse.data : { id: listData.userId, username: 'Unknown User', name: 'Unknown User' };
      
      return { success: true, data: {
        ...castToFirebaseList(listData, listDoc.id, listData.userId),
        creator: creator
      }};
    } catch (error) {
      console.error('Error getting list with creator:', error);
      return { success: false, error: 'Error getting list with creator' };
    }
  }

  async getListWithPosts(id: string): Promise<ApiResponse<FirebaseListWithPosts>> {
    try {
      const listDoc = await db.collection('lists').doc(id).get();
      if (!listDoc.exists) return { success: false, error: 'List not found' };
      const listData = listDoc.data();
      if (!listData) return { success: false, error: 'List data not found' };
      const postsSnapshot = await db.collection('posts').where('listId', '==', id).orderBy('createdAt', 'desc').get();
      const posts: FirebasePostWithUser[] = [];
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        if (!postData) continue;
        const userResponse = await this.getUser(postData.userId);
        const user = userResponse.success && userResponse.data ? userResponse.data : null;
        if (user) {
          posts.push(castToFirebasePostWithUser(postData, postDoc.id, postData.userId, user));
        }
      }
      return { success: true, data: {
        ...castToFirebaseList(listData, listDoc.id, listData.userId),
        posts,
        postCount: posts.length,
        firstPostImage: posts.length > 0 ? posts[0].primaryPhotoUrl : undefined
      }};
    } catch (error) {
      console.error('Error in getListWithPosts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getListsWithAccess(viewerId?: string): Promise<ApiResponse<FirebaseListWithPosts[]>> {
    try {
      if (!viewerId) {
        // Return only public lists for unauthenticated users
        const publicListsSnapshot = await db.collection('lists')
          .where('privacyLevel', '==', 'public')
          .orderBy('createdAt', 'desc')
          .get();

        const lists: FirebaseListWithPosts[] = [];
        for (const doc of publicListsSnapshot.docs) {
          const list = doc.data();
          if (!list.deletedAt) {
            lists.push(castToFirebaseList(list, doc.id, list.userId));
          }
        }
        return { success: true, data: lists };
      }
      
      // For authenticated users, return their own lists plus public lists
      const userListsResponse = await this.getListsByUserId(viewerId);
      return userListsResponse;
    } catch (error) {
      console.error('Error getting lists with access:', error);
      return { success: false, error: 'Error getting lists with access' };
    }
  }

  async updateListPrivacy(listId: string, privacyLevel: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('lists').doc(listId).update({
        privacyLevel,
        updatedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error updating list privacy:', error);
      return { success: false, error: 'Error updating list privacy' };
    }
  }

  async deleteList(listId: string): Promise<ApiResponse<null>> {
    try {
      // Soft delete: set deletedAt timestamp
      await db.collection('lists').doc(listId).update({
        deletedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error deleting list:', error);
      return { success: false, error: 'Error deleting list' };
    }
  }

  // LIST ACCESS CONTROL - ENTERPRISE COLLABORATION
  async inviteToList(listId: string, userId: string, role: string, invitedBy: string): Promise<ApiResponse<null>> {
    try {
      // Check if invitation already exists
      const existingInvite = await db.collection('lists').doc(listId)
        .collection('invitations').doc(userId).get();
      
      if (existingInvite.exists) {
        console.log('Invitation already exists for this user');
        return { success: true, data: null, message: 'Invitation already exists' };
      }

      // Create invitation in subcollection
      await db.collection('lists').doc(listId)
        .collection('invitations').doc(userId).set({
          userId,
          role,
          invitedBy,
          status: 'pending',
          createdAt: new Date()
        });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error inviting user to list:', error);
      return { success: false, error: 'Error inviting user to list' };
    }
  }

  async addListCollaborator(listId: string, userId: string, role: string, invitedBy: string): Promise<ApiResponse<null>> {
    try {
      // Add user directly to access subcollection
      await db.collection('lists').doc(listId)
        .collection('access').doc(userId).set({
          userId,
          role,
          addedBy: invitedBy,
          status: 'accepted',
          createdAt: new Date()
        });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error adding list collaborator:', error);
      return { success: false, error: 'Error adding list collaborator' };
    }
  }

  async respondToListInvite(accessId: string, action: string): Promise<ApiResponse<null>> {
    try {
      const status = action === 'accept' ? 'accepted' : 'rejected';
      
      // Find the invitation by accessId (this would need to be implemented differently)
      // For now, we'll use a different approach
      throw new Error('respondToListInvite by accessId not yet implemented - use respondToListInviteByUserAndList instead');
    } catch (error) {
      console.error('Error responding to list invite:', error);
      return { success: false, error: 'Error responding to list invite' };
    }
  }

  async respondToListInviteByUserAndList(userId: string, listId: string, action: string): Promise<ApiResponse<null>> {
    try {
      const status = action === 'accept' ? 'accepted' : 'rejected';
      
      if (action === 'accept') {
        // Move from invitations to access
        const inviteDoc = await db.collection('lists').doc(listId)
          .collection('invitations').doc(userId).get();
        
        if (inviteDoc.exists) {
          const inviteData = inviteDoc.data();
          await db.collection('lists').doc(listId)
            .collection('access').doc(userId).set({
              userId,
              role: inviteData?.role || 'member',
              status: 'accepted',
              createdAt: new Date()
            });
          
          // Delete the invitation
          await db.collection('lists').doc(listId)
            .collection('invitations').doc(userId).delete();
        }
      } else {
        // Just delete the invitation
        await db.collection('lists').doc(listId)
          .collection('invitations').doc(userId).delete();
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error responding to list invite:', error);
      return { success: false, error: 'Error responding to list invite' };
    }
  }

  async getListAccess(listId: string): Promise<ApiResponse<Array<{ userId: string; role: string; status: string; user: any }>>> {
    try {
      const accessSnapshot = await db.collection('lists').doc(listId)
        .collection('access').get();
      
      const accessList = [];
      for (const doc of accessSnapshot.docs) {
        const accessData = doc.data();
        const userResponse = await this.getUser(accessData.userId);
        const user = userResponse.success && userResponse.data ? userResponse.data : { id: accessData.userId, username: 'Unknown User', name: 'Unknown User' };
        accessList.push({
          userId: accessData.userId,
          role: accessData.role,
          status: accessData.status,
          user: user
        });
      }
      return { success: true, data: accessList };
    } catch (error) {
      console.error('Error getting list access:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getUserListAccess(userId: string): Promise<ApiResponse<Array<{ listId: string; role: string; status: string; list: any }>>> {
    try {
      // This is more complex in Firestore - we'd need to query across all lists
      // For now, return empty array - this could be optimized with a separate collection
      return { success: true, data: [] };
    } catch (error) {
      console.error('Error getting user list access:', error);
      return { success: false, error: 'Error getting user list access' };
    }
  }

  async getPendingListInvitations(userId: string): Promise<ApiResponse<Array<{ listId: string; role: string; status: string; list: any; invitedBy: any }>>> {
    try {
      // This is complex in Firestore - we'd need to query across all lists
      // For now, return empty array - this could be optimized with a separate collection
      return { success: true, data: [] };
    } catch (error) {
      console.error('Error getting pending list invitations:', error);
      return { success: false, error: 'Error getting pending list invitations' };
    }
  }

  async hasListAccess(userId: string, listId: string): Promise<ApiResponse<{ hasAccess: boolean; role?: string }>> {
    try {
      // Check if user is the list owner
      const listDoc = await db.collection('lists').doc(listId).get();
      if (listDoc.exists) {
        const listData = listDoc.data();
        if (listData?.userId === userId) {
          return { success: true, data: { hasAccess: true, role: 'owner' } };
        }
      }

      // Check if user has access in subcollection
      const accessDoc = await db.collection('lists').doc(listId)
        .collection('access').doc(userId).get();
      
      if (accessDoc.exists) {
        const accessData = accessDoc.data();
        return { success: true, data: { hasAccess: true, role: accessData?.role } };
      }

      return { success: true, data: { hasAccess: false } };
    } catch (error) {
      console.error('Error checking list access:', error);
      return { success: false, error: 'Error checking list access' };
    }
  }

  async removeListAccess(listId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('lists').doc(listId)
        .collection('access').doc(userId).delete();
      return { success: true, data: null };
    } catch (error) {
      console.error('Error removing list access:', error);
      return { success: false, error: 'Error removing list access' };
    }
  }

  async createAccessRequest(listId: string, userId: string, requestedRole: string, message?: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('lists').doc(listId)
        .collection('accessRequests').doc(userId).set({
          userId,
          requestedRole,
          message: message || '',
          status: 'pending',
          createdAt: new Date()
        });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error creating access request:', error);
      return { success: false, error: 'Error creating access request' };
    }
  }

  async getAccessRequests(listId: string): Promise<ApiResponse<Array<{ id: string; userId: string; requestedRole: string; message?: string; user: any }>>> {
    try {
      const requestsSnapshot = await db.collection('lists').doc(listId)
        .collection('accessRequests').get();
      
      const requests = [];
      for (const doc of requestsSnapshot.docs) {
        const requestData = doc.data();
        const userResponse = await this.getUser(requestData.userId);
        const user = userResponse.success ? userResponse.data : { id: requestData.userId, username: 'Unknown User', name: 'Unknown User' };
        requests.push({
          id: doc.id,
          userId: requestData.userId,
          requestedRole: requestData.requestedRole,
          message: requestData.message,
          user: user
        });
      }
      return { success: true, data: requests };
    } catch (error) {
      console.error('Error getting access requests:', error);
      return { success: false, error: 'Error getting access requests' };
    }
  }

  async respondToAccessRequest(requestId: string, action: string): Promise<ApiResponse<null>> {
    try {
      const requestDoc = await db.collection('friendRequests').doc(requestId).get();
      if (!requestDoc.exists) {
        return { success: false, error: 'Connection request not found' };
      }

      const requestData = requestDoc.data();
      if (!requestData) {
        return { success: false, error: 'Request data not found' };
      }

      if (action === 'accept') {
        // Create friendship
        await db.collection('friendships').add({
          userId1: requestData.fromUserId,
          userId2: requestData.toUserId,
          createdAt: new Date()
        });

        // Create reverse friendship for bidirectional access
        await db.collection('friendships').add({
          userId1: requestData.toUserId,
          userId2: requestData.fromUserId,
          createdAt: new Date()
        });
      }

      // Update request status
      await db.collection('friendRequests').doc(requestId).update({
        status: action === 'accept' ? 'accepted' : 'rejected',
        respondedAt: new Date()
      });

      // Log friendship response for audit
      await this.auditService.logFriendshipActivity(
        requestData.toUserId,
        action === 'accept' ? 'friend_accept' : 'friend_reject',
        requestData.fromUserId
      );

      return { success: true, data: null };
    } catch (error) {
      console.error('Error responding to connection request:', error);
      return { success: false, error: 'Error responding to connection request' };
    }
  }

  // CONTENT MANAGEMENT - BULLETPROOF PRIVACY
  async createPost(postData: InsertPost & { 
    userId: string; 
    listId?: string; 
    hashtags?: string[]; 
    taggedUsers?: string[];
    privacy?: string;
    additionalPhotoData?: any;
    mediaMetadata?: any;
    reminders?: string[];
    isRecurring?: boolean;
    recurringType?: string;
    taskList?: any[];
    attachedLists?: string[];
  }): Promise<ApiResponse<FirebasePost>> {
    try {
      const postRef = await db.collection('posts').add({
        ...postData,
        userId: postData.userId,
        createdAt: new Date(),
        engagement: 0
      });
      
      const postDoc = await postRef.get();
      const createdPostData = postDoc.data();
      
      if (!createdPostData) {
        throw new Error('Failed to create post - no data returned');
      }
      
      return {
        success: true,
        data: {
          id: postDoc.id,
          ...createdPostData,
          userId: postData.userId
        } as FirebasePost
      };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  private async getOrCreateHashtag(name: string): Promise<FirebaseHashtag> {
    try {
      // Check if hashtag already exists
      const hashtagQuery = await db.collection('hashtags').where('name', '==', name).limit(1).get();
      
      if (!hashtagQuery.empty) {
        const doc = hashtagQuery.docs[0];
        const data = doc.data();
        return { 
          id: doc.id, 
          name: data.name,
          createdAt: data.createdAt || new Date(),
          count: data.count || 0
        } as FirebaseHashtag;
      }
      
      // Create new hashtag
      const hashtagData = {
        name,
        createdAt: new Date(),
        count: 0
      };
      const hashtagRef = await db.collection('hashtags').add(hashtagData);
      const hashtagDoc = await hashtagRef.get();
      const data = hashtagDoc.data();
      return { 
        id: hashtagDoc.id, 
        name: data?.name || name,
        createdAt: data?.createdAt || new Date(),
        count: data?.count || 0
      } as FirebaseHashtag;
    } catch (error) {
      console.error('Error getting or creating hashtag:', error);
      throw error;
    }
  }

  async getPost(id: string): Promise<ApiResponse<FirebasePostWithUser>> {
    try {
      const postDoc = await db.collection('posts').doc(id).get();
      
      if (!postDoc.exists) {
        return { success: false, error: 'Post not found' };
      }
      
      const postData = postDoc.data();
      
      if (!postData) {
        return { success: false, error: 'Post data not found' };
      }
      
      // Get user data
      let userData = null;
      if (postData.userId) {
        const userDoc = await db.collection('users').doc(postData.userId).get();
        userData = userDoc.data();
      }
      
      return {
        success: true,
        data: castToFirebasePostWithUser(postData, postDoc.id, postData.userId, userData)
      };
    } catch (error) {
      console.error('Error getting post:', error);
      return { success: false, error: 'Error getting post' };
    }
  }

  // BULLETPROOF THREE-TIER PRIVACY SYSTEM
  async getAllPosts(viewerId?: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      console.log('Fetching posts from Firestore for viewerId:', viewerId);
      
      const postsSnapshot = await db.collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      
      const posts: FirebasePostWithUser[] = [];
      
      for (const doc of postsSnapshot.docs) {
        const postData = doc.data();
        
        // Get user data for each post
        let userData = null;
        if (postData.userId) {
          const userDoc = await db.collection('users').doc(postData.userId).get();
          userData = userDoc.data();
        }
        
        posts.push(castToFirebasePostWithUser(postData, doc.id, postData.userId, userData));
      }
      
      console.log(`Found ${posts.length} posts`);
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error fetching posts from Firestore:', error);
      throw error;
    }
  }

  async getPostsByUserId(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const postsSnapshot = await db.collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      const posts: FirebasePostWithUser[] = [];
      for (const doc of postsSnapshot.docs) {
        const postData = doc.data();
        let userData = null;
        if (postData.userId) {
          const userDoc = await db.collection('users').doc(postData.userId).get();
          userData = userDoc.data();
        }
        if (userData) {
          const postWithUser = castToFirebasePostWithUser(postData, doc.id, postData.userId, userData);
          if (postWithUser) {
            posts.push(postWithUser);
          }
        }
      }
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting posts by user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getPostsByListId(listId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const postsSnapshot = await db.collection('posts').where('listId', '==', listId).orderBy('createdAt', 'desc').get();
      const posts: FirebasePostWithUser[] = [];
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        if (!postData) continue;
        const user = await this.getUser(postData.userId);
        if (user.success && user.data) {
          const postWithUser = castToFirebasePostWithUser(postData, postDoc.id, postData.userId, user.data);
          if (postWithUser) posts.push(postWithUser);
        }
      }
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error in getPostsByListId:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getPostsByHashtag(hashtagName: string, viewerId?: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      // First find the hashtag
      const hashtagQuery = await db.collection('hashtags')
        .where('name', '==', hashtagName.toLowerCase())
        .limit(1)
        .get();

      if (hashtagQuery.empty) {
        return { success: false, error: 'Hashtag not found' };
      }

      const hashtagDoc = hashtagQuery.docs[0];
      const hashtagId = hashtagDoc.id;

      // Find posts with this hashtag
      const postHashtagsQuery = await db.collection('postHashtags')
        .where('hashtagId', '==', hashtagId)
        .get();

      const posts: FirebasePostWithUser[] = [];
      
      for (const doc of postHashtagsQuery.docs) {
        const postHashtagData = doc.data();
        const postId = postHashtagData.postId;
        
        if (postId) {
          const post = await this.getPost(postId);
          if (post.success) {
            posts.push(post.data);
          }
        }
      }

      // Sort by creation date (newest first)
      posts.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : 
          (a.createdAt as any)?._seconds ? new Date((a.createdAt as any)._seconds * 1000) : new Date();
        const dateB = b.createdAt instanceof Date ? b.createdAt : 
          (b.createdAt as any)?._seconds ? new Date((b.createdAt as any)._seconds * 1000) : new Date();
        return dateB.getTime() - dateA.getTime();
      });

      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting posts by hashtag:', error);
      return { success: false, error: 'Error getting posts by hashtag' };
    }
  }

  async getPostsByMultipleHashtags(hashtagNames: string[]): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      if (hashtagNames.length === 0) {
        return { success: false, error: 'No hashtags provided' };
      }
      
      // Get all hashtags by name
      const hashtagDocs = await Promise.all(
        hashtagNames.map(name => 
          db.collection('hashtags')
            .where('name', '==', name.toLowerCase())
            .limit(1)
            .get()
        )
      );
      
      const hashtagIds = hashtagDocs
        .map(snapshot => snapshot.docs[0]?.id)
        .filter(id => id);
      
      if (hashtagIds.length === 0) {
        return { success: false, error: 'No matching hashtags found' };
      }
      
      // Get posts that have any of these hashtags
      const postHashtagsSnapshot = await db.collection('postHashtags')
        .where('hashtagId', 'in', hashtagIds)
        .get();
      
      const postIds = Array.from(new Set(postHashtagsSnapshot.docs.map(doc => doc.data().postId)));
      
      if (postIds.length === 0) {
        return { success: false, error: 'No posts found with the given hashtags' };
      }
      
      // Get the actual posts
      const posts = [];
      for (const postId of postIds) {
        const post = await this.getPost(postId);
        if (post.success && post.data) {
          posts.push(post.data);
        }
      }
      
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting posts by multiple hashtags:', error);
      return { success: false, error: 'Error getting posts by multiple hashtags' };
    }
  }

  async getPostsByPrivacy(privacy: string, userId?: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      let query = db.collection('posts').where('privacy', '==', privacy);
      
      // If userId is provided, also filter by that user
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      const postsSnapshot = await query.orderBy('createdAt', 'desc').get();
      const posts = [];
      
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        const user = await this.getUser(postData.userId);
        
        if (user.success) {
          posts.push(castToFirebasePostWithUser(postData, postDoc.id, postData.userId, user.data));
        }
      }
      
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting posts by privacy:', error);
      return { success: false, error: 'Error getting posts by privacy' };
    }
  }

  async deletePost(postId: string): Promise<ApiResponse<null>> {
    try {
      // Delete the post
      await db.collection('posts').doc(postId).delete();
      
      // Delete associated likes
      const likesQuery = await db.collection('postLikes').where('postId', '==', postId).get();
      const deleteLikesPromises = likesQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deleteLikesPromises);
      
      // Delete associated comments
      const commentsQuery = await db.collection('comments').where('postId', '==', postId).get();
      const deleteCommentsPromises = commentsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deleteCommentsPromises);
      
      // Delete associated hashtags
      const hashtagsQuery = await db.collection('postHashtags').where('postId', '==', postId).get();
      const deleteHashtagsPromises = hashtagsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deleteHashtagsPromises);
      
      console.log(`Post ${postId} and all associated data deleted successfully`);
      return { success: true, data: null };
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  async updatePost(postId: string, updates: Partial<FirebasePost>): Promise<ApiResponse<null>> {
    try {
      await db.collection('posts').doc(postId).update({
        ...updates,
        updatedAt: new Date()
      });
      console.log(`Post ${postId} updated successfully`);
      return { success: true, data: null };
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  async getTaggedPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const taggedPostsSnapshot = await db.collection('postTags')
        .where('userId', '==', userId)
        .get();
      const posts: FirebasePostWithUser[] = [];
      for (const tagDoc of taggedPostsSnapshot.docs) {
        const tagData = tagDoc.data();
        if (!tagData?.postId) continue;
        const postDoc = await db.collection('posts').doc(tagData.postId).get();
        if (!postDoc.exists) continue;
        const postData = postDoc.data();
        if (!postData) continue;
        if (postData.privacy === 'private' && postData.userId !== userId) {
          continue;
        }
        if (postData.privacy === 'connections') {
          const isConnected = await this.areConnected(userId, postData.userId);
          if (!isConnected) continue;
        }
        const user = await this.getUser(postData.userId);
        if (user.success && user.data) {
          const postWithUser = castToFirebasePostWithUser(postData, postDoc.id, postData.userId, user.data);
          if (postWithUser) posts.push(postWithUser);
        }
      }
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting tagged posts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getFriendsPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const connectionsResponse = await this.getConnections(userId);
      const connections = Array.isArray(connectionsResponse.data) ? connectionsResponse.data : [];
      if (connections.length === 0) {
        return { success: true, data: [] };
      }
      const connectionIds = connections.map(conn => conn.id);
      const posts: FirebasePostWithUser[] = [];
      for (const connectionId of connectionIds) {
        const userPostsResponse = await this.getPostsByUserId(connectionId);
        if (userPostsResponse.success && Array.isArray(userPostsResponse.data)) {
          posts.push(...userPostsResponse.data.filter(Boolean));
        }
      }
      return { success: true, data: posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) };
    } catch (error) {
      console.error('Error getting friends posts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ENGAGEMENT METHODS
  async likePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      // Check if already liked
      const existingLike = await db.collection('postLikes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (existingLike.empty) {
        await db.collection('postLikes').add({
          postId,
          userId,
          createdAt: new Date()
        });
        console.log(`User ${userId} liked post ${postId}`);
        return { success: true, data: null };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  async unlikePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const likeQuery = await db.collection('postLikes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!likeQuery.empty) {
        await likeQuery.docs[0].ref.delete();
        console.log(`User ${userId} unliked post ${postId}`);
        return { success: true, data: null };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }

  async isPostLiked(postId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const likeQuery = await db.collection('postLikes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      return { success: true, data: !likeQuery.empty };
    } catch (error) {
      console.error('Error checking if post is liked:', error);
      return { success: false, error: 'Error checking if post is liked' };
    }
  }

  async getPostLikeCount(postId: string): Promise<ApiResponse<number>> {
    try {
      const likeQuery = await db.collection('postLikes')
        .where('postId', '==', postId)
        .get();
      return { success: true, data: likeQuery.size };
    } catch (error) {
      console.error('Error getting post like count:', error);
      return { success: false, error: 'Error getting post like count' };
    }
  }

  async getUserLike(postId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const likeQuery = await db.collection('postLikes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      return { success: true, data: !likeQuery.empty };
    } catch (error) {
      console.error('Error checking user like:', error);
      return { success: false, error: 'Error checking user like' };
    }
  }

  async sharePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('postShares').add({
        postId,
        userId,
        sharedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error sharing post:', error);
      throw error;
    }
  }

  async getPostShareCount(postId: string): Promise<ApiResponse<number>> {
    try {
      const sharesSnapshot = await db.collection('postShares')
        .where('postId', '==', postId)
        .get();
      
      return { success: true, data: sharesSnapshot.size };
    } catch (error) {
      console.error('Error getting post share count:', error);
      return { success: false, error: 'Error getting post share count' };
    }
  }

  async getUserTotalShares(userId: string): Promise<ApiResponse<number>> {
    try {
      const sharesSnapshot = await db.collection('postShares')
        .where('userId', '==', userId)
        .get();
      
      return { success: true, data: sharesSnapshot.size };
    } catch (error) {
      console.error('Error getting user total shares:', error);
      return { success: false, error: 'Error getting user total shares' };
    }
  }

  async recordPostView(postId: string, userId?: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('postViews').add({
        postId,
        userId: userId || null,
        viewedAt: new Date(),
        ipAddress: null // Could be added later for analytics
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error recording post view:', error);
      return { success: false, error: 'Error recording post view' };
    }
  }

  async trackView(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('postViews').add({
        postId,
        userId,
        viewedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error tracking view:', error);
      return { success: false, error: 'Error tracking view' };
    }
  }

  async getPostViewCount(postId: string): Promise<ApiResponse<number>> {
    try {
      const viewsSnapshot = await db.collection('postViews')
        .where('postId', '==', postId)
        .get();
      
      return { success: true, data: viewsSnapshot.size };
    } catch (error) {
      console.error('Error getting post view count:', error);
      return { success: false, error: 'Error getting post view count' };
    }
  }

  async getPostViews(postId: string): Promise<ApiResponse<number>> {
    try {
      const viewsSnapshot = await db.collection('postViews')
        .where('postId', '==', postId)
        .get();
      
      return { success: true, data: viewsSnapshot.size };
    } catch (error) {
      console.error('Error getting post views:', error);
      return { success: false, error: 'Error getting post views' };
    }
  }

  // REPOST SYSTEM
  async repost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('reposts').add({
        postId,
        userId,
        repostedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error reposting:', error);
      throw error;
    }
  }

  async repostPost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('reposts').add({
        postId,
        userId,
        repostedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error reposting post:', error);
      throw error;
    }
  }

  async unrepost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const repostDoc = await db.collection('reposts')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!repostDoc.empty) {
        await repostDoc.docs[0].ref.delete();
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error unreposting:', error);
      throw error;
    }
  }

  async isReposted(postId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const repostDoc = await db.collection('reposts')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      return { success: true, data: !repostDoc.empty };
    } catch (error) {
      console.error('Error checking if reposted:', error);
      return { success: false, error: 'Error checking if reposted' };
    }
  }

  async getReposts(postId: string): Promise<ApiResponse<number>> {
    try {
      const repostsSnapshot = await db.collection('reposts')
        .where('postId', '==', postId)
        .get();
      
      return { success: true, data: repostsSnapshot.size };
    } catch (error) {
      console.error('Error getting reposts count:', error);
      return { success: false, error: 'Error getting reposts count' };
    }
  }

  // SAVE SYSTEM
  async savePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('savedPosts').add({
        postId,
        userId,
        savedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  }

  async unsavePost(postId: string, userId: string): Promise<ApiResponse<null>> {
    try {
      const savedDoc = await db.collection('savedPosts')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!savedDoc.empty) {
        await savedDoc.docs[0].ref.delete();
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error unsaving post:', error);
      throw error;
    }
  }

  async isSaved(postId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      const savedDoc = await db.collection('savedPosts')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      return { success: true, data: !savedDoc.empty };
    } catch (error) {
      console.error('Error checking if saved:', error);
      return { success: false, error: 'Error checking if saved' };
    }
  }

  async getSavedPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const savedSnapshot = await db.collection('savedPosts')
        .where('userId', '==', userId)
        .orderBy('savedAt', 'desc')
        .get();
      const savedPosts: FirebasePostWithUser[] = [];
      for (const savedDoc of savedSnapshot.docs) {
        const savedData = savedDoc.data();
        const post = await this.getPost(savedData.postId);
        if (post.success && post.data) {
          savedPosts.push(post.data);
        }
      }
      return { success: true, data: savedPosts };
    } catch (error) {
      console.error('Error getting saved posts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // COMMENTS
  async createComment(commentData: InsertComment & { postId: string; userId: string }): Promise<ApiResponse<FirebaseComment>> {
    try {
      const commentRef = await db.collection('comments').add({
        ...commentData,
        postId: commentData.postId,
        userId: commentData.userId,
        createdAt: new Date()
      });
      const commentDoc = await commentRef.get();
      const createdCommentData = commentDoc.data();
      if (!createdCommentData) {
        throw new Error('Failed to create comment - no data returned');
      }
      const firebaseComment: FirebaseComment = {
        id: commentDoc.id,
        postId: commentData.postId,
        userId: commentData.userId,
        parentId: createdCommentData.parentId ?? null,
        text: createdCommentData.text ?? '',
        imageUrl: createdCommentData.imageUrl ?? null,
        rating: createdCommentData.rating ?? null,
        createdAt: createdCommentData.createdAt?.toDate() || new Date()
      };
      return {
        success: true,
        data: firebaseComment
      };
    } catch (error) {
      console.error('Error creating comment:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getCommentsByPostId(postId: string): Promise<ApiResponse<FirebaseCommentWithUser[]>> {
    try {
      const commentsSnapshot = await db.collection('comments')
        .where('postId', '==', postId)
        .orderBy('createdAt', 'asc')
        .get();
      
      const comments: FirebaseCommentWithUser[] = [];
      
      for (const doc of commentsSnapshot.docs) {
        const commentData = doc.data();
        let userData = null;
        if (commentData.userId) {
          const userDoc = await db.collection('users').doc(commentData.userId).get();
          userData = userDoc.data();
        }
        comments.push({
          ...commentData,
          id: doc.id,
          postId: commentData.postId,
          userId: commentData.userId,
          user: userData || { id: commentData.userId || 0, username: 'Unknown User', name: 'Unknown User' }
        } as FirebaseCommentWithUser);
      }
      
      return { success: true, data: comments };
    } catch (error) {
      console.error('Error getting comments by post ID:', error);
      return { success: false, error: 'Error getting comments by post ID' };
    }
  }

  async deleteComment(commentId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('comments').doc(commentId).delete();
      return { success: true, data: null };
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  // HASHTAG SYSTEM
  async createHashtag(name: string): Promise<ApiResponse<FirebaseHashtag>> {
    try {
      const hashtagRef = await db.collection('hashtags').add({
        name: name.toLowerCase(),
        count: 0,
        createdAt: new Date()
      });
      const hashtagDoc = await hashtagRef.get();
      const hashtagData = hashtagDoc.data();
      if (!hashtagData) {
        return { success: false, error: 'Failed to create hashtag' };
      }
      return { success: true, data: {
        id: hashtagDoc.id,
        name: hashtagData.name,
        count: hashtagData.count,
        createdAt: hashtagData.createdAt?.toDate() || new Date()
      } as FirebaseHashtag };
    } catch (error) {
      console.error('Error creating hashtag:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getHashtagsByPostId(postId: string): Promise<ApiResponse<FirebaseHashtag[]>> {
    try {
      const hashtagsSnapshot = await db.collection('postHashtags')
        .where('postId', '==', postId)
        .get();
      const hashtags: FirebaseHashtag[] = [];
      for (const doc of hashtagsSnapshot.docs) {
        const hashtagData = doc.data();
        if (hashtagData.hashtagId) {
          const hashtagDoc = await db.collection('hashtags').doc(hashtagData.hashtagId.toString()).get();
          if (hashtagDoc.exists) {
            const hashtagInfo = hashtagDoc.data();
            hashtags.push({
              id: hashtagDoc.id,
              ...hashtagInfo
            } as FirebaseHashtag);
          }
        }
      }
      return { success: true, data: hashtags };
    } catch (error) {
      console.error('Error getting hashtags by post ID:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getTrendingHashtags(limit: number = 10): Promise<ApiResponse<FirebaseHashtag[]>> {
    try {
      const hashtagsSnapshot = await db.collection('hashtags')
        .orderBy('count', 'desc')
        .limit(limit)
        .get();
      return { success: true, data: hashtagsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        count: doc.data().count || 0,
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) };
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async followHashtag(userId: string, hashtagId: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('hashtagFollows').add({
        userId,
        hashtagId,
        createdAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error following hashtag:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async unfollowHashtag(userId: string, hashtagId: string): Promise<ApiResponse<null>> {
    try {
      const followDoc = await db.collection('hashtagFollows')
        .where('userId', '==', userId)
        .where('hashtagId', '==', hashtagId)
        .limit(1)
        .get();
      if (!followDoc.empty) {
        await followDoc.docs[0].ref.delete();
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error unfollowing hashtag:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getFollowedHashtags(userId: string): Promise<ApiResponse<FirebaseHashtag[]>> {
    try {
      const followsSnapshot = await db.collection('hashtagFollows')
        .where('userId', '==', userId)
        .get();
      const hashtags = [];
      for (const followDoc of followsSnapshot.docs) {
        const hashtagId = followDoc.data().hashtagId;
        const hashtagDoc = await db.collection('hashtags').doc(hashtagId).get();
        if (hashtagDoc.exists) {
          const hashtagData = hashtagDoc.data();
          hashtags.push({
            id: hashtagDoc.id,
            name: hashtagData?.name || '',
            count: hashtagData?.count || 0,
            createdAt: hashtagData?.createdAt?.toDate() || new Date()
          });
        }
      }
      return { success: true, data: hashtags };
    } catch (error) {
      console.error('Error getting followed hashtags:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async isFollowingHashtag(userId: string, hashtagId: string): Promise<ApiResponse<boolean>> {
    try {
      const followDoc = await db.collection('hashtagFollows')
        .where('userId', '==', userId)
        .where('hashtagId', '==', hashtagId)
        .limit(1)
        .get();
      return { success: true, data: !followDoc.empty };
    } catch (error) {
      console.error('Error checking if following hashtag:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // TAGGING SYSTEM
  async tagFriendInPost(postId: string, userId: string, taggedUserId: string): Promise<void> {
    try {
      await db.collection('postTags').add({
        postId,
        userId: taggedUserId,
        taggedBy: userId,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error tagging friend in post:', error);
      throw error;
    }
  }

  async tagFriendsToPost(postId: string, friendIds: string[], taggedBy: string): Promise<void> {
    try {
      const batch = db.batch();
      
      for (const friendId of friendIds) {
        const tagRef = db.collection('postTags').doc();
        batch.set(tagRef, {
          postId,
          userId: friendId,
          taggedBy,
          createdAt: new Date()
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error tagging friends to post:', error);
      throw error;
    }
  }

  // SOCIAL NETWORK - CONNECTIONS
  async getConnectionsWithRecentPosts(userId: string): Promise<ApiResponse<Array<{ user: FirebaseUser; hasRecentPosts: boolean }>>> {
    try {
      const connectionsResponse = await this.getConnections(userId);
      const connections = connectionsResponse.success && connectionsResponse.data ? connectionsResponse.data : [];
      const connectionsWithRecentPosts: Array<{ user: FirebaseUser; hasRecentPosts: boolean }> = [];
      for (const connection of connections) {
        const recentPostsResponse = await this.getPostsByUserId(connection.id);
        const hasRecentPosts = recentPostsResponse.success && Array.isArray(recentPostsResponse.data) &&
          recentPostsResponse.data.some(post => {
            const postDate = new Date(post.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return postDate > weekAgo;
          });
        connectionsWithRecentPosts.push({
          user: connection,
          hasRecentPosts: hasRecentPosts || false
        });
      }
      return { success: true, data: connectionsWithRecentPosts };
    } catch (error) {
      console.error('Error getting connections with recent posts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getConnectionsOrderedByRecentTags(userId: string): Promise<ApiResponse<FirebaseUser[]>> {
    try {
      const connectionsResponse = await this.getConnections(userId);
      const connections = connectionsResponse.success && connectionsResponse.data ? connectionsResponse.data : [];
      return { success: true, data: connections };
    } catch (error) {
      console.error('Error getting connections ordered by recent tags:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getConnectionRequests(userId: string): Promise<ApiResponse<any[]>> {
    try {
      console.log(`Getting connection requests for user: ${userId}`);
      
      const requestsQuery = await db
        .collection('friendRequests')
        .where('toUserId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();

      const requests: any[] = [];
      for (const doc of requestsQuery.docs) {
        const requestData = doc.data();
        const fromUserResponse = await this.getUser(requestData.fromUserId);
        if (fromUserResponse.success) {
          requests.push({
            id: doc.id,
            fromUser: fromUserResponse.data,
            status: requestData.status,
            createdAt: requestData.createdAt?.toDate() || new Date()
          });
        }
      }

      console.log(`Found ${requests.length} connection requests for user ${userId}`);
      return { success: true, data: requests };
    } catch (error) {
      console.error('Error getting connection requests:', error);
      return { success: false, error: 'Error getting connection requests' };
    }
  }

  async getOutgoingConnectionRequests(userId: string): Promise<ApiResponse<Array<{ id: string; toUser: FirebaseUser; createdAt: Date }>>> {
    try {
      const requestsQuery = await db
        .collection('friendRequests')
        .where('fromUserId', '==', userId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();
      const requests: Array<{ id: string; toUser: FirebaseUser; createdAt: Date }> = [];
      for (const doc of requestsQuery.docs) {
        const requestData = doc.data();
        const toUserResponse = await this.getUser(requestData.toUserId);
        if (toUserResponse.success && toUserResponse.data) {
          requests.push({
            id: doc.id,
            toUser: toUserResponse.data,
            createdAt: requestData.createdAt?.toDate() || new Date()
          });
        }
      }
      return { success: true, data: requests };
    } catch (error) {
      console.error('Error getting outgoing connection requests:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async respondToConnectionRequest(requestId: string, action: 'accept' | 'reject'): Promise<ApiResponse<null>> {
    try {
      const requestDoc = await db.collection('friendRequests').doc(requestId).get();
      if (!requestDoc.exists) {
        return { success: false, error: 'Connection request not found' };
      }

      const requestData = requestDoc.data();
      if (!requestData) {
        return { success: false, error: 'Request data not found' };
      }

      if (action === 'accept') {
        // Create friendship
        await db.collection('friendships').add({
          userId1: requestData.fromUserId,
          userId2: requestData.toUserId,
          createdAt: new Date()
        });

        // Create reverse friendship for bidirectional access
        await db.collection('friendships').add({
          userId1: requestData.toUserId,
          userId2: requestData.fromUserId,
          createdAt: new Date()
        });
      }

      // Update request status
      await db.collection('friendRequests').doc(requestId).update({
        status: action === 'accept' ? 'accepted' : 'rejected',
        respondedAt: new Date()
      });

      return { success: true, data: null };
    } catch (error) {
      console.error('Error responding to connection request:', error);
      return { success: false, error: 'Error responding to connection request' };
    }
  }

  async areConnected(userId1: string, userId2: string): Promise<ApiResponse<boolean>> {
    try {
      const friendshipQuery = await db.collection('friendships')
        .where('userId1', '==', userId1)
        .where('userId2', '==', userId2)
        .limit(1)
        .get();

      return { success: true, data: !friendshipQuery.empty };
    } catch (error) {
      console.error('Error checking if users are connected:', error);
      return { success: false, error: 'Error checking connection status' };
    }
  }

  async getConnectionsPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const connectionsResponse = await this.getConnections(userId);
      const connections = connectionsResponse.success && connectionsResponse.data ? connectionsResponse.data : [];
      const allPosts: FirebasePostWithUser[] = [];
      for (const connection of connections) {
        const postsResponse = await this.getPostsByUserId(connection.id);
        if (postsResponse.success && Array.isArray(postsResponse.data)) {
          allPosts.push(...postsResponse.data);
        }
      }
      const sortedPosts = allPosts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { success: true, data: sortedPosts };
    } catch (error) {
      console.error('Error getting connections posts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Add all other missing methods as stubs
  async flagPost(postId: string, userId: string, reason: string, comment?: string): Promise<void> {
    try {
      await db.collection('postFlags').add({
        postId,
        userId,
        reason,
        comment: comment || '',
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error flagging post:', error);
      throw error;
    }
  }

  async unflagPost(postId: string, userId: string): Promise<void> {
    try {
      const flagSnapshot = await db.collection('postFlags')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (!flagSnapshot.empty) {
        await flagSnapshot.docs[0].ref.delete();
      }
    } catch (error) {
      console.error('Error unflagging post:', error);
      throw error;
    }
  }

  async getPostFlags(postId: string): Promise<any[]> {
    try {
      const flagsSnapshot = await db.collection('postFlags')
        .where('postId', '==', postId)
        .get();
      return flagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting post flags:', error);
      return [];
    }
  }

  async checkAutoDelete(postId: string): Promise<boolean> {
    try {
      // Example: auto-delete if flagged more than 5 times
      const flagsSnapshot = await db.collection('postFlags')
        .where('postId', '==', postId)
        .get();
      return flagsSnapshot.size > 5;
    } catch (error) {
      console.error('Error checking auto delete:', error);
      return false;
    }
  }

  async createReport(report: any): Promise<any> {
    try {
      const ref = await db.collection('reports').add({ ...report, createdAt: new Date() });
      return { id: ref.id, ...report };
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  }

  async getReports(): Promise<any[]> {
    try {
      const reportsSnapshot = await db.collection('reports').get();
      return reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting reports:', error);
      return [];
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      await db.collection('reports').doc(reportId).delete();
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  async flagUser(userId: string, flaggedBy: string, reason: string): Promise<void> {
    try {
      await db.collection('userFlags').add({
        userId,
        flaggedBy,
        reason,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error flagging user:', error);
      throw error;
    }
  }

  async unflagUser(userId: string): Promise<void> {
    try {
      const flagSnapshot = await db.collection('userFlags')
        .where('userId', '==', userId)
        .get();
      for (const doc of flagSnapshot.docs) {
        await doc.ref.delete();
      }
    } catch (error) {
      console.error('Error unflagging user:', error);
      throw error;
    }
  }

  async getPostStats(postId: string): Promise<ApiResponse<{ likeCount: number; commentCount: number; shareCount: number; viewCount: number }>> {
    try {
      const likesSnapshot = await db.collection('postLikes').where('postId', '==', postId).get();
      const likeCount = likesSnapshot.size;
      const commentsSnapshot = await db.collection('comments').where('postId', '==', postId).get();
      const commentCount = commentsSnapshot.size;
      const sharesSnapshot = await db.collection('postShares').where('postId', '==', postId).get();
      const shareCount = sharesSnapshot.size;
      const viewsSnapshot = await db.collection('postViews').where('postId', '==', postId).get();
      const viewCount = viewsSnapshot.size;
      return { success: true, data: { likeCount, commentCount, shareCount, viewCount } };
    } catch (error) {
      console.error('Error getting post stats:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getUserEnergyStats(userId: string): Promise<ApiResponse<{ average: number; count: number }>> {
    try {
      const ratingsSnapshot = await db.collection('userEnergyRatings')
        .where('userId', '==', userId)
        .get();
      if (ratingsSnapshot.empty) {
        return { success: true, data: { average: 0, count: 0 } };
      }
      let totalRating = 0;
      let count = 0;
      ratingsSnapshot.docs.forEach(doc => {
        const rating = doc.data().rating;
        if (typeof rating === 'number' && rating >= 0 && rating <= 10) {
          totalRating += rating;
          count++;
        }
      });
      const average = count > 0 ? totalRating / count : 0;
      return { success: true, data: { average: Math.round(average * 100) / 100, count } };
    } catch (error) {
      console.error('Error getting user energy stats:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAnalytics(): Promise<ApiResponse<any>> {
    try {
      const usersSnapshot = await db.collection('users').get();
      const postsSnapshot = await db.collection('posts').get();
      const listsSnapshot = await db.collection('lists').get();
      const commentsSnapshot = await db.collection('comments').get();
      const likesSnapshot = await db.collection('postLikes').get();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentPostsSnapshot = await db.collection('posts')
        .where('createdAt', '>=', sevenDaysAgo)
        .get();
      const recentUsersSnapshot = await db.collection('users')
        .where('createdAt', '>=', sevenDaysAgo)
        .get();
      return { success: true, data: {
        totalUsers: usersSnapshot.size,
        totalPosts: postsSnapshot.size,
        totalLists: listsSnapshot.size,
        totalComments: commentsSnapshot.size,
        totalLikes: likesSnapshot.size,
        recentPosts: recentPostsSnapshot.size,
        recentUsers: recentUsersSnapshot.size,
        generatedAt: new Date()
      }};
    } catch (error) {
      console.error('Error getting analytics:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getRsvp(eventId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      const rsvpDoc = await db.collection('rsvps')
        .where('postId', '==', eventId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (rsvpDoc.empty) {
        return { success: false, error: 'RSVP not found' };
      }
      const rsvpData = rsvpDoc.docs[0].data();
      return { success: true, data: { id: rsvpDoc.docs[0].id, ...rsvpData } };
    } catch (error) {
      console.error('Error getting RSVP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createRsvp(eventId: string, userId: string, status: string): Promise<ApiResponse<null>> {
    try {
      await db.collection('rsvps').add({
        postId: eventId,
        userId,
        status,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, data: null };
    } catch (error) {
      console.error('Error creating RSVP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateRsvp(eventId: string, userId: string, status: string): Promise<ApiResponse<null>> {
    try {
      const rsvpDoc = await db.collection('rsvps')
        .where('postId', '==', eventId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (!rsvpDoc.empty) {
        await rsvpDoc.docs[0].ref.update({
          status,
          updatedAt: new Date()
        });
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Error updating RSVP:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getRsvpStats(eventId: string): Promise<ApiResponse<{ going: number; maybe: number; notGoing: number }>> {
    try {
      const rsvpsSnapshot = await db.collection('rsvps')
        .where('postId', '==', eventId)
        .get();
      let going = 0;
      let maybe = 0;
      let notGoing = 0;
      rsvpsSnapshot.docs.forEach(doc => {
        const status = doc.data().status;
        switch (status) {
          case 'going': going++; break;
          case 'maybe': maybe++; break;
          case 'not_going': notGoing++; break;
        }
      });
      return { success: true, data: { going, maybe, notGoing } };
    } catch (error) {
      console.error('Error getting RSVP stats:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getRsvpList(eventId: string, status?: string): Promise<ApiResponse<Array<{ user: FirebaseUser; status: string }>>> {
    try {
      let query = db.collection('rsvps').where('postId', '==', eventId);
      if (status) {
        query = query.where('status', '==', status);
      }
      const rsvpsSnapshot = await query.get();
      const rsvpList: Array<{ user: FirebaseUser; status: string }> = [];
      for (const doc of rsvpsSnapshot.docs) {
        const rsvpData = doc.data();
        const userResponse = await this.getUser(rsvpData.userId);
        if (userResponse.success && userResponse.data) {
          rsvpList.push({
            user: userResponse.data,
            status: rsvpData.status
          });
        }
      }
      return { success: true, data: rsvpList };
    } catch (error) {
      console.error('Error getting RSVP list:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createNotification(notification: CreateNotificationData): Promise<any> {
    try {
      const notificationRef = await db.collection('notifications').add({
        userId: notification.userId,
        type: notification.type,
        postId: notification.postId || null,
        fromUserId: notification.fromUserId || null,
        viewed: false,
        createdAt: new Date()
      });
      
      return {
        id: notificationRef.id,
        userId: notification.userId,
        type: notification.type,
        postId: notification.postId || null,
        fromUserId: notification.fromUserId || null,
        viewed: false,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async getNotifications(userId: string): Promise<any[]> {
    try {
      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50) // Limit to most recent 50 notifications
        .get();
      
      const notifications = [];
      
      for (const notifDoc of notificationsSnapshot.docs) {
        const notifData = notifDoc.data();
        if (!notifData) continue;
        
        // Get additional data based on notification type
        let additionalData = {};
        
        if (notifData.fromUserId) {
          const fromUser = await this.getUser(notifData.fromUserId);
          additionalData = { ...additionalData, fromUser };
        }
        
        if (notifData.postId) {
          const post = await this.getPost(notifData.postId);
          additionalData = { ...additionalData, post };
        }
        
        notifications.push({
          id: notifDoc.id,
          ...notifData,
          ...additionalData
        });
      }
      
      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await db.collection('notifications').doc(notificationId).update({
        viewed: true,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markNotificationAsViewed(notificationId: string): Promise<void> {
    try {
      await db.collection('notifications').doc(notificationId).update({
        viewed: true,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as viewed:', error);
      throw error;
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('viewed', '==', false)
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  async getBlacklist(userId: string): Promise<any[]> {
    try {
      const blacklistSnapshot = await db.collection('blacklists')
        .where('userId', '==', userId)
        .get();
      return blacklistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting blacklist:', error);
      return [];
    }
  }

  async addToBlacklist(userId: string, blockedUserId: string): Promise<void> {
    try {
      await db.collection('blacklists').add({
        userId,
        blockedUserId,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }

  async getSharedWithMePosts(userId: string): Promise<FirebasePostWithUser[]> {
    try {
      // Implementation needed - return posts shared with the user
      return [];
    } catch (error) {
      console.error('Error getting shared with me posts:', error);
      return [];
    }
  }

  async markTaggedPostViewed(postId: string, userId: string): Promise<void> {
    try {
      // Implementation needed - mark a tagged post as viewed
      await db.collection('postTags')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            snapshot.docs[0].ref.update({ viewed: true, viewedAt: new Date() });
          }
        });
    } catch (error) {
      console.error('Error marking tagged post viewed:', error);
      throw error;
    }
  }

  // Energy Rating System
  async getPostEnergyStats(postId: string): Promise<{ average: number; count: number }> {
    try {
      const ratingsSnapshot = await db.collection('postEnergyRatings')
        .where('postId', '==', postId)
        .get();
      if (ratingsSnapshot.empty) {
        return { average: 0, count: 0 };
      }
      let totalRating = 0;
      let count = 0;
      ratingsSnapshot.docs.forEach(doc => {
        const rating = doc.data().rating;
        if (typeof rating === 'number' && rating >= 0 && rating <= 10) {
          totalRating += rating;
          count++;
        }
      });
      const average = count > 0 ? totalRating / count : 0;
      return { average: Math.round(average * 100) / 100, count };
    } catch (error) {
      console.error('Error getting post energy stats:', error);
      return { average: 0, count: 0 };
    }
  }

  async getUserPostEnergyRating(postId: string, userId: string): Promise<number | null> {
    try {
      const ratingDoc = await db.collection('postEnergyRatings')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (ratingDoc.empty) {
        return null;
      }
      return ratingDoc.docs[0].data().rating || null;
    } catch (error) {
      console.error('Error getting user post energy rating:', error);
      return null;
    }
  }

  async submitPostEnergyRating(postId: string, userId: string, rating: number): Promise<void> {
    try {
      await db.collection('postEnergyRatings').add({
        postId,
        userId,
        rating,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error submitting post energy rating:', error);
      throw error;
    }
  }

  async getProfileEnergyStats(profileId: string): Promise<{ average: number; count: number }> {
    try {
      const ratingsSnapshot = await db.collection('profileEnergyRatings')
        .where('profileId', '==', profileId)
        .get();
      if (ratingsSnapshot.empty) {
        return { average: 0, count: 0 };
      }
      let totalRating = 0;
      let count = 0;
      ratingsSnapshot.docs.forEach(doc => {
        const rating = doc.data().rating;
        if (typeof rating === 'number' && rating >= 0 && rating <= 10) {
          totalRating += rating;
          count++;
        }
      });
      const average = count > 0 ? totalRating / count : 0;
      return { average: Math.round(average * 100) / 100, count };
    } catch (error) {
      console.error('Error getting profile energy stats:', error);
      return { average: 0, count: 0 };
    }
  }

  async getUserProfileEnergyRating(profileId: string, userId: string): Promise<number | null> {
    try {
      const ratingDoc = await db.collection('profileEnergyRatings')
        .where('profileId', '==', profileId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (ratingDoc.empty) {
        return null;
      }
      return ratingDoc.docs[0].data().rating || null;
    } catch (error) {
      console.error('Error getting user profile energy rating:', error);
      return null;
    }
  }

  async submitProfileEnergyRating(profileId: string, userId: string, rating: number): Promise<void> {
    try {
      await db.collection('profileEnergyRatings').add({
        profileId,
        userId,
        rating,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error submitting profile energy rating:', error);
      throw error;
    }
  }

  // Get attached lists for a post
  async getAttachedListsByPostId(postId: string): Promise<Array<{ id: string; name: string; userId: string; user?: { username: string } }>> {
    try {
      const attachedListsSnapshot = await db.collection('postAttachedLists')
        .where('postId', '==', postId)
        .get();
      const attachedLists: Array<{ id: string; name: string; userId: string; user?: { username: string } }> = [];
      for (const doc of attachedListsSnapshot.docs) {
        const listData = doc.data();
        const listDoc = await db.collection('lists').doc(listData.listId).get();
        if (listDoc.exists) {
          const list = listDoc.data();
          const userDoc = await db.collection('users').doc(list?.userId).get();
          const user = userDoc.exists ? userDoc.data() : null;
          attachedLists.push({
            id: listDoc.id,
            name: list?.name || '',
            userId: list?.userId || '',
            user: user ? { username: user.username } : undefined
          });
        }
      }
      return attachedLists;
    } catch (error) {
      console.error('Error getting attached lists by post ID:', error);
      return [];
    }
  }

  // Missing methods that routes are calling
  async getConnectionStories(userId: string): Promise<any[]> {
    try {
      // Implementation needed - return stories from connections
      return [];
    } catch (error) {
      console.error('Error getting connection stories:', error);
      return [];
    }
  }

  async getUserListInvitations(userId: string): Promise<any[]> {
    try {
      // Implementation needed - return list invitations for user
      return [];
    } catch (error) {
      console.error('Error getting user list invitations:', error);
      return [];
    }
  }

  async getFriendsRecentPosts(userId: string): Promise<FirebasePostWithUser[]> {
    try {
      // This is the same as getFriendsPosts
      const response = await this.getFriendsPosts(userId);
      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Error getting friends recent posts:', error);
      return [];
    }
  }

  // Additional methods needed by routes
  async isPostLikedByUser(postId: string, userId: string): Promise<boolean> {
    try {
      const response = await this.isPostLiked(postId, userId);
      return response.success && response.data ? response.data : false;
    } catch (error) {
      console.error('Error checking if post is liked by user:', error);
      return false;
    }
  }

  async trackPostView(postId: string, userId: string): Promise<void> {
    try {
      await this.trackView(postId, userId);
    } catch (error) {
      console.error('Error tracking post view:', error);
      throw error;
    }
  }

  async getConnections(userId: string): Promise<ApiResponse<FirebaseUser[]>> {
    try {
      const friendshipsSnapshot = await db.collection('friendships')
        .where('userId1', '==', userId)
        .get();
      const friendIds = friendshipsSnapshot.docs.map(doc => doc.data().userId2);
      const users: FirebaseUser[] = [];
      for (const id of friendIds) {
        const userDoc = await db.collection('users').doc(id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData) {
            users.push({ id: userDoc.id, ...userData } as FirebaseUser);
          }
        }
      }
      return { success: true, data: users };
    } catch (error) {
      console.error('Error getting connections:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendConnectionRequest(fromUserId: string, toUserId: string): Promise<ApiResponse<null>> {
    try {
      // Check if request already exists
      const existingRequest = await db.collection('friendRequests')
        .where('fromUserId', '==', fromUserId)
        .where('toUserId', '==', toUserId)
        .limit(1)
        .get();
      
      if (!existingRequest.empty) {
        return { success: true, data: null, message: 'Connection request already exists' };
      }
      
      await db.collection('friendRequests').add({
        fromUserId,
        toUserId,
        status: 'pending',
        createdAt: new Date()
      });

      // Log friendship request for audit
      await this.auditService.logFriendshipActivity(
        fromUserId,
        'friend_request',
        toUserId
      );
      
      return { success: true, data: null };
    } catch (error) {
      console.error('Error sending connection request:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export the storage instance
export const storage = new EnterpriseStorage();

