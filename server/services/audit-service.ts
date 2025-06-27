import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { db } from '../firebase-db';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  resourceType: 'post' | 'list' | 'user' | 'friendship' | 'listAccess' | 'privacy';
  resourceId?: string;
  targetUserId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suspicious?: boolean;
  metadata?: Record<string, any>;
}

export interface PrivacyDashboardData {
  contentViews: Array<{
    resourceType: string;
    resourceId: string;
    viewerId: string;
    viewerName: string;
    timestamp: Date;
    action: string;
  }>;
  privacyChanges: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    timestamp: Date;
  }>;
  friendActivity: Array<{
    action: string;
    friendId: string;
    friendName: string;
    timestamp: Date;
  }>;
  listAccess: Array<{
    listId: string;
    listName: string;
    action: string;
    collaboratorId?: string;
    collaboratorName?: string;
    timestamp: Date;
  }>;
  suspiciousActivity: Array<{
    action: string;
    details: string;
    severity: string;
    timestamp: Date;
  }>;
}

export class AuditService extends BaseService {
  private readonly AUDIT_COLLECTION = 'auditLogs';
  private readonly PRIVACY_DASHBOARD_COLLECTION = 'privacyDashboards';

  /**
   * Log a privacy-sensitive operation
   */
  async logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<ApiResponse<string>> {
    try {
      const auditEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date(),
        suspicious: this.detectSuspiciousActivity(entry)
      };

      const docRef = await db.collection(this.AUDIT_COLLECTION).add(auditEntry);
      
      // Update privacy dashboard for affected users
      await this.updatePrivacyDashboard(entry);
      
      // Check for suspicious patterns
      if (auditEntry.suspicious) {
        await this.flagSuspiciousActivity(auditEntry);
      }

      return this.createSuccessResponse(docRef.id);
    } catch (error) {
      this.logError('logAuditEvent', error, entry);
      return this.createErrorResponse('Failed to log audit event');
    }
  }

  /**
   * Log content access/viewing
   */
  async logContentAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<string>> {
    return this.logAuditEvent({
      userId,
      action,
      resourceType: resourceType as any,
      resourceId,
      details: { action, ...metadata },
      severity: 'low',
      metadata
    });
  }

  /**
   * Log privacy setting changes
   */
  async logPrivacyChange(
    userId: string,
    field: string,
    oldValue: string,
    newValue: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<ApiResponse<string>> {
    return this.logAuditEvent({
      userId,
      action: 'privacy_change',
      resourceType: 'privacy',
      resourceId,
      details: { field, oldValue, newValue, resourceType, resourceId },
      severity: 'medium'
    });
  }

  /**
   * Log friendship activity
   */
  async logFriendshipActivity(
    userId: string,
    action: 'friend_request' | 'friend_accept' | 'friend_reject' | 'unfriend' | 'block',
    targetUserId: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<string>> {
    return this.logAuditEvent({
      userId,
      action,
      resourceType: 'friendship',
      targetUserId,
      details: { action, targetUserId, ...metadata },
      severity: 'medium'
    });
  }

  /**
   * Log list access changes
   */
  async logListAccessChange(
    listId: string,
    listOwnerId: string,
    action: 'invite' | 'accept' | 'reject' | 'remove' | 'role_change',
    collaboratorId?: string,
    role?: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<string>> {
    return this.logAuditEvent({
      userId: listOwnerId,
      action,
      resourceType: 'listAccess',
      resourceId: listId,
      targetUserId: collaboratorId,
      details: { action, listId, collaboratorId, role, ...metadata },
      severity: 'medium'
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId: string,
    action: string,
    details: string,
    severity: 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): Promise<ApiResponse<string>> {
    return this.logAuditEvent({
      userId,
      action,
      resourceType: 'user',
      details: { action, details, ...metadata },
      severity,
      suspicious: true
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    startAfter?: string
  ): Promise<ApiResponse<AuditLogEntry[]>> {
    try {
      let query = db.collection(this.AUDIT_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (startAfter) {
        const startDoc = await db.collection(this.AUDIT_COLLECTION).doc(startAfter).get();
        query = query.startAfter(startDoc);
      }

      const snapshot = await query.get();
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLogEntry[];

      return this.createSuccessResponse(logs);
    } catch (error) {
      this.logError('getUserAuditLogs', error, { userId, limit });
      return this.createErrorResponse('Failed to get audit logs');
    }
  }

  /**
   * Get privacy dashboard data for a user
   */
  async getPrivacyDashboard(userId: string): Promise<ApiResponse<PrivacyDashboardData>> {
    try {
      // Get recent content views
      const contentViews = await this.getContentViewLogs(userId);
      
      // Get privacy changes
      const privacyChanges = await this.getPrivacyChangeLogs(userId);
      
      // Get friend activity
      const friendActivity = await this.getFriendshipLogs(userId);
      
      // Get list access changes
      const listAccess = await this.getListAccessLogs(userId);
      
      // Get suspicious activity
      const suspiciousActivity = await this.getSuspiciousActivityLogs(userId);

      const dashboardData: PrivacyDashboardData = {
        contentViews,
        privacyChanges,
        friendActivity,
        listAccess,
        suspiciousActivity
      };

      return this.createSuccessResponse(dashboardData);
    } catch (error) {
      this.logError('getPrivacyDashboard', error, { userId });
      return this.createErrorResponse('Failed to get privacy dashboard');
    }
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(userId: string): Promise<ApiResponse<any>> {
    try {
      // Get all user-related audit logs
      const auditLogs = await this.getAllUserAuditLogs(userId);
      
      // Get user profile data
      const userResponse = await this.storage.getUser(userId);
      const userData = userResponse.success ? userResponse.data : null;
      
      // Get user posts
      const postsResponse = await this.storage.getPostsByUserId(userId);
      const posts = postsResponse.success ? postsResponse.data : [];
      
      // Get user lists
      const listsResponse = await this.storage.getListsByUserId(userId);
      const lists = listsResponse.success ? listsResponse.data : [];
      
      // Get friendships
      const friendsResponse = await this.storage.getConnections(userId);
      const friendships = friendsResponse.success ? friendsResponse.data : [];

      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        userData,
        posts,
        lists,
        friendships,
        auditLogs,
        privacyDashboard: await this.getPrivacyDashboard(userId)
      };

      return this.createSuccessResponse(exportData);
    } catch (error) {
      this.logError('exportUserData', error, { userId });
      return this.createErrorResponse('Failed to export user data');
    }
  }

  /**
   * Get suspicious activity patterns
   */
  async getSuspiciousActivityPatterns(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const suspiciousLogs = await db.collection(this.AUDIT_COLLECTION)
        .where('userId', '==', userId)
        .where('suspicious', '==', true)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const patterns = suspiciousLogs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.createSuccessResponse(patterns);
    } catch (error) {
      this.logError('getSuspiciousActivityPatterns', error, { userId });
      return this.createErrorResponse('Failed to get suspicious activity patterns');
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): boolean {
    // This is a simplified version - in production, you'd use ML/AI
    const suspiciousPatterns = [
      // Rapid privacy changes
      entry.action === 'privacy_change' && this.isRapidChange(entry.userId),
      
      // Multiple failed access attempts
      entry.action === 'access_denied' && this.hasMultipleFailures(entry.userId),
      
      // Unusual access patterns
      entry.action === 'content_view' && this.isUnusualAccess(entry.userId, entry.resourceId),
      
      // Suspicious friendship activity
      entry.action === 'friend_request' && this.isSuspiciousFriendRequest(entry.userId, entry.targetUserId)
    ];

    return suspiciousPatterns.some(pattern => pattern);
  }

  /**
   * Check for rapid privacy changes
   */
  private async isRapidChange(userId: string): Promise<boolean> {
    const recentChanges = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('action', '==', 'privacy_change')
      .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .get();

    return recentChanges.docs.length > 10; // More than 10 changes in 24 hours
  }

  /**
   * Check for multiple access failures
   */
  private async hasMultipleFailures(userId: string): Promise<boolean> {
    const recentFailures = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('action', '==', 'access_denied')
      .where('timestamp', '>', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
      .get();

    return recentFailures.docs.length > 5; // More than 5 failures in 1 hour
  }

  /**
   * Check for unusual access patterns
   */
  private async isUnusualAccess(userId: string, resourceId?: string): Promise<boolean> {
    if (!resourceId) return false;

    const recentAccess = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('resourceId', '==', resourceId)
      .where('action', '==', 'content_view')
      .where('timestamp', '>', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
      .get();

    return recentAccess.docs.length > 20; // More than 20 views in 1 hour
  }

  /**
   * Check for suspicious friend requests
   */
  private async isSuspiciousFriendRequest(userId: string, targetUserId?: string): Promise<boolean> {
    if (!targetUserId) return false;

    const recentRequests = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('action', '==', 'friend_request')
      .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .get();

    return recentRequests.docs.length > 50; // More than 50 requests in 24 hours
  }

  /**
   * Flag suspicious activity for review
   */
  private async flagSuspiciousActivity(entry: AuditLogEntry): Promise<void> {
    try {
      await db.collection('suspiciousActivity').add({
        ...entry,
        flaggedAt: new Date(),
        reviewed: false,
        reviewNotes: ''
      });
    } catch (error) {
      console.error('Failed to flag suspicious activity:', error);
    }
  }

  /**
   * Update privacy dashboard for affected users
   */
  private async updatePrivacyDashboard(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const affectedUsers = [entry.userId];
      if (entry.targetUserId) {
        affectedUsers.push(entry.targetUserId);
      }

      for (const userId of affectedUsers) {
        const dashboardRef = db.collection(this.PRIVACY_DASHBOARD_COLLECTION).doc(userId);
        
        await dashboardRef.set({
          lastUpdated: new Date(),
          userId,
          hasNewActivity: true
        }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to update privacy dashboard:', error);
    }
  }

  // Helper methods for dashboard data
  private async getContentViewLogs(userId: string): Promise<any[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('targetUserId', '==', userId)
      .where('action', '==', 'content_view')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    return logs.docs.map(doc => ({
      resourceType: doc.data().resourceType,
      resourceId: doc.data().resourceId,
      viewerId: doc.data().userId,
      viewerName: 'User', // Would need to fetch actual user name
      timestamp: doc.data().timestamp.toDate(),
      action: doc.data().action
    }));
  }

  private async getPrivacyChangeLogs(userId: string): Promise<any[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('action', '==', 'privacy_change')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    return logs.docs.map(doc => ({
      field: doc.data().details.field,
      oldValue: doc.data().details.oldValue,
      newValue: doc.data().details.newValue,
      timestamp: doc.data().timestamp.toDate()
    }));
  }

  private async getFriendshipLogs(userId: string): Promise<any[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('resourceType', '==', 'friendship')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    return logs.docs.map(doc => ({
      action: doc.data().action,
      friendId: doc.data().targetUserId,
      friendName: 'User', // Would need to fetch actual user name
      timestamp: doc.data().timestamp.toDate()
    }));
  }

  private async getListAccessLogs(userId: string): Promise<any[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('resourceType', '==', 'listAccess')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    return logs.docs.map(doc => ({
      listId: doc.data().resourceId,
      listName: 'List', // Would need to fetch actual list name
      action: doc.data().action,
      collaboratorId: doc.data().targetUserId,
      collaboratorName: 'User', // Would need to fetch actual user name
      timestamp: doc.data().timestamp.toDate()
    }));
  }

  private async getSuspiciousActivityLogs(userId: string): Promise<any[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .where('suspicious', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    return logs.docs.map(doc => ({
      action: doc.data().action,
      details: doc.data().details.details || 'Suspicious activity detected',
      severity: doc.data().severity,
      timestamp: doc.data().timestamp.toDate()
    }));
  }

  private async getAllUserAuditLogs(userId: string): Promise<AuditLogEntry[]> {
    const logs = await db.collection(this.AUDIT_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();

    return logs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLogEntry[];
  }
} 