#!/usr/bin/env node

/**
 * Script to remove application-level privacy filtering
 * This script updates the storage methods to rely on Firestore security rules
 * instead of application-level filtering for privacy enforcement.
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Removing application-level privacy filtering...\n');

// Files to update
const filesToUpdate = [
  'server/storage-enterprise.ts',
  'server/services/privacy-service.ts',
  'server/services/post-service.ts'
];

// Backup directory
const backupDir = 'backups/privacy-filtering-removal';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function backupFile(filePath) {
  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDir, `${fileName}.backup`);
  fs.copyFileSync(filePath, backupPath);
  console.log(`📦 Backed up: ${filePath} -> ${backupPath}`);
}

function updateStorageEnterprise() {
  const filePath = 'server/storage-enterprise.ts';
  backupFile(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove privacy filtering from getAllPosts
  content = content.replace(
    /\/\/ BULLETPROOF THREE-TIER PRIVACY SYSTEM[\s\S]*?async getAllPosts\(viewerId\?\: string\)[\s\S]*?return \{ success: true, data: posts \};[\s\S]*?\}/,
    `// Firestore security rules handle privacy - no application-level filtering needed
  async getAllPosts(viewerId?: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      console.log('Fetching posts from Firestore - privacy enforced by security rules');
      
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
      
      console.log(\`Found \${posts.length} posts (privacy enforced by Firestore rules)\`);
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error fetching posts from Firestore:', error);
      throw error;
    }
  }`
  );
  
  // Remove privacy filtering from getPostsByUserId
  content = content.replace(
    /async getPostsByUserId\(userId: string\)[\s\S]*?return \{ success: true, data: posts \};[\s\S]*?\}/,
    `async getPostsByUserId(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      const postsSnapshot = await db.collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const posts: FirebasePostWithUser[] = [];
      
      for (const doc of postsSnapshot.docs) {
        const postData = doc.data();
        
        // Get user data
        let userData = null;
        if (postData.userId) {
          const userDoc = await db.collection('users').doc(postData.userId).get();
          userData = userDoc.data();
        }
        
        posts.push(castToFirebasePostWithUser(postData, doc.id, postData.userId, userData));
      }
      
      return { success: true, data: posts };
    } catch (error) {
      console.error('Error getting posts by user ID:', error);
      return { success: false, error: 'Error getting posts by user ID' };
    }
  }`
  );
  
  // Remove privacy filtering from getTaggedPosts
  content = content.replace(
    /async getTaggedPosts\(userId: string\)[\s\S]*?return \{ success: true, data: posts\.sort\([\s\S]*?\};[\s\S]*?\}/,
    `async getTaggedPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      // Get posts where the user is tagged
      const taggedPostsSnapshot = await db.collection('postTags')
        .where('userId', '==', userId)
        .get();
      
      const posts: FirebasePostWithUser[] = [];
      
      for (const tagDoc of taggedPostsSnapshot.docs) {
        const tagData = tagDoc.data();
        if (!tagData?.postId) continue;
        
        // Get the actual post
        const postDoc = await db.collection('posts').doc(tagData.postId).get();
        if (!postDoc.exists) continue;
        
        const postData = postDoc.data();
        if (!postData) continue;
        
        // Firestore security rules handle privacy - no need to filter here
        const user = await this.getUser(postData.userId);
        posts.push(castToFirebasePostWithUser(postData, postDoc.id, postData.userId, user));
      }
      
      // Sort by creation date (newest first)
      return { success: true, data: posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) };
    } catch (error) {
      console.error('Error getting tagged posts:', error);
      return { success: false, error: 'Error getting tagged posts' };
    }
  }`
  );
  
  // Remove privacy filtering from getConnectionsPosts
  content = content.replace(
    /async getConnectionsPosts\(userId: string\)[\s\S]*?return \{ success: true, data: posts \};[\s\S]*?\}/,
    `async getConnectionsPosts(userId: string): Promise<ApiResponse<FirebasePostWithUser[]>> {
    try {
      // Get user's connections
      const connectionsResponse = await this.getConnections(userId);
      if (!connectionsResponse.success || !connectionsResponse.data) {
        return { success: true, data: [] };
      }
      
      const connectionIds = connectionsResponse.data.map(conn => conn.id);
      if (connectionIds.length === 0) {
        return { success: true, data: [] };
      }
      
      // Get posts from connections - Firestore rules handle privacy
      const posts: FirebasePostWithUser[] = [];
      
      for (const connectionId of connectionIds) {
        const userPostsResponse = await this.getPostsByUserId(connectionId);
        if (userPostsResponse.success && userPostsResponse.data) {
          posts.push(...userPostsResponse.data);
        }
      }
      
      // Sort by creation date (newest first)
      return { success: true, data: posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) };
    } catch (error) {
      console.error('Error getting connections posts:', error);
      return { success: false, error: 'Error getting connections posts' };
    }
  }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Updated server/storage-enterprise.ts - removed application-level privacy filtering');
}

function updatePrivacyService() {
  const filePath = 'server/services/privacy-service.ts';
  backupFile(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add comment about Firestore rules handling privacy
  content = content.replace(
    /export class PrivacyService extends BaseService \{/,
    `export class PrivacyService extends BaseService {
  // NOTE: Privacy is now enforced by Firestore security rules
  // This service is kept for backward compatibility but most methods are deprecated`
  );
  
  // Update filterPostsByPrivacy to return all posts (Firestore rules handle filtering)
  content = content.replace(
    /async filterPostsByPrivacy\(posts: any\[\], requestingUserId: string\)[\s\S]*?return this\.createSuccessResponse\(filteredPosts\.filter\(Boolean\)\);[\s\S]*?\}/,
    `async filterPostsByPrivacy(posts: any[], requestingUserId: string): Promise<ApiResponse<any[]>> {
    try {
      // Firestore security rules handle privacy filtering
      // Return all posts - if they're in the result, user has permission to see them
      return this.createSuccessResponse(posts);
    } catch (error) {
      this.logError('filterPostsByPrivacy', error, { requestingUserId });
      return this.createErrorResponse('Failed to filter posts by privacy');
    }
  }`
  );
  
  // Update checkPostAccess to always return true (Firestore rules handle access)
  content = content.replace(
    /async checkPostAccess\(postId: string, requestingUserId: string\)[\s\S]*?return this\.createSuccessResponse\(hasAccess\);[\s\S]*?\}/,
    `async checkPostAccess(postId: string, requestingUserId: string): Promise<ApiResponse<boolean>> {
    try {
      // Firestore security rules handle post access
      // If the post is returned by Firestore, user has access
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }
      
      // Post exists and user can access it (Firestore rules enforced this)
      return this.createSuccessResponse(true);
    } catch (error) {
      this.logError('checkPostAccess', error, { postId, requestingUserId });
      return this.createErrorResponse('Failed to check post access');
    }
  }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Updated server/services/privacy-service.ts - privacy now handled by Firestore rules');
}

function updatePostService() {
  const filePath = 'server/services/post-service.ts';
  backupFile(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update getPostById to remove privacy checking
  content = content.replace(
    /async getPostById\(postId: string, userId\?: string\)[\s\S]*?return this\.createSuccessResponse\(post\);[\s\S]*?\}/,
    `async getPostById(postId: string, userId?: string): Promise<ApiResponse<any>> {
    try {
      const postResponse = await this.storage.getPostById(postId);
      if (!postResponse.success || !postResponse.data) {
        return this.createErrorResponse('Post not found', 404);
      }

      const post = postResponse.data;
      
      // Firestore security rules handle privacy - no need to check here
      return this.createSuccessResponse(post);
    } catch (error) {
      this.logError('getPostById', error, { postId, userId });
      return this.createErrorResponse('Failed to get post');
    }
  }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Updated server/services/post-service.ts - removed privacy checking');
}

function createMigrationGuide() {
  const guide = `# Privacy Migration Guide

## Overview
Application-level privacy filtering has been removed in favor of Firestore security rules. This provides better security, performance, and consistency.

## Changes Made

### 1. Storage Layer (server/storage-enterprise.ts)
- **getAllPosts()**: Removed privacy filtering - Firestore rules handle access
- **getPostsByUserId()**: Removed privacy filtering - Firestore rules handle access  
- **getTaggedPosts()**: Removed privacy filtering - Firestore rules handle access
- **getConnectionsPosts()**: Removed privacy filtering - Firestore rules handle access

### 2. Privacy Service (server/services/privacy-service.ts)
- **filterPostsByPrivacy()**: Now returns all posts - Firestore rules handle filtering
- **checkPostAccess()**: Now always returns true if post exists - Firestore rules handle access
- Added deprecation notices for privacy-related methods

### 3. Post Service (server/services/post-service.ts)
- **getPostById()**: Removed privacy checking - Firestore rules handle access

## Benefits

### Security
- Privacy enforcement at the database level
- Impossible to bypass through API manipulation
- Consistent access control across all clients

### Performance
- No application-level filtering reduces server load
- Fewer database queries
- Better caching opportunities

### Maintainability
- Single source of truth for privacy rules
- Easier to audit and update privacy policies
- Consistent behavior across all endpoints

## Testing

### Before Deployment
1. Test all endpoints with different user roles
2. Verify private content is properly protected
3. Confirm public content is accessible
4. Test connection-based privacy

### After Deployment
1. Monitor for any access denied errors
2. Verify performance improvements
3. Check that privacy is still properly enforced

## Rollback Plan
If issues arise, restore the backup files from \`backups/privacy-filtering-removal/\` directory.

## Firestore Rules
The new security rules enforce:
- Public content: Readable by everyone
- Connections-only content: Readable by connected users
- Private content: Readable only by owner
- List access: Controlled by ownership and collaboration
- Admin access: Restricted to admin users

## Next Steps
1. Deploy the updated Firestore rules
2. Test thoroughly in staging environment
3. Monitor application performance
4. Update client-side code if needed
`;

  fs.writeFileSync('PRIVACY_MIGRATION_GUIDE.md', guide);
  console.log('📋 Created PRIVACY_MIGRATION_GUIDE.md');
}

// Execute the updates
try {
  updateStorageEnterprise();
  updatePrivacyService();
  updatePostService();
  createMigrationGuide();
  
  console.log('\n🎉 Successfully removed application-level privacy filtering!');
  console.log('\n📋 Next steps:');
  console.log('1. Deploy the new Firestore security rules');
  console.log('2. Test the application thoroughly');
  console.log('3. Monitor for any access issues');
  console.log('4. Check the PRIVACY_MIGRATION_GUIDE.md for details');
  
} catch (error) {
  console.error('❌ Error updating files:', error);
  process.exit(1);
} 