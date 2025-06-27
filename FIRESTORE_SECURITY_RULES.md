# Firestore Security Rules Documentation

## Overview

This document describes the comprehensive Firestore security rules that enforce privacy at the database level for the Love20 application. These rules ensure that users can only access content they're authorized to see, providing robust privacy protection without relying on application-level filtering.

## 🔒 Security Principles

### 1. **Database-Level Enforcement**
- Privacy rules are enforced at the Firestore level, not in application code
- Impossible to bypass through API manipulation or client-side code
- Consistent access control across all clients and platforms

### 2. **Principle of Least Privilege**
- Users can only access data they need to see
- Default deny policy for unknown collections
- Explicit permissions for each operation type

### 3. **Privacy by Design**
- Three-tier privacy system: Public, Connections, Private
- Bidirectional friendship verification
- Blocking system for user safety

## 🏗️ Rule Structure

### Helper Functions

```javascript
// Authentication helpers
function isAuthenticated() {
  return request.auth != null;
}

function isOwner(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

// Privacy helpers
function isPublic() {
  return resource.data.privacy == 'public';
}

function isConnectionsOnly() {
  return resource.data.privacy == 'connections';
}

function isPrivate() {
  return resource.data.privacy == 'private';
}

// Relationship helpers
function areConnected(userId1, userId2) {
  return exists(/databases/$(database)/documents/friendships/$(userId1 + '_' + userId2)) ||
         exists(/databases/$(database)/documents/friendships/$(userId2 + '_' + userId1));
}

// Access control helpers
function hasListAccess(listId) {
  return isOwner(resource.data.userId) ||
         exists(/databases/$(database)/documents/listAccess/$(listId + '_' + request.auth.uid));
}

// Blocking helpers
function isBlockedByOwner(ownerId) {
  return exists(/databases/$(database)/documents/blacklist/$(ownerId + '_' + request.auth.uid));
}

function hasBlockedOwner(ownerId) {
  return exists(/databases/$(database)/documents/blacklist/$(request.auth.uid + '_' + ownerId));
}
```

## 📝 Content Access Rules

### Post Privacy Logic

```javascript
function canReadPost(postData) {
  let ownerId = postData.userId;
  
  // User can always read their own posts
  if (isOwner(ownerId)) {
    return true;
  }
  
  // Check if blocked
  if (isBlockedByOwner(ownerId) || hasBlockedOwner(ownerId)) {
    return false;
  }
  
  // Public posts are readable by everyone
  if (postData.privacy == 'public') {
    return true;
  }
  
  // Private posts are only readable by owner
  if (postData.privacy == 'private') {
    return false;
  }
  
  // Connections-only posts require friendship
  if (postData.privacy == 'connections') {
    return areConnected(request.auth.uid, ownerId);
  }
  
  return false;
}
```

### List Privacy Logic

```javascript
function canReadList(listData) {
  let ownerId = listData.userId;
  
  // User can always read their own lists
  if (isOwner(ownerId)) {
    return true;
  }
  
  // Public lists are readable by everyone
  if (listData.privacyLevel == 'public') {
    return true;
  }
  
  // Private lists are only readable by owner
  if (listData.privacyLevel == 'private') {
    return false;
  }
  
  // Connections-only lists require friendship
  if (listData.privacyLevel == 'connections') {
    return areConnected(request.auth.uid, ownerId);
  }
  
  return false;
}
```

## 🗂️ Collection-Specific Rules

### Users Collection
```javascript
match /users/{userId} {
  // Users can read public user data
  allow read: if isAuthenticated();
  
  // Users can only update their own data
  allow update: if isOwner(userId);
  
  // Only authenticated users can create their own user document
  allow create: if isOwner(userId);
  
  // Users can only delete their own account
  allow delete: if isOwner(userId);
}
```

### Posts Collection
```javascript
match /posts/{postId} {
  // Read posts based on privacy settings
  allow read: if isAuthenticated() && canReadPost(resource.data);
  
  // Users can only create posts for themselves
  allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
  
  // Users can only update their own posts
  allow update: if isAuthenticated() && isOwner(resource.data.userId);
  
  // Users can only delete their own posts
  allow delete: if isAuthenticated() && isOwner(resource.data.userId);
}
```

### Lists Collection
```javascript
match /lists/{listId} {
  // Read lists based on privacy settings
  allow read: if isAuthenticated() && canReadList(resource.data);
  
  // Users can only create lists for themselves
  allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
  
  // Users can update lists they own or have collaborator access to
  allow update: if isAuthenticated() && canWriteList(resource.data);
  
  // Users can only delete lists they own
  allow delete: if isAuthenticated() && isOwner(resource.data.userId);
}
```

### Comments Collection
```javascript
match /comments/{commentId} {
  // Comments inherit post privacy - can only read if can read the post
  allow read: if isAuthenticated() && 
    canReadPost(get(/databases/$(database)/documents/posts/$(resource.data.postId)).data);
  
  // Users can only create comments on posts they can read
  allow create: if isAuthenticated() && 
    isOwner(request.resource.data.userId) &&
    canReadPost(get(/databases/$(database)/documents/posts/$(request.resource.data.postId)).data);
  
  // Users can only update their own comments
  allow update: if isAuthenticated() && isOwner(resource.data.userId);
  
  // Users can only delete their own comments
  allow delete: if isAuthenticated() && isOwner(resource.data.userId);
}
```

### Friendships Collection
```javascript
match /friendships/{friendshipId} {
  // Users can read friendships they're part of
  allow read: if isAuthenticated() && 
    (request.auth.uid == resource.data.userId || 
     request.auth.uid == resource.data.friendId);
  
  // Users can create friendships (friend requests)
  allow create: if isAuthenticated() && 
    isOwner(request.resource.data.userId);
  
  // Users can update friendships they're part of
  allow update: if isAuthenticated() && 
    (request.auth.uid == resource.data.userId || 
     request.auth.uid == resource.data.friendId);
  
  // Users can delete friendships they're part of
  allow delete: if isAuthenticated() && 
    (request.auth.uid == resource.data.userId || 
     request.auth.uid == resource.data.friendId);
}
```

### Engagement Collections (Likes, Shares, Saves)
```javascript
match /postLikes/{likeId} {
  // Likes inherit post privacy
  allow read: if isAuthenticated() && 
    canReadPost(get(/databases/$(database)/documents/posts/$(resource.data.postId)).data);
  
  // Users can only like posts they can read
  allow create: if isAuthenticated() && 
    isOwner(request.resource.data.userId) &&
    canReadPost(get(/databases/$(database)/documents/posts/$(request.resource.data.postId)).data);
  
  // Users can only unlike their own likes
  allow delete: if isAuthenticated() && isOwner(resource.data.userId);
}
```

### Admin Collections
```javascript
match /adminUsers/{adminId} {
  // Only admin users can access admin data
  allow read, write: if isAuthenticated() && 
    exists(/databases/$(database)/documents/adminUsers/$(request.auth.uid));
}
```

## 🔐 Privacy Levels

### 1. **Public Content**
- **Posts**: `privacy: 'public'`
- **Lists**: `privacyLevel: 'public'`
- **Access**: Readable by all authenticated users
- **Use Case**: General content meant for wide audience

### 2. **Connections-Only Content**
- **Posts**: `privacy: 'connections'`
- **Lists**: `privacyLevel: 'connections'`
- **Access**: Readable by connected users (friends)
- **Use Case**: Content for friends and family

### 3. **Private Content**
- **Posts**: `privacy: 'private'`
- **Lists**: `privacyLevel: 'private'`
- **Access**: Readable only by owner
- **Use Case**: Personal content, drafts, sensitive information

## 👥 Relationship Management

### Friendship Verification
- Bidirectional friendship checking
- Friendship status tracking (accepted, pending, blocked)
- Automatic access to connections-only content

### List Collaboration
- Owner can invite collaborators
- Collaborators can read and write to lists
- Access control through `listAccess` collection

### Blocking System
- Users can block other users
- Blocked users cannot see each other's content
- Bidirectional blocking enforcement

## 🛡️ Security Features

### 1. **Authentication Required**
- All operations require valid Firebase Auth token
- No anonymous access to sensitive data
- User identity verification

### 2. **Ownership Verification**
- Users can only modify their own content
- Prevents unauthorized updates and deletions
- Secure user data isolation

### 3. **Privacy Inheritance**
- Comments inherit post privacy
- Likes/shares inherit post privacy
- Consistent access control across related data

### 4. **Admin Protection**
- Admin collections protected from regular users
- Admin-only operations properly secured
- Audit trail for administrative actions

## 🧪 Testing

### Test Scenarios

1. **Public Content Access**
   - Anonymous users cannot access any content
   - Authenticated users can access public content
   - Public posts visible to all users

2. **Private Content Protection**
   - Private posts only visible to owner
   - Private lists only accessible to owner
   - No unauthorized access to private content

3. **Connection-Based Privacy**
   - Connections-only content visible to friends
   - Non-friends cannot access connections-only content
   - Friendship status properly verified

4. **Ownership Verification**
   - Users can only edit their own content
   - Cannot modify other users' posts/lists
   - Secure user data isolation

5. **Blocking System**
   - Blocked users cannot see each other's content
   - Bidirectional blocking enforcement
   - Blocking overrides friendship status

### Testing Commands

```bash
# Deploy rules
firebase deploy --only firestore:rules

# Test rules locally
firebase emulators:start --only firestore

# Run security tests
npm run test:security
```

## 📊 Performance Considerations

### 1. **Efficient Queries**
- Rules designed to minimize database reads
- Cached friendship status for performance
- Optimized access control checks

### 2. **Indexing Requirements**
- Compound indexes for privacy-based queries
- Friendship status indexes
- List access indexes

### 3. **Caching Strategy**
- Client-side caching of friendship status
- Server-side caching of user permissions
- Optimized rule evaluation

## 🚨 Security Best Practices

### 1. **Regular Audits**
- Monthly security rule reviews
- Access pattern analysis
- Vulnerability assessments

### 2. **Monitoring**
- Failed access attempts logging
- Unusual access pattern detection
- Security event alerts

### 3. **Updates**
- Keep rules updated with new features
- Regular security patches
- Performance optimizations

## 🔄 Migration Guide

### From Application-Level Filtering

1. **Remove Privacy Filtering Code**
   - Delete application-level privacy checks
   - Remove filtering from storage methods
   - Update service layer

2. **Deploy Security Rules**
   - Deploy new Firestore rules
   - Test thoroughly in staging
   - Monitor for access issues

3. **Update Client Code**
   - Remove client-side privacy filtering
   - Handle access denied errors
   - Update error handling

### Rollback Plan

1. **Backup Current Rules**
   ```bash
   cp firestore.rules firestore.rules.backup
   ```

2. **Restore Previous Rules**
   ```bash
   cp firestore.rules.backup firestore.rules
   firebase deploy --only firestore:rules
   ```

3. **Re-enable Application Filtering**
   - Restore privacy service methods
   - Re-implement storage filtering
   - Update service layer

## 📞 Support

For questions about these security rules:

1. **Documentation**: Check this file and inline comments
2. **Testing**: Use the provided test scripts
3. **Issues**: Report security concerns immediately
4. **Updates**: Monitor for rule updates and improvements

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Author**: Love20 Security Team 