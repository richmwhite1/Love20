"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertSystemConfig = exports.insertModerationAction = exports.insertAuditLog = exports.insertAdminUser = exports.contentReviewQueue = exports.bulkOperations = exports.systemConfig = exports.moderationActions = exports.auditLogs = exports.adminSessions = exports.adminUsers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
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
// Insert schemas
exports.insertAdminUser = (0, drizzle_zod_1.createInsertSchema)(exports.adminUsers).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertAuditLog = (0, drizzle_zod_1.createInsertSchema)(exports.auditLogs).omit({
    id: true,
    createdAt: true,
});
exports.insertModerationAction = (0, drizzle_zod_1.createInsertSchema)(exports.moderationActions).omit({
    id: true,
    createdAt: true,
});
exports.insertSystemConfig = (0, drizzle_zod_1.createInsertSchema)(exports.systemConfig).omit({
    id: true,
    updatedAt: true,
});
