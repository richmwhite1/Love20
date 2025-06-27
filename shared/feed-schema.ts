import { pgTable, text, serial, integer, boolean, timestamp, json, numeric, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Feed types
export const feedTypes = pgTable("feed_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'chronological', 'algorithmic', 'friends', 'trending'
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User feed preferences
export const userFeedPreferences = pgTable("user_feed_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  defaultFeedType: text("default_feed_type").notNull().default("chronological"),
  chronologicalEnabled: boolean("chronological_enabled").notNull().default(true),
  algorithmicEnabled: boolean("algorithmic_enabled").notNull().default(true),
  friendsEnabled: boolean("friends_enabled").notNull().default(true),
  trendingEnabled: boolean("trending_enabled").notNull().default(true),
  autoRefresh: boolean("auto_refresh").notNull().default(true),
  refreshInterval: integer("refresh_interval").notNull().default(30000), // 30 seconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_feed_preferences_user_idx").on(table.userId),
}));

// Precomputed feed entries
export const feedEntries = pgTable("feed_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Feed owner
  postId: integer("post_id").notNull(),
  postUserId: integer("post_user_id").notNull(), // Original post author
  feedType: text("feed_type").notNull(), // 'chronological', 'algorithmic', 'friends', 'trending'
  score: numeric("score", { precision: 10, scale: 6 }), // Algorithmic score
  chronologicalRank: integer("chronological_rank"), // Position in chronological feed
  algorithmicRank: integer("algorithmic_rank"), // Position in algorithmic feed
  friendsRank: integer("friends_rank"), // Position in friends feed
  trendingRank: integer("trending_rank"), // Position in trending feed
  postCreatedAt: timestamp("post_created_at").notNull(),
  postUpdatedAt: timestamp("post_updated_at").notNull(),
  postPrivacy: text("post_privacy").notNull(), // 'public', 'friends', 'private'
  postEngagement: integer("post_engagement").notNull().default(0),
  postViewCount: integer("post_view_count").notNull().default(0),
  postLikeCount: integer("post_like_count").notNull().default(0),
  postCommentCount: integer("post_comment_count").notNull().default(0),
  postShareCount: integer("post_share_count").notNull().default(0),
  userRelationship: text("user_relationship"), // 'self', 'friend', 'public', 'blocked'
  userPrivacyLevel: text("user_privacy_level"), // User's privacy setting
  isVisible: boolean("is_visible").notNull().default(true),
  expiresAt: timestamp("expires_at"), // For cleanup
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userFeedTypeIdx: index("feed_entries_user_feed_type_idx").on(table.userId, table.feedType),
  postIdx: index("feed_entries_post_idx").on(table.postId),
  scoreIdx: index("feed_entries_score_idx").on(table.score),
  chronologicalIdx: index("feed_entries_chronological_idx").on(table.userId, table.feedType, table.chronologicalRank),
  algorithmicIdx: index("feed_entries_algorithmic_idx").on(table.userId, table.feedType, table.algorithmicRank),
  friendsIdx: index("feed_entries_friends_idx").on(table.userId, table.feedType, table.friendsRank),
  trendingIdx: index("feed_entries_trending_idx").on(table.userId, table.feedType, table.trendingRank),
  expiresIdx: index("feed_entries_expires_idx").on(table.expiresAt),
}));

// Feed cursors for pagination
export const feedCursors = pgTable("feed_cursors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  feedType: text("feed_type").notNull(),
  cursor: text("cursor").notNull(), // Base64 encoded cursor
  lastSeenPostId: integer("last_seen_post_id"),
  lastSeenRank: integer("last_seen_rank"),
  lastSeenScore: numeric("last_seen_score", { precision: 10, scale: 6 }),
  lastSeenTimestamp: timestamp("last_seen_timestamp"),
  pageSize: integer("page_size").notNull().default(20),
  totalSeen: integer("total_seen").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userFeedTypeIdx: index("feed_cursors_user_feed_type_idx").on(table.userId, table.feedType),
}));

// Feed generation jobs
export const feedGenerationJobs = pgTable("feed_generation_jobs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(), // 'post_created', 'privacy_changed', 'friendship_changed', 'cleanup'
  userId: integer("user_id"), // Target user for feed generation
  postId: integer("post_id"), // Related post
  affectedUserIds: integer("affected_user_ids").array(), // Users affected by the change
  feedTypes: text("feed_types").array(), // Feed types to regenerate
  priority: integer("priority").notNull().default(5), // 1-10, higher = more important
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("feed_generation_jobs_status_idx").on(table.status),
  priorityIdx: index("feed_generation_jobs_priority_idx").on(table.priority),
  createdAtIdx: index("feed_generation_jobs_created_at_idx").on(table.createdAt),
}));

// Feed analytics
export const feedAnalytics = pgTable("feed_analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  feedType: text("feed_type").notNull(),
  date: timestamp("date").notNull(),
  totalPosts: integer("total_posts").notNull().default(0),
  totalViews: integer("total_views").notNull().default(0),
  totalEngagement: integer("total_engagement").notNull().default(0),
  avgLoadTime: numeric("avg_load_time", { precision: 8, scale: 3 }), // milliseconds
  cacheHitRate: numeric("cache_hit_rate", { precision: 5, scale: 2 }), // percentage
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userDateIdx: index("feed_analytics_user_date_idx").on(table.userId, table.date),
  feedTypeIdx: index("feed_analytics_feed_type_idx").on(table.feedType),
}));

// Zod schemas
export const insertFeedTypeSchema = createInsertSchema(feedTypes);
export const insertUserFeedPreferenceSchema = createInsertSchema(userFeedPreferences);
export const insertFeedEntrySchema = createInsertSchema(feedEntries);
export const insertFeedCursorSchema = createInsertSchema(feedCursors);
export const insertFeedGenerationJobSchema = createInsertSchema(feedGenerationJobs);
export const insertFeedAnalyticsSchema = createInsertSchema(feedAnalytics);

// TypeScript types
export type FeedType = typeof feedTypes.$inferSelect;
export type InsertFeedType = z.infer<typeof insertFeedTypeSchema>;

export type UserFeedPreference = typeof userFeedPreferences.$inferSelect;
export type InsertUserFeedPreference = z.infer<typeof insertUserFeedPreferenceSchema>;

export type FeedEntry = typeof feedEntries.$inferSelect;
export type InsertFeedEntry = z.infer<typeof insertFeedEntrySchema>;

export type InsertFeedCursor = z.infer<typeof insertFeedCursorSchema>;

export type FeedGenerationJob = typeof feedGenerationJobs.$inferSelect;
export type InsertFeedGenerationJob = z.infer<typeof insertFeedGenerationJobSchema>;

export type FeedAnalytics = typeof feedAnalytics.$inferSelect;
export type InsertFeedAnalytics = z.infer<typeof insertFeedAnalyticsSchema>;

// Feed types enum
export enum FeedTypeEnum {
  CHRONOLOGICAL = 'chronological',
  ALGORITHMIC = 'algorithmic',
  FRIENDS = 'friends',
  TRENDING = 'trending'
}

// Job types enum
export enum JobTypeEnum {
  POST_CREATED = 'post_created',
  PRIVACY_CHANGED = 'privacy_changed',
  FRIENDSHIP_CHANGED = 'friendship_changed',
  CLEANUP = 'cleanup',
  BULK_UPDATE = 'bulk_update'
}

// Job status enum
export enum JobStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Feed entry with related data
export type FeedEntryWithPost = FeedEntry & {
  post: {
    id: string;
    primaryDescription: string;
    primaryPhotoUrl: string;
    primaryLink: string;
    linkLabel?: string;
    engagement: number;
    createdAt: Date;
    user: {
      id: string;
      username: string;
      name: string;
      profilePictureUrl?: string;
    };
  };
};

// Feed response with pagination
export interface FeedResponse {
  posts: FeedEntryWithPost[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
  loadTime: number;
  cacheHit: boolean;
}

// Feed generation context
export interface FeedGenerationContext {
  userId: string;
  feedType: FeedTypeEnum;
  postId?: string;
  affectedUserIds?: string[];
  priority?: number;
}

// Cursor utilities
export class FeedCursor {
  static encode(postId: string, rank: number, score?: number, timestamp?: Date): string {
    const data = {
      postId,
      rank,
      score,
      timestamp: timestamp?.toISOString()
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  static decode(cursor: string): { postId: string; rank: number; score?: number; timestamp?: Date } {
    try {
      const data = JSON.parse(Buffer.from(cursor, 'base64').toString());
      return {
        postId: data.postId,
        rank: data.rank,
        score: data.score,
        timestamp: data.timestamp ? new Date(data.timestamp) : undefined
      };
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }
} 