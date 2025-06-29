import { db } from "./firebase-db";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Simplified types for Firestore
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertAdminUser {
  username: string;
  email: string;
  password: string;
  role?: string;
  permissions?: string[];
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  target: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: Date;
}

export interface InsertAuditLog {
  adminId: string;
  action: string;
  target: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
}

export interface ModerationAction {
  id: string;
  moderatorId: string;
  contentType: string;
  contentId: string;
  action: string;
  reason: string;
  notes?: string;
  status: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface InsertModerationAction {
  moderatorId: string;
  contentType: string;
  contentId: string;
  action: string;
  reason: string;
  notes?: string;
  status?: string;
  expiresAt?: Date;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  type: string;
  description?: string;
  category: string;
  updatedBy?: string;
  updatedAt: Date;
}

export interface InsertSystemConfig {
  key: string;
  value: string;
  type: string;
  description?: string;
  category: string;
  updatedBy?: string;
}

export interface BulkOperation {
  id: string;
  operationId: string;
  type: string;
  status: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: any[];
  metadata?: any;
  initiatedBy: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ContentReviewItem {
  id: string;
  contentType: string;
  contentId: string;
  priority: string;
  reason: string;
  flagCount: number;
  status: string;
  assignedTo?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface UrlMapping {
  id: string;
  originalUrl: string;
  currentUrl: string;
  discountCode?: string;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UrlClick {
  id: string;
  url: string;
  userId?: string;
  postId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  timestamp: Date;
}

export interface IAdminStorage {
  // Admin Authentication
  authenticateAdmin(username: string, password: string): Promise<AdminUser | null>;
  createAdminSession(adminId: string, ipAddress?: string, userAgent?: string): Promise<string>;
  validateAdminSession(token: string): Promise<AdminUser | null>;
  revokeAdminSession(token: string): Promise<void>;
  
  // Admin User Management
  createAdminUser(userData: InsertAdminUser): Promise<AdminUser>;
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  updateAdminUser(id: string, updates: Partial<AdminUser>): Promise<void>;
  deleteAdminUser(id: string): Promise<void>;
  listAdminUsers(): Promise<AdminUser[]>;
  
  // Audit Logging
  logAdminAction(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { adminId?: string; action?: string; target?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]>;
  
  // Content Moderation
  addToReviewQueue(contentType: string, contentId: string, reason: string, priority?: string): Promise<ContentReviewItem>;
  getReviewQueue(filters?: { status?: string; assignedTo?: string; priority?: string }): Promise<ContentReviewItem[]>;
  assignReviewItem(itemId: string, adminId: string): Promise<void>;
  processReviewItem(itemId: string, action: string, reason: string, adminId: string): Promise<void>;
  
  // Moderation Actions
  createModerationAction(action: InsertModerationAction): Promise<ModerationAction>;
  getModerationHistory(contentType: string, contentId: string): Promise<ModerationAction[]>;
  getUserModerationHistory(userId: string): Promise<ModerationAction[]>;
  reverseModerationAction(actionId: string, adminId: string, reason: string): Promise<void>;
  
  // User Management
  banUser(userId: string, adminId: string, reason: string, duration?: Date): Promise<void>;
  unbanUser(userId: string, adminId: string, reason: string): Promise<void>;
  getUserFlags(userId: string): Promise<any[]>;
  searchUsers(query: string, filters?: { isActive?: boolean; isBanned?: boolean }): Promise<any[]>;
  
  // Content Management
  removeContent(contentType: string, contentId: string, adminId: string, reason: string): Promise<void>;
  restoreContent(contentType: string, contentId: string, adminId: string, reason: string): Promise<void>;
  getFlaggedContent(contentType?: string): Promise<any[]>;
  
  // System Configuration
  getSystemConfig(key?: string): Promise<SystemConfig[]>;
  updateSystemConfig(key: string, value: string, adminId: string): Promise<void>;
  
  // Analytics & Reports
  getDashboardMetrics(): Promise<{
    totalUsers: number;
    activeUsers24h: number;
    totalPosts: number;
    totalLists: number;
    flaggedContent: number;
    pendingReviews: number;
    systemHealth: string;
  }>;
  getUserGrowthStats(days: number): Promise<any[]>;
  getContentStats(days: number): Promise<any[]>;
  getModerationStats(days: number): Promise<any[]>;
  
  // Bulk Operations
  initiateBulkOperation(type: string, metadata: any, adminId: string): Promise<string>;
  updateBulkOperationProgress(operationId: string, progress: number, processedItems: number): Promise<void>;
  completeBulkOperation(operationId: string, errors?: string[]): Promise<void>;
  getBulkOperations(adminId?: string): Promise<BulkOperation[]>;
  
  // Data Export/Import
  exportUserData(filters?: any): Promise<any[]>;
  exportContentData(filters?: any): Promise<any[]>;
  importUsers(userData: any[], adminId: string): Promise<string>;
  
  // URL Management
  getUrlAnalytics(): Promise<any[]>;
  updateUrlMapping(originalUrl: string, newUrl: string, discountCode?: string, adminId?: string): Promise<void>;
  createUrlMapping(originalUrl: string, currentUrl: string, discountCode?: string): Promise<UrlMapping>;
  getUrlMappings(): Promise<UrlMapping[]>;
  trackUrlClick(url: string, userId?: string, postId?: string, ipAddress?: string): Promise<void>;
}

export class AdminStorage implements IAdminStorage {
  // Admin Authentication
  async authenticateAdmin(username: string, password: string): Promise<AdminUser | null> {
    const adminSnapshot = await db.collection('adminUsers')
      .where('username', '==', username)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      return null;
    }

    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data() as AdminUser;
    const admin = { ...adminData, id: adminDoc.id };

    if (!await bcrypt.compare(password, adminData.password)) {
      return null;
    }

    // Update last login
    await adminDoc.ref.update({
      lastLogin: new Date(),
      updatedAt: new Date()
    });

    return admin;
  }

  async createAdminSession(adminId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.collection('adminSessions').add({
      adminId,
      sessionToken,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt: new Date()
    });

    return sessionToken;
  }

  async validateAdminSession(token: string): Promise<AdminUser | null> {
    const sessionSnapshot = await db.collection('adminSessions')
      .where('sessionToken', '==', token)
      .where('expiresAt', '>', new Date())
      .limit(1)
      .get();

    if (sessionSnapshot.empty) {
      return null;
    }

    const sessionDoc = sessionSnapshot.docs[0];
    const sessionData = sessionDoc.data();
    
    const adminDoc = await db.collection('adminUsers').doc(sessionData.adminId).get();
    if (!adminDoc.exists || !adminDoc.data()?.isActive) {
      return null;
    }

    const adminData = adminDoc.data() as AdminUser;
    return { ...adminData, id: adminDoc.id };
  }

  async revokeAdminSession(token: string): Promise<void> {
    const sessionSnapshot = await db.collection('adminSessions')
      .where('sessionToken', '==', token)
      .limit(1)
      .get();

    if (!sessionSnapshot.empty) {
      await sessionSnapshot.docs[0].ref.delete();
    }
  }

  // Admin User Management
  async createAdminUser(userData: InsertAdminUser): Promise<AdminUser> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const adminData = {
      ...userData,
      password: hashedPassword,
      role: userData.role || 'moderator',
      permissions: userData.permissions || [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('adminUsers').add(adminData);
    const admin = { ...adminData, id: docRef.id };

    await this.logAdminAction({
      adminId: admin.id,
      action: 'admin_user_created',
      target: 'admin_user',
      targetId: admin.id,
      details: { username: admin.username, role: admin.role }
    });

    return admin;
  }

  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const adminDoc = await db.collection('adminUsers').doc(id).get();
    if (!adminDoc.exists) {
      return undefined;
    }
    const adminData = adminDoc.data() as AdminUser;
    return { ...adminData, id: adminDoc.id };
  }

  async updateAdminUser(id: string, updates: Partial<AdminUser>): Promise<void> {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    await db.collection('adminUsers').doc(id).update({
      ...updates,
      updatedAt: new Date()
    });
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.collection('adminUsers').doc(id).delete();
  }

  async listAdminUsers(): Promise<AdminUser[]> {
    const adminSnapshot = await db.collection('adminUsers')
      .orderBy('createdAt', 'desc')
      .get();

    return adminSnapshot.docs.map(doc => ({
      ...doc.data() as AdminUser,
      id: doc.id
    }));
  }

  // Audit Logging
  async logAdminAction(log: InsertAuditLog): Promise<AuditLog> {
    const auditData = {
      ...log,
      createdAt: new Date()
    };

    const docRef = await db.collection('auditLogs').add(auditData);
    return { ...auditData, id: docRef.id };
  }

  async getAuditLogs(filters?: { adminId?: string; action?: string; target?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]> {
    let query = db.collection('auditLogs');

    if (filters?.adminId) {
      query = query.where('adminId', '==', filters.adminId);
    }
    if (filters?.action) {
      query = query.where('action', '==', filters.action);
    }
    if (filters?.target) {
      query = query.where('target', '==', filters.target);
    }
    if (filters?.startDate) {
      query = query.where('createdAt', '>=', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.where('createdAt', '<=', filters.endDate);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({
      ...doc.data() as AuditLog,
      id: doc.id
    }));
  }

  // Content Moderation
  async addToReviewQueue(contentType: string, contentId: string, reason: string, priority: string = 'medium'): Promise<ContentReviewItem> {
    const reviewData = {
      contentType,
      contentId,
      priority,
      reason,
      flagCount: 1,
      status: 'pending',
      createdAt: new Date()
    };

    const docRef = await db.collection('contentReviewQueue').add(reviewData);
    return { ...reviewData, id: docRef.id };
  }

  async getReviewQueue(filters?: { status?: string; assignedTo?: string; priority?: string }): Promise<ContentReviewItem[]> {
    let query = db.collection('contentReviewQueue');

    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters?.assignedTo) {
      query = query.where('assignedTo', '==', filters.assignedTo);
    }
    if (filters?.priority) {
      query = query.where('priority', '==', filters.priority);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({
      ...doc.data() as ContentReviewItem,
      id: doc.id
    }));
  }

  async assignReviewItem(itemId: string, adminId: string): Promise<void> {
    await db.collection('contentReviewQueue').doc(itemId).update({
      assignedTo: adminId,
      status: 'assigned'
    });
  }

  async processReviewItem(itemId: string, action: string, reason: string, adminId: string): Promise<void> {
    await db.collection('contentReviewQueue').doc(itemId).update({
      reviewedBy: adminId,
      reviewedAt: new Date(),
      status: 'reviewed'
    });
  }

  // Moderation Actions
  async createModerationAction(action: InsertModerationAction): Promise<ModerationAction> {
    const actionData = {
      ...action,
      status: action.status || 'active',
      createdAt: new Date()
    };

    const docRef = await db.collection('moderationActions').add(actionData);
    return { ...actionData, id: docRef.id };
  }

  async getModerationHistory(contentType: string, contentId: string): Promise<ModerationAction[]> {
    const snapshot = await db.collection('moderationActions')
      .where('contentType', '==', contentType)
      .where('contentId', '==', contentId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data() as ModerationAction,
      id: doc.id
    }));
  }

  async getUserModerationHistory(userId: string): Promise<ModerationAction[]> {
    const snapshot = await db.collection('moderationActions')
      .where('contentType', '==', 'user')
      .where('contentId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data() as ModerationAction,
      id: doc.id
    }));
  }

  async reverseModerationAction(actionId: string, adminId: string, reason: string): Promise<void> {
    await db.collection('moderationActions').doc(actionId).update({
      status: 'reversed',
      notes: reason,
      updatedAt: new Date()
    });
  }

  // User Management
  async banUser(userId: string, adminId: string, reason: string, duration?: Date): Promise<void> {
    await db.collection('users').doc(userId).update({
      isBanned: true,
      banReason: reason,
      banExpiresAt: duration,
      bannedBy: adminId,
      bannedAt: new Date()
    });
  }

  async unbanUser(userId: string, adminId: string, reason: string): Promise<void> {
    await db.collection('users').doc(userId).update({
      isBanned: false,
      banReason: null,
      banExpiresAt: null,
      unbannedBy: adminId,
      unbannedAt: new Date()
    });
  }

  async getUserFlags(userId: string): Promise<any[]> {
    const snapshot = await db.collection('postFlags')
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  }

  async searchUsers(query: string, filters?: { isActive?: boolean; isBanned?: boolean }): Promise<any[]> {
    let userQuery = db.collection('users');

    if (filters?.isActive !== undefined) {
      userQuery = userQuery.where('isActive', '==', filters.isActive);
    }
    if (filters?.isBanned !== undefined) {
      userQuery = userQuery.where('isBanned', '==', filters.isBanned);
    }

    const snapshot = await userQuery.get();
    const users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));

    // Filter by query string
    return users.filter(user => 
      user.username?.toLowerCase().includes(query.toLowerCase()) ||
      user.name?.toLowerCase().includes(query.toLowerCase()) ||
      user.email?.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Content Management
  async removeContent(contentType: string, contentId: string, adminId: string, reason: string): Promise<void> {
    await db.collection(contentType).doc(contentId).update({
      isRemoved: true,
      removedBy: adminId,
      removedAt: new Date(),
      removalReason: reason
    });
  }

  async restoreContent(contentType: string, contentId: string, adminId: string, reason: string): Promise<void> {
    await db.collection(contentType).doc(contentId).update({
      isRemoved: false,
      restoredBy: adminId,
      restoredAt: new Date(),
      restorationReason: reason
    });
  }

  async getFlaggedContent(contentType?: string): Promise<any[]> {
    let query = db.collection('postFlags');

    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  }

  // System Configuration
  async getSystemConfig(key?: string): Promise<SystemConfig[]> {
    let query = db.collection('systemConfig');

    if (key) {
      query = query.where('key', '==', key);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      ...doc.data() as SystemConfig,
      id: doc.id
    }));
  }

  async updateSystemConfig(key: string, value: string, adminId: string): Promise<void> {
    const configSnapshot = await db.collection('systemConfig')
      .where('key', '==', key)
      .limit(1)
      .get();

    if (configSnapshot.empty) {
      await db.collection('systemConfig').add({
        key,
        value,
        type: 'string',
        category: 'general',
        updatedBy: adminId,
        updatedAt: new Date()
      });
    } else {
      await configSnapshot.docs[0].ref.update({
        value,
        updatedBy: adminId,
        updatedAt: new Date()
      });
    }
  }

  // Analytics & Reports
  async getDashboardMetrics(): Promise<{
    totalUsers: number;
    activeUsers24h: number;
    totalPosts: number;
    totalLists: number;
    flaggedContent: number;
    pendingReviews: number;
    systemHealth: string;
  }> {
    // Simplified metrics - in a real implementation, you'd want to cache these
    const usersSnapshot = await db.collection('users').get();
    const postsSnapshot = await db.collection('posts').get();
    const listsSnapshot = await db.collection('lists').get();
    const flagsSnapshot = await db.collection('postFlags').get();
    const reviewsSnapshot = await db.collection('contentReviewQueue')
      .where('status', '==', 'pending')
      .get();

    return {
      totalUsers: usersSnapshot.size,
      activeUsers24h: Math.floor(usersSnapshot.size * 0.1), // Simplified
      totalPosts: postsSnapshot.size,
      totalLists: listsSnapshot.size,
      flaggedContent: flagsSnapshot.size,
      pendingReviews: reviewsSnapshot.size,
      systemHealth: 'healthy'
    };
  }

  async getUserGrowthStats(days: number): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  async getContentStats(days: number): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  async getModerationStats(days: number): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  // Bulk Operations
  async initiateBulkOperation(type: string, metadata: any, adminId: string): Promise<string> {
    const operationId = crypto.randomBytes(16).toString('hex');
    
    await db.collection('bulkOperations').add({
      operationId,
      type,
      status: 'pending',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      errors: [],
      metadata,
      initiatedBy: adminId,
      startedAt: new Date()
    });

    return operationId;
  }

  async updateBulkOperationProgress(operationId: string, progress: number, processedItems: number): Promise<void> {
    const snapshot = await db.collection('bulkOperations')
      .where('operationId', '==', operationId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        progress,
        processedItems,
        updatedAt: new Date()
      });
    }
  }

  async completeBulkOperation(operationId: string, errors?: string[]): Promise<void> {
    const snapshot = await db.collection('bulkOperations')
      .where('operationId', '==', operationId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        status: 'completed',
        completedAt: new Date(),
        errors: errors || []
      });
    }
  }

  async getBulkOperations(adminId?: string): Promise<BulkOperation[]> {
    let query = db.collection('bulkOperations');

    if (adminId) {
      query = query.where('initiatedBy', '==', adminId);
    }

    const snapshot = await query.orderBy('startedAt', 'desc').get();
    return snapshot.docs.map(doc => ({
      ...doc.data() as BulkOperation,
      id: doc.id
    }));
  }

  // Data Export/Import
  async exportUserData(filters?: any): Promise<any[]> {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  }

  async exportContentData(filters?: any): Promise<any[]> {
    const snapshot = await db.collection('posts').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  }

  async importUsers(userData: any[], adminId: string): Promise<string> {
    const operationId = await this.initiateBulkOperation('user_import', { count: userData.length }, adminId);
    
    // Simplified import - in real implementation, you'd want to batch this
    for (const user of userData) {
      try {
        await db.collection('users').add(user);
      } catch (error) {
        console.error('Error importing user:', error);
      }
    }

    await this.completeBulkOperation(operationId);
    return operationId;
  }

  // URL Management
  async getUrlAnalytics(): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  async updateUrlMapping(originalUrl: string, newUrl: string, discountCode?: string, adminId?: string): Promise<void> {
    const snapshot = await db.collection('urlMappings')
      .where('originalUrl', '==', originalUrl)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({
        currentUrl: newUrl,
        discountCode,
        updatedAt: new Date()
      });
    }
  }

  async createUrlMapping(originalUrl: string, currentUrl: string, discountCode?: string): Promise<UrlMapping> {
    const mappingData = {
      originalUrl,
      currentUrl,
      discountCode,
      clickCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('urlMappings').add(mappingData);
    return { ...mappingData, id: docRef.id };
  }

  async getUrlMappings(): Promise<UrlMapping[]> {
    const snapshot = await db.collection('urlMappings')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data() as UrlMapping,
      id: doc.id
    }));
  }

  async trackUrlClick(url: string, userId?: string, postId?: string, ipAddress?: string): Promise<void> {
    await db.collection('urlClicks').add({
      url,
      userId,
      postId,
      ipAddress,
      timestamp: new Date()
    });
  }
}

export const adminStorage = new AdminStorage();