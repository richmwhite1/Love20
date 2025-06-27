import { db } from '../firebase-db';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  Timestamp,
  FieldValue,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ApiResponse } from '../types';
import { FeedTypeEnum, JobTypeEnum, JobStatusEnum, FeedResponse, FeedEntryWithPost, FeedGenerationContext } from '../../shared/feed-schema';

export interface FeedEntry {
  id: string;
  userId: string;
  postId: string;
  postUserId: string;
  feedType: FeedTypeEnum;
  score?: number;
  chronologicalRank?: number;
  algorithmicRank?: number;
  friendsRank?: number;
  trendingRank?: number;
  postCreatedAt: Date;
  postUpdatedAt: Date;
  postPrivacy: string;
  postEngagement: number;
  postViewCount: number;
  postLikeCount: number;
  postCommentCount: number;
  postShareCount: number;
  userRelationship?: string;
  userPrivacyLevel?: string;
  isVisible: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFeedPreference {
  id: string;
  userId: string;
  defaultFeedType: FeedTypeEnum;
  chronologicalEnabled: boolean;
  algorithmicEnabled: boolean;
  friendsEnabled: boolean;
  trendingEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedGenerationJob {
  id: string;
  jobType: JobTypeEnum;
  userId?: string;
  postId?: string;
  affectedUserIds?: string[];
  feedTypes?: FeedTypeEnum[];
  priority: number;
  status: JobStatusEnum;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class FeedService {
  private static instance: FeedService;

  private constructor() {}

  static getInstance(): FeedService {
    if (!FeedService.instance) {
      FeedService.instance = new FeedService();
    }
    return FeedService.instance;
  }

  // Feed Preferences Management
  async getUserFeedPreferences(userId: string): Promise<ApiResponse<UserFeedPreference>> {
    try {
      const docRef = doc(db, 'userFeedPreferences', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          success: true,
          data: {
            id: docSnap.id,
            userId,
            defaultFeedType: data.defaultFeedType || FeedTypeEnum.CHRONOLOGICAL,
            chronologicalEnabled: data.chronologicalEnabled ?? true,
            algorithmicEnabled: data.algorithmicEnabled ?? true,
            friendsEnabled: data.friendsEnabled ?? true,
            trendingEnabled: data.trendingEnabled ?? true,
            autoRefresh: data.autoRefresh ?? true,
            refreshInterval: data.refreshInterval || 30000,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          }
        };
      }

      // Create default preferences
      const defaultPreferences: Omit<UserFeedPreference, 'id'> = {
        userId,
        defaultFeedType: FeedTypeEnum.CHRONOLOGICAL,
        chronologicalEnabled: true,
        algorithmicEnabled: true,
        friendsEnabled: true,
        trendingEnabled: true,
        autoRefresh: true,
        refreshInterval: 30000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'userFeedPreferences'), {
        ...defaultPreferences,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: { id: userId, ...defaultPreferences }
      };
    } catch (error) {
      console.error('Error getting user feed preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feed preferences'
      };
    }
  }

  async updateUserFeedPreferences(userId: string, preferences: Partial<UserFeedPreference>): Promise<ApiResponse<UserFeedPreference>> {
    try {
      const docRef = doc(db, 'userFeedPreferences', userId);
      await updateDoc(docRef, {
        ...preferences,
        updatedAt: serverTimestamp(),
      });

      const updated = await this.getUserFeedPreferences(userId);
      return updated;
    } catch (error) {
      console.error('Error updating user feed preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update feed preferences'
      };
    }
  }

  // Feed Generation and Management
  async generateFeedForUser(userId: string, feedType: FeedTypeEnum, postId?: string): Promise<ApiResponse<void>> {
    try {
      const startTime = Date.now();
      
      // Get user's friends and privacy settings
      const userPrefs = await this.getUserFeedPreferences(userId);
      if (!userPrefs.success) {
        throw new Error('Failed to get user preferences');
      }

      // Get posts that should appear in this user's feed
      const eligiblePosts = await this.getEligiblePostsForUser(userId, feedType);
      
      // Calculate scores and ranks based on feed type
      const feedEntries = await this.calculateFeedEntries(userId, feedType, eligiblePosts);
      
      // Batch write feed entries
      const batch = writeBatch(db);
      
      // Remove old entries for this user and feed type
      const oldEntriesQuery = query(
        collection(db, 'feedEntries'),
        where('userId', '==', userId),
        where('feedType', '==', feedType)
      );
      const oldEntries = await getDocs(oldEntriesQuery);
      oldEntries.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Add new entries
      feedEntries.forEach(entry => {
        const docRef = doc(collection(db, 'feedEntries'));
        batch.set(docRef, {
          ...entry,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      const loadTime = Date.now() - startTime;
      console.log(`Feed generation completed for user ${userId}, feed ${feedType} in ${loadTime}ms`);

      return { success: true };
    } catch (error) {
      console.error('Error generating feed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate feed'
      };
    }
  }

  private async getEligiblePostsForUser(userId: string, feedType: FeedTypeEnum): Promise<any[]> {
    const postsQuery = query(
      collection(db, 'posts'),
      where('privacy', 'in', ['public', 'friends']),
      orderBy('createdAt', 'desc'),
      limit(1000) // Limit for performance
    );

    const postsSnapshot = await getDocs(postsQuery);
    const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    switch (feedType) {
      case FeedTypeEnum.CHRONOLOGICAL:
      case FeedTypeEnum.ALGORITHMIC: {
        const filtered = await Promise.all(posts.map(async post => {
          if (post.privacy === 'public') return post;
          if (post.privacy === 'friends' && await this.areFriends(userId, post.userId)) return post;
          return null;
        }));
        return filtered.filter(Boolean);
      }
      case FeedTypeEnum.FRIENDS: {
        const filtered = await Promise.all(posts.map(async post => {
          if (await this.areFriends(userId, post.userId)) return post;
          return null;
        }));
        return filtered.filter(Boolean);
      }
      case FeedTypeEnum.TRENDING:
        return posts.filter(post => post.privacy === 'public' && post.engagement > 10);
      default:
        return posts;
    }
  }

  private async calculateFeedEntries(userId: string, feedType: FeedTypeEnum, posts: any[]): Promise<Omit<FeedEntry, 'id'>[]> {
    const entries: Omit<FeedEntry, 'id'>[] = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const isFriend = await this.areFriends(userId, post.userId);
      
      let score: number | undefined;
      let chronologicalRank: number | undefined;
      let algorithmicRank: number | undefined;
      let friendsRank: number | undefined;
      let trendingRank: number | undefined;

      // Calculate ranks based on feed type
      switch (feedType) {
        case FeedTypeEnum.CHRONOLOGICAL:
          chronologicalRank = i + 1;
          break;

        case FeedTypeEnum.ALGORITHMIC:
          score = this.calculateAlgorithmicScore(post, isFriend);
          algorithmicRank = i + 1;
          break;

        case FeedTypeEnum.FRIENDS:
          if (isFriend) {
            friendsRank = i + 1;
          }
          break;

        case FeedTypeEnum.TRENDING:
          score = this.calculateTrendingScore(post);
          trendingRank = i + 1;
          break;
      }

      const entry: Omit<FeedEntry, 'id'> = {
        userId,
        postId: post.id,
        postUserId: post.userId,
        feedType,
        score,
        chronologicalRank,
        algorithmicRank,
        friendsRank,
        trendingRank,
        postCreatedAt: post.createdAt?.toDate() || new Date(),
        postUpdatedAt: post.updatedAt?.toDate() || new Date(),
        postPrivacy: post.privacy,
        postEngagement: post.engagement || 0,
        postViewCount: post.viewCount || 0,
        postLikeCount: post.likeCount || 0,
        postCommentCount: post.commentCount || 0,
        postShareCount: post.shareCount || 0,
        userRelationship: userId === post.userId ? 'self' : isFriend ? 'friend' : 'public',
        userPrivacyLevel: post.userPrivacyLevel,
        isVisible: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      entries.push(entry);
    }

    return entries;
  }

  private calculateAlgorithmicScore(post: any, isFriend: boolean): number {
    const timeDecay = Math.exp(-0.1 * (Date.now() - post.createdAt?.toDate().getTime()) / (24 * 60 * 60 * 1000));
    const engagementScore = (post.likeCount || 0) * 1 + (post.commentCount || 0) * 2 + (post.shareCount || 0) * 3;
    const friendBonus = isFriend ? 1.5 : 1.0;
    const userReputation = post.userReputation || 1.0;

    return timeDecay * engagementScore * friendBonus * userReputation;
  }

  private calculateTrendingScore(post: any): number {
    const timeDecay = Math.exp(-0.05 * (Date.now() - post.createdAt?.toDate().getTime()) / (24 * 60 * 60 * 1000));
    const engagementScore = (post.likeCount || 0) * 1 + (post.commentCount || 0) * 2 + (post.shareCount || 0) * 3;
    const velocityScore = (post.viewCount || 0) / Math.max(1, (Date.now() - post.createdAt?.toDate().getTime()) / (60 * 60 * 1000));

    return timeDecay * (engagementScore + velocityScore);
  }

  private async areFriends(userId1: string, userId2: string): Promise<boolean> {
    if (userId1 === userId2) return false;

    const friendshipQuery = query(
      collection(db, 'friendships'),
      where('userId', '==', userId1),
      where('friendId', '==', userId2),
      where('status', '==', 'accepted')
    );

    const friendshipSnapshot = await getDocs(friendshipQuery);
    return !friendshipSnapshot.empty;
  }

  // Feed Retrieval with Cursor-based Pagination
  async getFeed(
    userId: string, 
    feedType: FeedTypeEnum, 
    pageSize: number = 20, 
    cursor?: string
  ): Promise<ApiResponse<FeedResponse>> {
    try {
      const startTime = Date.now();
      
      // Build query based on feed type
      let feedQuery = query(
        collection(db, 'feedEntries'),
        where('userId', '==', userId),
        where('feedType', '==', feedType),
        where('isVisible', '==', true),
        limit(pageSize + 1) // Get one extra to check if there are more
      );

      // Add ordering based on feed type
      switch (feedType) {
        case FeedTypeEnum.CHRONOLOGICAL:
          feedQuery = query(feedQuery, orderBy('chronologicalRank', 'asc'));
          break;
        case FeedTypeEnum.ALGORITHMIC:
          feedQuery = query(feedQuery, orderBy('algorithmicRank', 'asc'));
          break;
        case FeedTypeEnum.FRIENDS:
          feedQuery = query(feedQuery, orderBy('friendsRank', 'asc'));
          break;
        case FeedTypeEnum.TRENDING:
          feedQuery = query(feedQuery, orderBy('trendingRank', 'asc'));
          break;
      }

      // Apply cursor if provided
      if (cursor) {
        try {
          const cursorData = this.decodeCursor(cursor);
          const cursorDoc = await this.getFeedEntryByCursor(cursorData);
          if (cursorDoc) {
            feedQuery = query(feedQuery, startAfter(cursorDoc));
          }
        } catch (error) {
          console.warn('Invalid cursor provided, starting from beginning');
        }
      }

      const feedSnapshot = await getDocs(feedQuery);
      const feedEntries = feedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Check if there are more entries
      const hasMore = feedEntries.length > pageSize;
      const posts = hasMore ? feedEntries.slice(0, pageSize) : feedEntries;

      // Get post details for each feed entry
      const postsWithDetails = await this.enrichFeedEntries(posts);

      // Generate next cursor
      let nextCursor: string | undefined;
      if (hasMore && posts.length > 0) {
        const lastPost = posts[posts.length - 1];
        nextCursor = this.encodeCursor(lastPost);
      }

      // Update analytics
      this.updateFeedAnalytics(userId, feedType, posts.length, Date.now() - startTime);

      const loadTime = Date.now() - startTime;
      console.log(`Feed loaded for user ${userId}, feed ${feedType} in ${loadTime}ms`);

      return {
        success: true,
        data: {
          posts: postsWithDetails,
          nextCursor,
          hasMore,
          totalCount: posts.length,
          loadTime,
          cacheHit: false // TODO: Implement cache detection
        }
      };
    } catch (error) {
      console.error('Error getting feed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feed'
      };
    }
  }

  private async enrichFeedEntries(feedEntries: any[]): Promise<FeedEntryWithPost[]> {
    const enrichedEntries: FeedEntryWithPost[] = [];

    for (const entry of feedEntries) {
      try {
        // Get post details
        const postDoc = await getDoc(doc(db, 'posts', entry.postId));
        if (!postDoc.exists()) continue;

        const postData = postDoc.data();
        
        // Get user details
        const userDoc = await getDoc(doc(db, 'users', entry.postUserId));
        const userData = userDoc.exists() ? userDoc.data() : {};

        const enrichedEntry: FeedEntryWithPost = {
          ...entry,
          post: {
            id: entry.postId,
            primaryDescription: postData.primaryDescription || '',
            primaryPhotoUrl: postData.primaryPhotoUrl || '',
            primaryLink: postData.primaryLink || '',
            linkLabel: postData.linkLabel,
            engagement: postData.engagement || 0,
            createdAt: postData.createdAt?.toDate() || new Date(),
            user: {
              id: entry.postUserId,
              username: userData.username || '',
              name: userData.name || '',
              profilePictureUrl: userData.profilePictureUrl,
            }
          }
        };

        enrichedEntries.push(enrichedEntry);
      } catch (error) {
        console.error(`Error enriching feed entry ${entry.id}:`, error);
      }
    }

    return enrichedEntries;
  }

  // Cursor Management
  private encodeCursor(feedEntry: any): string {
    const data = {
      postId: feedEntry.postId,
      rank: feedEntry.chronologicalRank || feedEntry.algorithmicRank || feedEntry.friendsRank || feedEntry.trendingRank,
      score: feedEntry.score,
      timestamp: feedEntry.postCreatedAt?.toISOString()
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { postId: string; rank: number; score?: number; timestamp?: string } {
    try {
      const data = JSON.parse(Buffer.from(cursor, 'base64').toString());
      return {
        postId: data.postId,
        rank: data.rank,
        score: data.score,
        timestamp: data.timestamp
      };
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  private async getFeedEntryByCursor(cursorData: any): Promise<any> {
    const query = query(
      collection(db, 'feedEntries'),
      where('postId', '==', cursorData.postId),
      limit(1)
    );
    
    const snapshot = await getDocs(query);
    return snapshot.docs[0] || null;
  }

  // Job Management
  async createFeedGenerationJob(context: FeedGenerationContext): Promise<ApiResponse<string>> {
    try {
      const jobData = {
        jobType: context.postId ? JobTypeEnum.POST_CREATED : JobTypeEnum.BULK_UPDATE,
        userId: context.userId,
        postId: context.postId,
        affectedUserIds: context.affectedUserIds || [],
        feedTypes: [context.feedType],
        priority: context.priority || 5,
        status: JobStatusEnum.PENDING,
        attempts: 0,
        maxAttempts: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'feedGenerationJobs'), jobData);
      
      return {
        success: true,
        data: docRef.id
      };
    } catch (error) {
      console.error('Error creating feed generation job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create job'
      };
    }
  }

  async processFeedGenerationJobs(): Promise<ApiResponse<void>> {
    try {
      // Get pending jobs ordered by priority
      const jobsQuery = query(
        collection(db, 'feedGenerationJobs'),
        where('status', '==', JobStatusEnum.PENDING),
        orderBy('priority', 'desc'),
        orderBy('createdAt', 'asc'),
        limit(10) // Process 10 jobs at a time
      );

      const jobsSnapshot = await getDocs(jobsQuery);
      const batch = writeBatch(db);

      for (const jobDoc of jobsSnapshot.docs) {
        const job = jobDoc.data() as FeedGenerationJob;
        
        try {
          // Mark job as processing
          batch.update(jobDoc.ref, {
            status: JobStatusEnum.PROCESSING,
            startedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Process the job
          if (job.feedTypes) {
            for (const feedType of job.feedTypes) {
              await this.generateFeedForUser(job.userId!, feedType, job.postId);
            }
          }

          // Mark job as completed
          batch.update(jobDoc.ref, {
            status: JobStatusEnum.COMPLETED,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

        } catch (error) {
          console.error(`Error processing job ${jobDoc.id}:`, error);
          
          // Mark job as failed
          batch.update(jobDoc.ref, {
            status: JobStatusEnum.FAILED,
            attempts: increment(1),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      
      return { success: true };
    } catch (error) {
      console.error('Error processing feed generation jobs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process jobs'
      };
    }
  }

  // Analytics
  private async updateFeedAnalytics(userId: string, feedType: FeedTypeEnum, postCount: number, loadTime: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const analyticsRef = doc(db, 'feedAnalytics', `${userId}_${feedType}_${today.toISOString().split('T')[0]}`);
      
      await updateDoc(analyticsRef, {
        userId,
        feedType,
        date: today,
        totalPosts: increment(postCount),
        totalViews: increment(1),
        avgLoadTime: increment(loadTime),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating feed analytics:', error);
    }
  }

  // Real-time Feed Updates
  subscribeToFeedUpdates(
    userId: string, 
    feedType: FeedTypeEnum, 
    callback: (updates: FeedEntryWithPost[]) => void
  ): () => void {
    const feedQuery = query(
      collection(db, 'feedEntries'),
      where('userId', '==', userId),
      where('feedType', '==', feedType),
      where('isVisible', '==', true),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(feedQuery, async (snapshot) => {
      const newEntries = snapshot.docs
        .filter(doc => doc.metadata.hasPendingWrites || doc.metadata.fromCache === false)
        .map(doc => ({ id: doc.id, ...doc.data() }));

      if (newEntries.length > 0) {
        const enrichedEntries = await this.enrichFeedEntries(newEntries);
        callback(enrichedEntries);
      }
    });

    return unsubscribe;
  }

  // Cleanup old feed data
  async cleanupOldFeedData(): Promise<ApiResponse<void>> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const oldEntriesQuery = query(
        collection(db, 'feedEntries'),
        where('expiresAt', '<', cutoffDate)
      );

      const oldEntries = await getDocs(oldEntriesQuery);
      const batch = writeBatch(db);

      oldEntries.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`Cleaned up ${oldEntries.docs.length} old feed entries`);

      return { success: true };
    } catch (error) {
      console.error('Error cleaning up old feed data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup feed data'
      };
    }
  }
}

export const feedService = FeedService.getInstance(); 