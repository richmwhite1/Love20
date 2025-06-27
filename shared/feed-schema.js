"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedCursor = exports.JobStatusEnum = exports.JobTypeEnum = exports.FeedTypeEnum = exports.insertFeedAnalyticsSchema = exports.insertFeedGenerationJobSchema = exports.insertFeedCursorSchema = exports.insertFeedEntrySchema = exports.insertUserFeedPreferenceSchema = exports.insertFeedTypeSchema = exports.feedAnalytics = exports.feedGenerationJobs = exports.feedCursors = exports.feedEntries = exports.userFeedPreferences = exports.feedTypes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
// Feed types
exports.feedTypes = (0, pg_core_1.pgTable)("feed_types", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull().unique(), // 'chronological', 'algorithmic', 'friends', 'trending'
    description: (0, pg_core_1.text)("description"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// User feed preferences
exports.userFeedPreferences = (0, pg_core_1.pgTable)("user_feed_preferences", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    defaultFeedType: (0, pg_core_1.text)("default_feed_type").notNull().default("chronological"),
    chronologicalEnabled: (0, pg_core_1.boolean)("chronological_enabled").notNull().default(true),
    algorithmicEnabled: (0, pg_core_1.boolean)("algorithmic_enabled").notNull().default(true),
    friendsEnabled: (0, pg_core_1.boolean)("friends_enabled").notNull().default(true),
    trendingEnabled: (0, pg_core_1.boolean)("trending_enabled").notNull().default(true),
    autoRefresh: (0, pg_core_1.boolean)("auto_refresh").notNull().default(true),
    refreshInterval: (0, pg_core_1.integer)("refresh_interval").notNull().default(30000), // 30 seconds
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    userIdx: (0, pg_core_1.index)("user_feed_preferences_user_idx").on(table.userId),
}));
// Precomputed feed entries
exports.feedEntries = (0, pg_core_1.pgTable)("feed_entries", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(), // Feed owner
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    postUserId: (0, pg_core_1.integer)("post_user_id").notNull(), // Original post author
    feedType: (0, pg_core_1.text)("feed_type").notNull(), // 'chronological', 'algorithmic', 'friends', 'trending'
    score: (0, pg_core_1.numeric)("score", { precision: 10, scale: 6 }), // Algorithmic score
    chronologicalRank: (0, pg_core_1.integer)("chronological_rank"), // Position in chronological feed
    algorithmicRank: (0, pg_core_1.integer)("algorithmic_rank"), // Position in algorithmic feed
    friendsRank: (0, pg_core_1.integer)("friends_rank"), // Position in friends feed
    trendingRank: (0, pg_core_1.integer)("trending_rank"), // Position in trending feed
    postCreatedAt: (0, pg_core_1.timestamp)("post_created_at").notNull(),
    postUpdatedAt: (0, pg_core_1.timestamp)("post_updated_at").notNull(),
    postPrivacy: (0, pg_core_1.text)("post_privacy").notNull(), // 'public', 'friends', 'private'
    postEngagement: (0, pg_core_1.integer)("post_engagement").notNull().default(0),
    postViewCount: (0, pg_core_1.integer)("post_view_count").notNull().default(0),
    postLikeCount: (0, pg_core_1.integer)("post_like_count").notNull().default(0),
    postCommentCount: (0, pg_core_1.integer)("post_comment_count").notNull().default(0),
    postShareCount: (0, pg_core_1.integer)("post_share_count").notNull().default(0),
    userRelationship: (0, pg_core_1.text)("user_relationship"), // 'self', 'friend', 'public', 'blocked'
    userPrivacyLevel: (0, pg_core_1.text)("user_privacy_level"), // User's privacy setting
    isVisible: (0, pg_core_1.boolean)("is_visible").notNull().default(true),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"), // For cleanup
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    userFeedTypeIdx: (0, pg_core_1.index)("feed_entries_user_feed_type_idx").on(table.userId, table.feedType),
    postIdx: (0, pg_core_1.index)("feed_entries_post_idx").on(table.postId),
    scoreIdx: (0, pg_core_1.index)("feed_entries_score_idx").on(table.score),
    chronologicalIdx: (0, pg_core_1.index)("feed_entries_chronological_idx").on(table.userId, table.feedType, table.chronologicalRank),
    algorithmicIdx: (0, pg_core_1.index)("feed_entries_algorithmic_idx").on(table.userId, table.feedType, table.algorithmicRank),
    friendsIdx: (0, pg_core_1.index)("feed_entries_friends_idx").on(table.userId, table.feedType, table.friendsRank),
    trendingIdx: (0, pg_core_1.index)("feed_entries_trending_idx").on(table.userId, table.feedType, table.trendingRank),
    expiresIdx: (0, pg_core_1.index)("feed_entries_expires_idx").on(table.expiresAt),
}));
// Feed cursors for pagination
exports.feedCursors = (0, pg_core_1.pgTable)("feed_cursors", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    feedType: (0, pg_core_1.text)("feed_type").notNull(),
    cursor: (0, pg_core_1.text)("cursor").notNull(), // Base64 encoded cursor
    lastSeenPostId: (0, pg_core_1.integer)("last_seen_post_id"),
    lastSeenRank: (0, pg_core_1.integer)("last_seen_rank"),
    lastSeenScore: (0, pg_core_1.numeric)("last_seen_score", { precision: 10, scale: 6 }),
    lastSeenTimestamp: (0, pg_core_1.timestamp)("last_seen_timestamp"),
    pageSize: (0, pg_core_1.integer)("page_size").notNull().default(20),
    totalSeen: (0, pg_core_1.integer)("total_seen").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    userFeedTypeIdx: (0, pg_core_1.index)("feed_cursors_user_feed_type_idx").on(table.userId, table.feedType),
}));
// Feed generation jobs
exports.feedGenerationJobs = (0, pg_core_1.pgTable)("feed_generation_jobs", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    jobType: (0, pg_core_1.text)("job_type").notNull(), // 'post_created', 'privacy_changed', 'friendship_changed', 'cleanup'
    userId: (0, pg_core_1.integer)("user_id"), // Target user for feed generation
    postId: (0, pg_core_1.integer)("post_id"), // Related post
    affectedUserIds: (0, pg_core_1.integer)("affected_user_ids").array(), // Users affected by the change
    feedTypes: (0, pg_core_1.text)("feed_types").array(), // Feed types to regenerate
    priority: (0, pg_core_1.integer)("priority").notNull().default(5), // 1-10, higher = more important
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
    attempts: (0, pg_core_1.integer)("attempts").notNull().default(0),
    maxAttempts: (0, pg_core_1.integer)("max_attempts").notNull().default(3),
    errorMessage: (0, pg_core_1.text)("error_message"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    statusIdx: (0, pg_core_1.index)("feed_generation_jobs_status_idx").on(table.status),
    priorityIdx: (0, pg_core_1.index)("feed_generation_jobs_priority_idx").on(table.priority),
    createdAtIdx: (0, pg_core_1.index)("feed_generation_jobs_created_at_idx").on(table.createdAt),
}));
// Feed analytics
exports.feedAnalytics = (0, pg_core_1.pgTable)("feed_analytics", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    feedType: (0, pg_core_1.text)("feed_type").notNull(),
    date: (0, pg_core_1.timestamp)("date").notNull(),
    totalPosts: (0, pg_core_1.integer)("total_posts").notNull().default(0),
    totalViews: (0, pg_core_1.integer)("total_views").notNull().default(0),
    totalEngagement: (0, pg_core_1.integer)("total_engagement").notNull().default(0),
    avgLoadTime: (0, pg_core_1.numeric)("avg_load_time", { precision: 8, scale: 3 }), // milliseconds
    cacheHitRate: (0, pg_core_1.numeric)("cache_hit_rate", { precision: 5, scale: 2 }), // percentage
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
}, (table) => ({
    userDateIdx: (0, pg_core_1.index)("feed_analytics_user_date_idx").on(table.userId, table.date),
    feedTypeIdx: (0, pg_core_1.index)("feed_analytics_feed_type_idx").on(table.feedType),
}));
// Zod schemas
exports.insertFeedTypeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.feedTypes);
exports.insertUserFeedPreferenceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.userFeedPreferences);
exports.insertFeedEntrySchema = (0, drizzle_zod_1.createInsertSchema)(exports.feedEntries);
exports.insertFeedCursorSchema = (0, drizzle_zod_1.createInsertSchema)(exports.feedCursors);
exports.insertFeedGenerationJobSchema = (0, drizzle_zod_1.createInsertSchema)(exports.feedGenerationJobs);
exports.insertFeedAnalyticsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.feedAnalytics);
// Feed types enum
var FeedTypeEnum;
(function (FeedTypeEnum) {
    FeedTypeEnum["CHRONOLOGICAL"] = "chronological";
    FeedTypeEnum["ALGORITHMIC"] = "algorithmic";
    FeedTypeEnum["FRIENDS"] = "friends";
    FeedTypeEnum["TRENDING"] = "trending";
})(FeedTypeEnum || (exports.FeedTypeEnum = FeedTypeEnum = {}));
// Job types enum
var JobTypeEnum;
(function (JobTypeEnum) {
    JobTypeEnum["POST_CREATED"] = "post_created";
    JobTypeEnum["PRIVACY_CHANGED"] = "privacy_changed";
    JobTypeEnum["FRIENDSHIP_CHANGED"] = "friendship_changed";
    JobTypeEnum["CLEANUP"] = "cleanup";
    JobTypeEnum["BULK_UPDATE"] = "bulk_update";
})(JobTypeEnum || (exports.JobTypeEnum = JobTypeEnum = {}));
// Job status enum
var JobStatusEnum;
(function (JobStatusEnum) {
    JobStatusEnum["PENDING"] = "pending";
    JobStatusEnum["PROCESSING"] = "processing";
    JobStatusEnum["COMPLETED"] = "completed";
    JobStatusEnum["FAILED"] = "failed";
})(JobStatusEnum || (exports.JobStatusEnum = JobStatusEnum = {}));
// Cursor utilities
class FeedCursor {
    static encode(postId, rank, score, timestamp) {
        const data = {
            postId,
            rank,
            score,
            timestamp: timestamp?.toISOString()
        };
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
    static decode(cursor) {
        try {
            const data = JSON.parse(Buffer.from(cursor, 'base64').toString());
            return {
                postId: data.postId,
                rank: data.rank,
                score: data.score,
                timestamp: data.timestamp ? new Date(data.timestamp) : undefined
            };
        }
        catch (error) {
            throw new Error('Invalid cursor format');
        }
    }
}
exports.FeedCursor = FeedCursor;
