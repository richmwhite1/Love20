"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFriendRequestSchema = exports.createFriendshipSchema = exports.createCommentSchema = exports.insertCommentSchema = exports.createAccessRequestSchema = exports.respondListAccessSchema = exports.createListAccessSchema = exports.createListSchema = exports.insertListSchema = exports.createPostRequestSchema = exports.createPostSchema = exports.insertPostSchema = exports.signInSchema = exports.signUpSchema = exports.insertUserSchema = exports.accessRequests = exports.listAccess = exports.taskAssignments = exports.taggedPosts = exports.postFlags = exports.reposts = exports.savedPosts = exports.postViews = exports.contentReviewQueue = exports.bulkOperations = exports.systemConfig = exports.moderationActions = exports.auditLogs = exports.adminSessions = exports.adminUsers = exports.blacklist = exports.rsvps = exports.hashtagFollows = exports.reports = exports.notifications = exports.commentHashtags = exports.commentTags = exports.postTags = exports.postHashtags = exports.hashtags = exports.friendRequests = exports.friendships = exports.profileEnergyRatings = exports.postEnergyRatings = exports.postShares = exports.postLikes = exports.comments = exports.posts = exports.lists = exports.users = void 0;
exports.urlMappings = exports.urlClicks = exports.createNotificationSchema = exports.createRsvpSchema = exports.createReportSchema = exports.createHashtagSchema = exports.respondFriendRequestSchema = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    profilePictureUrl: (0, pg_core_1.text)("profile_picture_url"),
    defaultPrivacy: (0, pg_core_1.text)("default_privacy").notNull().default("public"), // public, connections
    auraRating: (0, pg_core_1.text)("aura_rating").default("4.00"), // User's average aura rating (1-7 scale)
    ratingCount: (0, pg_core_1.integer)("rating_count").default(0), // Number of ratings received
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at"),
});
exports.lists = (0, pg_core_1.pgTable)("lists", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(false),
    privacyLevel: (0, pg_core_1.text)("privacy_level").notNull().default("public"), // public, connections, private
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.posts = (0, pg_core_1.pgTable)("posts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    listId: (0, pg_core_1.integer)("list_id").notNull().default(1), // Default to "General" list
    primaryPhotoUrl: (0, pg_core_1.text)("primary_photo_url").notNull(),
    primaryLink: (0, pg_core_1.text)("primary_link").notNull(),
    linkLabel: (0, pg_core_1.text)("link_label"), // Optional custom label for the link
    primaryDescription: (0, pg_core_1.text)("primary_description").notNull(),
    discountCode: (0, pg_core_1.text)("discount_code"),
    additionalPhotos: (0, pg_core_1.text)("additional_photos").array(),
    additionalPhotoData: (0, pg_core_1.json)("additional_photo_data"), // Array of {url, link, description} objects
    spotifyUrl: (0, pg_core_1.text)("spotify_url"),
    spotifyLabel: (0, pg_core_1.text)("spotify_label"), // Optional custom label for Spotify link
    youtubeUrl: (0, pg_core_1.text)("youtube_url"),
    youtubeLabel: (0, pg_core_1.text)("youtube_label"), // Optional custom label for YouTube link
    mediaMetadata: (0, pg_core_1.json)("media_metadata"), // Stores metadata from link previews
    privacy: (0, pg_core_1.text)("privacy").notNull().default("public"), // public, friends, private
    engagement: (0, pg_core_1.integer)("engagement").notNull().default(0),
    // Event functionality
    isEvent: (0, pg_core_1.boolean)("is_event").notNull().default(false),
    eventDate: (0, pg_core_1.timestamp)("event_date"),
    reminders: (0, pg_core_1.text)("reminders").array(), // ["1_month", "2_weeks", "1_week", "3_days", "1_day"] - day_of is automatic
    isRecurring: (0, pg_core_1.boolean)("is_recurring").notNull().default(false),
    recurringType: (0, pg_core_1.text)("recurring_type"), // "weekly", "monthly", "annually"
    taskList: (0, pg_core_1.json)("task_list"), // Array of {id, text, completed, completedBy: userId}
    attachedLists: (0, pg_core_1.integer)("attached_lists").array(), // Array of list IDs attached to this event
    allowRsvp: (0, pg_core_1.boolean)("allow_rsvp").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.comments = (0, pg_core_1.pgTable)("comments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    parentId: (0, pg_core_1.integer)("parent_id"),
    text: (0, pg_core_1.text)("text").notNull(),
    imageUrl: (0, pg_core_1.text)("image_url"),
    rating: (0, pg_core_1.integer)("rating"), // 1-5 star rating
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.postLikes = (0, pg_core_1.pgTable)("post_likes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.postShares = (0, pg_core_1.pgTable)("post_shares", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id"),
    sharedAt: (0, pg_core_1.timestamp)("shared_at").notNull().defaultNow(),
});
// Energy/Aura rating system (1-7 chakra scale)
exports.postEnergyRatings = (0, pg_core_1.pgTable)("post_energy_ratings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull().references(() => exports.posts.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    rating: (0, pg_core_1.integer)("rating").notNull(), // 1-7 (red to violet chakra)
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    postUserUnique: (0, pg_core_1.unique)().on(table.postId, table.userId),
}));
exports.profileEnergyRatings = (0, pg_core_1.pgTable)("profile_energy_ratings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    profileId: (0, pg_core_1.integer)("profile_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    rating: (0, pg_core_1.integer)("rating").notNull(), // 1-7 (red to violet chakra)
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
}, (table) => ({
    profileUserUnique: (0, pg_core_1.unique)().on(table.profileId, table.userId),
}));
// Friends system
exports.friendships = (0, pg_core_1.pgTable)("friendships", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    friendId: (0, pg_core_1.integer)("friend_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    status: (0, pg_core_1.text)("status").notNull().default("accepted"), // accepted, blocked
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.friendRequests = (0, pg_core_1.pgTable)("friend_requests", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    fromUserId: (0, pg_core_1.integer)("from_user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    toUserId: (0, pg_core_1.integer)("to_user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, accepted, rejected
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Hashtags
exports.hashtags = (0, pg_core_1.pgTable)("hashtags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull().unique(),
    count: (0, pg_core_1.integer)("count").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.postHashtags = (0, pg_core_1.pgTable)("post_hashtags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    hashtagId: (0, pg_core_1.integer)("hashtag_id").notNull(),
});
// Tagged users in posts
exports.postTags = (0, pg_core_1.pgTable)("post_tags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
});
// Comment tags
exports.commentTags = (0, pg_core_1.pgTable)("comment_tags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    commentId: (0, pg_core_1.integer)("comment_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
});
// Comment hashtags
exports.commentHashtags = (0, pg_core_1.pgTable)("comment_hashtags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    commentId: (0, pg_core_1.integer)("comment_id").notNull(),
    hashtagId: (0, pg_core_1.integer)("hashtag_id").notNull(),
});
// Notifications
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // tag, friend_request, like, comment, share, friend_accept, list_invite, list_access_request, list_invitation, access_request, access_response
    postId: (0, pg_core_1.integer)("post_id"),
    fromUserId: (0, pg_core_1.integer)("from_user_id"),
    viewed: (0, pg_core_1.boolean)("viewed").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Reports for admin
exports.reports = (0, pg_core_1.pgTable)("reports", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    reason: (0, pg_core_1.text)("reason").notNull(),
    comment: (0, pg_core_1.text)("comment"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Hashtag follows
exports.hashtagFollows = (0, pg_core_1.pgTable)("hashtag_follows", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    hashtagId: (0, pg_core_1.integer)("hashtag_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// RSVP responses for events
exports.rsvps = (0, pg_core_1.pgTable)("rsvps", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    status: (0, pg_core_1.text)("status").notNull(), // "going", "maybe", "not_going"
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// Blacklist for admin
exports.blacklist = (0, pg_core_1.pgTable)("blacklist", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    type: (0, pg_core_1.text)("type").notNull(), // url, hashtag
    value: (0, pg_core_1.text)("value").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Admin users table
exports.adminUsers = (0, pg_core_1.pgTable)("admin_users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    role: (0, pg_core_1.text)("role").notNull().default("moderator"), // super_admin, moderator, content_admin
    permissions: (0, pg_core_1.text)("permissions").array().notNull().default([]), // ['user_management', 'content_moderation', 'system_config']
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    lastLogin: (0, pg_core_1.timestamp)("last_login"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// Admin sessions for authentication
exports.adminSessions = (0, pg_core_1.pgTable)("admin_sessions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    adminId: (0, pg_core_1.integer)("admin_id").notNull().references(() => exports.adminUsers.id, { onDelete: "cascade" }),
    sessionToken: (0, pg_core_1.text)("session_token").notNull().unique(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Audit logs for admin actions
exports.auditLogs = (0, pg_core_1.pgTable)("audit_logs", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    adminId: (0, pg_core_1.integer)("admin_id").notNull().references(() => exports.adminUsers.id),
    action: (0, pg_core_1.text)("action").notNull(), // 'user_ban', 'content_remove', 'config_update', etc.
    target: (0, pg_core_1.text)("target").notNull(), // 'user', 'post', 'list', 'system'
    targetId: (0, pg_core_1.integer)("target_id"), // ID of the affected entity
    details: (0, pg_core_1.json)("details"), // Additional context about the action
    ipAddress: (0, pg_core_1.text)("ip_address"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Moderation actions
exports.moderationActions = (0, pg_core_1.pgTable)("moderation_actions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    moderatorId: (0, pg_core_1.integer)("moderator_id").notNull().references(() => exports.adminUsers.id),
    contentType: (0, pg_core_1.text)("content_type").notNull(), // 'post', 'user', 'comment', 'list'
    contentId: (0, pg_core_1.integer)("content_id").notNull(),
    action: (0, pg_core_1.text)("action").notNull(), // 'approve', 'reject', 'flag', 'ban', 'warn'
    reason: (0, pg_core_1.text)("reason").notNull(),
    notes: (0, pg_core_1.text)("notes"),
    status: (0, pg_core_1.text)("status").notNull().default("active"), // 'active', 'reversed', 'expired'
    expiresAt: (0, pg_core_1.timestamp)("expires_at"), // For temporary actions like temporary bans
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// System configuration
exports.systemConfig = (0, pg_core_1.pgTable)("system_config", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    key: (0, pg_core_1.text)("key").notNull().unique(),
    value: (0, pg_core_1.text)("value").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // 'string', 'number', 'boolean', 'json'
    description: (0, pg_core_1.text)("description"),
    category: (0, pg_core_1.text)("category").notNull(), // 'privacy', 'limits', 'features', 'maintenance'
    updatedBy: (0, pg_core_1.integer)("updated_by").references(() => exports.adminUsers.id),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// Bulk operations tracking
exports.bulkOperations = (0, pg_core_1.pgTable)("bulk_operations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    operationId: (0, pg_core_1.text)("operation_id").notNull().unique(),
    type: (0, pg_core_1.text)("type").notNull(), // 'user_import', 'content_migration', 'data_cleanup'
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
    progress: (0, pg_core_1.integer)("progress").notNull().default(0), // Percentage
    totalItems: (0, pg_core_1.integer)("total_items").notNull().default(0),
    processedItems: (0, pg_core_1.integer)("processed_items").notNull().default(0),
    errors: (0, pg_core_1.json)("errors").notNull().default([]),
    metadata: (0, pg_core_1.json)("metadata"), // Operation-specific data
    initiatedBy: (0, pg_core_1.integer)("initiated_by").notNull().references(() => exports.adminUsers.id),
    startedAt: (0, pg_core_1.timestamp)("started_at").notNull().defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
// Content review queue
exports.contentReviewQueue = (0, pg_core_1.pgTable)("content_review_queue", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    contentType: (0, pg_core_1.text)("content_type").notNull(), // 'post', 'comment', 'list'
    contentId: (0, pg_core_1.integer)("content_id").notNull(),
    priority: (0, pg_core_1.text)("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
    reason: (0, pg_core_1.text)("reason").notNull(), // Why it's in review queue
    flagCount: (0, pg_core_1.integer)("flag_count").notNull().default(1),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // 'pending', 'reviewed', 'escalated'
    assignedTo: (0, pg_core_1.integer)("assigned_to").references(() => exports.adminUsers.id),
    reviewedBy: (0, pg_core_1.integer)("reviewed_by").references(() => exports.adminUsers.id),
    reviewedAt: (0, pg_core_1.timestamp)("reviewed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Post views tracking
exports.postViews = (0, pg_core_1.pgTable)("post_views", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id"), // null for anonymous views
    viewType: (0, pg_core_1.text)("view_type").notNull(), // "feed", "expanded", "profile"
    viewDuration: (0, pg_core_1.integer)("view_duration"), // milliseconds
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Saved posts to user lists
exports.savedPosts = (0, pg_core_1.pgTable)("saved_posts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    categoryId: (0, pg_core_1.integer)("category_id").notNull(), // which list it's saved to
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// User reposts
exports.reposts = (0, pg_core_1.pgTable)("reposts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    originalPostId: (0, pg_core_1.integer)("original_post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Post flags for moderation
exports.postFlags = (0, pg_core_1.pgTable)("post_flags", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    reason: (0, pg_core_1.text)("reason"), // optional reason for flagging
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Tagged posts for "shared with you" feed
exports.taggedPosts = (0, pg_core_1.pgTable)("tagged_posts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    fromUserId: (0, pg_core_1.integer)("from_user_id").notNull(), // who tagged
    toUserId: (0, pg_core_1.integer)("to_user_id").notNull(), // who was tagged
    isViewed: (0, pg_core_1.boolean)("is_viewed").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// Task assignments for events
exports.taskAssignments = (0, pg_core_1.pgTable)("task_assignments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    postId: (0, pg_core_1.integer)("post_id").notNull(),
    taskId: (0, pg_core_1.text)("task_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(),
    assignedAt: (0, pg_core_1.timestamp)("assigned_at").notNull().defaultNow(),
});
// List access control for private lists
exports.listAccess = (0, pg_core_1.pgTable)("list_access", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    listId: (0, pg_core_1.integer)("list_id").notNull().references(() => exports.lists.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    role: (0, pg_core_1.text)("role").notNull(), // "collaborator" (edit), "viewer" (read-only)
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, accepted, rejected
    invitedBy: (0, pg_core_1.integer)("invited_by").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// Access requests for private lists
exports.accessRequests = (0, pg_core_1.pgTable)("access_requests", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    listId: (0, pg_core_1.integer)("list_id").notNull().references(() => exports.lists.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.integer)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    requestedRole: (0, pg_core_1.text)("requested_role").notNull(), // "collaborator" or "viewer"
    message: (0, pg_core_1.text)("message"), // optional message from requester
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, approved, rejected
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
// User schemas
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).pick({
    username: true,
    password: true,
    name: true,
    profilePictureUrl: true,
});
exports.signUpSchema = exports.insertUserSchema.extend({
    username: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    name: zod_1.z.string().min(1).max(50, "Name must be between 1 and 50 characters"),
});
exports.signInSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
// Post schemas
exports.insertPostSchema = (0, drizzle_zod_1.createInsertSchema)(exports.posts).pick({
    primaryPhotoUrl: true,
    primaryLink: true,
    linkLabel: true,
    primaryDescription: true,
    discountCode: true,
    additionalPhotos: true,
    additionalPhotoData: true,
    spotifyUrl: true,
    spotifyLabel: true,
    youtubeUrl: true,
    youtubeLabel: true,
    mediaMetadata: true,
    privacy: true,
    isEvent: true,
    eventDate: true,
    reminders: true,
    isRecurring: true,
    recurringType: true,
    taskList: true,
    allowRsvp: true,
});
exports.createPostSchema = exports.insertPostSchema.extend({
    primaryLink: zod_1.z.string().url("Must be a valid URL"),
    primaryDescription: zod_1.z.string().min(1).max(500, "Description must be between 1 and 500 characters"),
    discountCode: zod_1.z.string().optional(),
    additionalPhotos: zod_1.z.array(zod_1.z.string()).optional(),
    spotifyUrl: zod_1.z.string().url("Must be a valid Spotify URL").optional().refine((url) => !url || url.includes("spotify.com") || url.includes("open.spotify.com"), "Must be a valid Spotify URL"),
    youtubeUrl: zod_1.z.string().url("Must be a valid YouTube URL").optional().refine((url) => !url || url.includes("youtube.com") || url.includes("youtu.be"), "Must be a valid YouTube URL"),
    // Event fields
    isEvent: zod_1.z.boolean().optional(),
    eventDate: zod_1.z.string().optional(),
    reminders: zod_1.z.array(zod_1.z.enum(["1_month", "2_weeks", "1_week", "3_days", "1_day"])).optional(),
    isRecurring: zod_1.z.boolean().optional(),
    recurringType: zod_1.z.enum(["weekly", "monthly", "annually"]).optional(),
    taskList: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        text: zod_1.z.string(),
        completed: zod_1.z.boolean().default(false),
        completedBy: zod_1.z.number().optional(),
    })).optional(),
    allowRsvp: zod_1.z.boolean().optional(),
});
exports.createPostRequestSchema = zod_1.z.object({
    primaryLink: zod_1.z.string().optional(),
    linkLabel: zod_1.z.string().optional(),
    primaryDescription: zod_1.z.string().min(1).max(500, "Description must be between 1 and 500 characters"),
    discountCode: zod_1.z.string().optional(),
    listId: zod_1.z.coerce.number().optional(),
    spotifyUrl: zod_1.z.string().optional(),
    spotifyLabel: zod_1.z.string().optional(),
    youtubeUrl: zod_1.z.string().optional(),
    youtubeLabel: zod_1.z.string().optional(),
    hashtags: zod_1.z.string().optional(),
    privacy: zod_1.z.enum(["public", "connections", "private"]).default("public"),
    taggedUsers: zod_1.z.string().optional(), // JSON string of user IDs
    // Event fields
    isEvent: zod_1.z.string().optional(), // "true" or "false" as string from form
    eventDate: zod_1.z.string().optional(),
    reminders: zod_1.z.string().optional(), // JSON string of reminder array
    isRecurring: zod_1.z.string().optional(), // "true" or "false" as string from form
    recurringType: zod_1.z.enum(["weekly", "monthly", "annually"]).optional(),
    taskList: zod_1.z.string().optional(), // JSON string of task array
    attachedLists: zod_1.z.string().optional(), // JSON string of list ID array
    allowRsvp: zod_1.z.string().optional(), // "true" or "false" as string from form
}).transform((data) => {
    // Transform empty strings to undefined
    return {
        ...data,
        primaryLink: data.primaryLink?.trim() || undefined,
        spotifyUrl: data.spotifyUrl?.trim() || undefined,
        youtubeUrl: data.youtubeUrl?.trim() || undefined,
    };
}).refine((data) => {
    // At least one of primaryLink, spotifyUrl, or youtubeUrl must be provided (and not empty)
    const hasValidUrl = (data.primaryLink && data.primaryLink.trim()) ||
        (data.spotifyUrl && data.spotifyUrl.trim()) ||
        (data.youtubeUrl && data.youtubeUrl.trim());
    return hasValidUrl;
}, {
    message: "At least one URL (Primary Link, Spotify, or YouTube) is required",
    path: []
}).refine((data) => {
    // Validate URLs if provided
    if (data.primaryLink && !zod_1.z.string().url().safeParse(data.primaryLink).success) {
        return false;
    }
    if (data.spotifyUrl && (!zod_1.z.string().url().safeParse(data.spotifyUrl).success ||
        !(data.spotifyUrl.includes("spotify.com") || data.spotifyUrl.includes("open.spotify.com")))) {
        return false;
    }
    if (data.youtubeUrl && (!zod_1.z.string().url().safeParse(data.youtubeUrl).success ||
        !(data.youtubeUrl.includes("youtube.com") || data.youtubeUrl.includes("youtu.be")))) {
        return false;
    }
    return true;
}, {
    message: "Invalid URL format",
    path: ["primaryLink"]
});
// List schemas
exports.insertListSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lists).pick({
    name: true,
    description: true,
    isPublic: true,
    privacyLevel: true,
});
exports.createListSchema = exports.insertListSchema.extend({
    name: zod_1.z.string().min(1).max(50, "List name must be between 1 and 50 characters"),
    description: zod_1.z.string().max(200, "Description must be less than 200 characters").optional(),
    isPublic: zod_1.z.boolean().optional(),
    privacyLevel: zod_1.z.enum(["public", "connections", "private"]).default("public"),
});
// List access schemas
exports.createListAccessSchema = zod_1.z.object({
    listId: zod_1.z.number(),
    userId: zod_1.z.number(),
    role: zod_1.z.enum(["collaborator", "viewer"]),
});
exports.respondListAccessSchema = zod_1.z.object({
    accessId: zod_1.z.number(),
    action: zod_1.z.enum(["accept", "reject"]),
});
exports.createAccessRequestSchema = zod_1.z.object({
    listId: zod_1.z.number(),
    requestedRole: zod_1.z.enum(["collaborator", "viewer"]),
    message: zod_1.z.string().max(500).optional(),
});
// Comment schemas
exports.insertCommentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.comments).pick({
    text: true,
    imageUrl: true,
    parentId: true,
    rating: true,
});
exports.createCommentSchema = exports.insertCommentSchema.extend({
    text: zod_1.z.string().min(1).max(1000, "Comment must be between 1 and 1000 characters"),
    parentId: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
    rating: zod_1.z.number().min(1).max(5).optional(),
    hashtags: zod_1.z.array(zod_1.z.string()).optional(),
    taggedFriends: zod_1.z.array(zod_1.z.string()).optional(),
});
// Friendship schemas
exports.createFriendshipSchema = zod_1.z.object({
    friendId: zod_1.z.number(),
});
exports.createFriendRequestSchema = zod_1.z.object({
    toUserId: zod_1.z.number(),
});
exports.respondFriendRequestSchema = zod_1.z.object({
    requestId: zod_1.z.number(),
    action: zod_1.z.enum(["accept", "reject"]),
});
// Hashtag schemas
exports.createHashtagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, "Hashtag must be alphanumeric with underscores"),
});
// Report schemas
exports.createReportSchema = zod_1.z.object({
    postId: zod_1.z.number(),
    reason: zod_1.z.string().min(1).max(100),
    comment: zod_1.z.string().max(500).optional(),
});
// RSVP schemas
exports.createRsvpSchema = zod_1.z.object({
    postId: zod_1.z.number(),
    status: zod_1.z.enum(["going", "maybe", "not_going"]),
});
// Notification schemas
exports.createNotificationSchema = zod_1.z.object({
    userId: zod_1.z.number(),
    type: zod_1.z.enum(["tag", "friend_request", "like", "comment", "share", "friend_accept", "list_invite", "list_access_request"]),
    postId: zod_1.z.number().optional(),
    fromUserId: zod_1.z.number().optional(),
    categoryId: zod_1.z.number().optional(),
});
// URL tracking and management
exports.urlClicks = (0, pg_core_1.pgTable)("url_clicks", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    url: (0, pg_core_1.text)("url").notNull(),
    userId: (0, pg_core_1.integer)("user_id").references(() => exports.users.id),
    postId: (0, pg_core_1.integer)("post_id").references(() => exports.posts.id),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    referrer: (0, pg_core_1.text)("referrer"),
    clickedAt: (0, pg_core_1.timestamp)("clicked_at").notNull().defaultNow(),
});
exports.urlMappings = (0, pg_core_1.pgTable)("url_mappings", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    originalUrl: (0, pg_core_1.text)("original_url").notNull().unique(),
    currentUrl: (0, pg_core_1.text)("current_url").notNull(),
    discountCode: (0, pg_core_1.text)("discount_code"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
