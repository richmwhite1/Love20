"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupFeedData = exports.processFeedJobs = exports.onUserPrivacyChanged = exports.onFriendshipChanged = exports.onPostUpdated = exports.onPostCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const feed_schema_1 = require("../../shared/feed-schema");
const db = admin.firestore();
// Triggered when a new post is created
exports.onPostCreated = functions.firestore
    .document('posts/{postId}')
    .onCreate(async (snap, context) => {
    const post = snap.data();
    const postId = context.params.postId;
    try {
        console.log(`Processing new post: ${postId}`);
        // Get all users who should see this post
        const eligibleUsers = await getEligibleUsersForPost(post);
        // Create feed generation jobs for each user
        const batch = db.batch();
        for (const userId of eligibleUsers) {
            const jobRef = db.collection('feedGenerationJobs').doc();
            batch.set(jobRef, {
                jobType: feed_schema_1.JobTypeEnum.POST_CREATED,
                userId,
                postId,
                feedTypes: [feed_schema_1.FeedTypeEnum.CHRONOLOGICAL, feed_schema_1.FeedTypeEnum.ALGORITHMIC, feed_schema_1.FeedTypeEnum.FRIENDS],
                priority: 8, // High priority for new posts
                status: feed_schema_1.JobStatusEnum.PENDING,
                attempts: 0,
                maxAttempts: 3,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
        console.log(`Created ${eligibleUsers.length} feed generation jobs for post ${postId}`);
    }
    catch (error) {
        console.error(`Error processing post creation for ${postId}:`, error);
    }
});
// Triggered when a post is updated (privacy changes, engagement updates)
exports.onPostUpdated = functions.firestore
    .document('posts/{postId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const postId = context.params.postId;
    try {
        console.log(`Processing post update: ${postId}`);
        // Check if privacy level changed
        if (before.privacy !== after.privacy) {
            await handlePrivacyChange(postId, before.privacy, after.privacy);
        }
        // Check if engagement metrics changed significantly
        const engagementChanged = Math.abs((after.likeCount || 0) - (before.likeCount || 0)) > 5 ||
            Math.abs((after.commentCount || 0) - (before.commentCount || 0)) > 2 ||
            Math.abs((after.shareCount || 0) - (before.shareCount || 0)) > 1;
        if (engagementChanged) {
            await handleEngagementChange(postId, after);
        }
    }
    catch (error) {
        console.error(`Error processing post update for ${postId}:`, error);
    }
});
// Triggered when friendship status changes
exports.onFriendshipChanged = functions.firestore
    .document('friendships/{friendshipId}')
    .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    try {
        console.log(`Processing friendship change: ${context.params.friendshipId}`);
        if (!before && after) {
            // New friendship created
            await handleFriendshipCreated(after.userId, after.friendId);
        }
        else if (before && !after) {
            // Friendship deleted
            await handleFriendshipDeleted(before.userId, before.friendId);
        }
        else if (before && after && before.status !== after.status) {
            // Friendship status changed
            await handleFriendshipStatusChanged(after.userId, after.friendId, after.status);
        }
    }
    catch (error) {
        console.error(`Error processing friendship change:`, error);
    }
});
// Triggered when user privacy settings change
exports.onUserPrivacyChanged = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;
    try {
        console.log(`Processing user privacy change: ${userId}`);
        if (before.privacyLevel !== after.privacyLevel) {
            await handleUserPrivacyChange(userId, before.privacyLevel, after.privacyLevel);
        }
    }
    catch (error) {
        console.error(`Error processing user privacy change for ${userId}:`, error);
    }
});
// Scheduled function to process feed generation jobs
exports.processFeedJobs = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
    try {
        console.log('Processing feed generation jobs...');
        // Get pending jobs ordered by priority
        const jobsSnapshot = await db.collection('feedGenerationJobs')
            .where('status', '==', feed_schema_1.JobStatusEnum.PENDING)
            .orderBy('priority', 'desc')
            .orderBy('createdAt', 'asc')
            .limit(50) // Process 50 jobs at a time
            .get();
        const batch = db.batch();
        const processedJobs = [];
        for (const jobDoc of jobsSnapshot.docs) {
            const job = jobDoc.data();
            // Mark job as processing
            batch.update(jobDoc.ref, {
                status: feed_schema_1.JobStatusEnum.PROCESSING,
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Process the job
            processedJobs.push(processFeedJob(job, jobDoc.ref));
        }
        // Commit status updates
        await batch.commit();
        // Wait for all jobs to complete
        await Promise.all(processedJobs);
        console.log(`Processed ${jobsSnapshot.docs.length} feed generation jobs`);
    }
    catch (error) {
        console.error('Error processing feed jobs:', error);
    }
});
// Scheduled function to cleanup old feed data
exports.cleanupFeedData = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
    try {
        console.log('Cleaning up old feed data...');
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        // Delete old feed entries
        const oldEntriesSnapshot = await db.collection('feedEntries')
            .where('expiresAt', '<', cutoffDate)
            .limit(1000) // Process in batches
            .get();
        const batch = db.batch();
        oldEntriesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        // Delete old completed jobs
        const oldJobsSnapshot = await db.collection('feedGenerationJobs')
            .where('status', '==', feed_schema_1.JobStatusEnum.COMPLETED)
            .where('completedAt', '<', cutoffDate)
            .limit(1000)
            .get();
        const jobsBatch = db.batch();
        oldJobsSnapshot.docs.forEach(doc => {
            jobsBatch.delete(doc.ref);
        });
        await jobsBatch.commit();
        console.log(`Cleaned up ${oldEntriesSnapshot.docs.length} feed entries and ${oldJobsSnapshot.docs.length} jobs`);
    }
    catch (error) {
        console.error('Error cleaning up feed data:', error);
    }
});
// Helper functions
async function getEligibleUsersForPost(post) {
    const eligibleUsers = new Set();
    if (post.privacy === 'public') {
        // Get all users except the post author
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .get();
        usersSnapshot.docs.forEach(doc => {
            if (doc.id !== post.userId) {
                eligibleUsers.add(doc.id);
            }
        });
    }
    else if (post.privacy === 'friends') {
        // Get friends of the post author
        const friendshipsSnapshot = await db.collection('friendships')
            .where('userId', '==', post.userId)
            .where('status', '==', 'accepted')
            .get();
        friendshipsSnapshot.docs.forEach(doc => {
            eligibleUsers.add(doc.data().friendId);
        });
    }
    return Array.from(eligibleUsers);
}
async function handlePrivacyChange(postId, oldPrivacy, newPrivacy) {
    const batch = db.batch();
    if (newPrivacy === 'private') {
        // Remove post from all feeds
        const feedEntriesSnapshot = await db.collection('feedEntries')
            .where('postId', '==', postId)
            .get();
        feedEntriesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    else {
        // Regenerate feeds for affected users
        const post = await db.collection('posts').doc(postId).get();
        const postData = post.data();
        if (postData) {
            const eligibleUsers = await getEligibleUsersForPost(postData);
            for (const userId of eligibleUsers) {
                const jobRef = db.collection('feedGenerationJobs').doc();
                batch.set(jobRef, {
                    jobType: feed_schema_1.JobTypeEnum.PRIVACY_CHANGED,
                    userId,
                    postId,
                    feedTypes: [feed_schema_1.FeedTypeEnum.CHRONOLOGICAL, feed_schema_1.FeedTypeEnum.ALGORITHMIC, feed_schema_1.FeedTypeEnum.FRIENDS],
                    priority: 6,
                    status: feed_schema_1.JobStatusEnum.PENDING,
                    attempts: 0,
                    maxAttempts: 3,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    }
    await batch.commit();
}
async function handleEngagementChange(postId, post) {
    // Update trending and algorithmic feeds
    const feedEntriesSnapshot = await db.collection('feedEntries')
        .where('postId', '==', postId)
        .where('feedType', 'in', [feed_schema_1.FeedTypeEnum.TRENDING, feed_schema_1.FeedTypeEnum.ALGORITHMIC])
        .get();
    const batch = db.batch();
    feedEntriesSnapshot.docs.forEach(doc => {
        const entry = doc.data();
        const newScore = calculateScore(entry.feedType, post);
        batch.update(doc.ref, {
            score: newScore,
            postEngagement: post.engagement || 0,
            postLikeCount: post.likeCount || 0,
            postCommentCount: post.commentCount || 0,
            postShareCount: post.shareCount || 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
}
async function handleFriendshipCreated(userId1, userId2) {
    // Regenerate feeds for both users
    const batch = db.batch();
    for (const userId of [userId1, userId2]) {
        const jobRef = db.collection('feedGenerationJobs').doc();
        batch.set(jobRef, {
            jobType: feed_schema_1.JobTypeEnum.FRIENDSHIP_CHANGED,
            userId,
            affectedUserIds: [userId1, userId2],
            feedTypes: [feed_schema_1.FeedTypeEnum.FRIENDS, feed_schema_1.FeedTypeEnum.ALGORITHMIC],
            priority: 7,
            status: feed_schema_1.JobStatusEnum.PENDING,
            attempts: 0,
            maxAttempts: 3,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
}
async function handleFriendshipDeleted(userId1, userId2) {
    // Remove posts from each other's feeds
    const batch = db.batch();
    // Remove user2's posts from user1's feeds
    const user1FeedEntries = await db.collection('feedEntries')
        .where('userId', '==', userId1)
        .where('postUserId', '==', userId2)
        .get();
    user1FeedEntries.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    // Remove user1's posts from user2's feeds
    const user2FeedEntries = await db.collection('feedEntries')
        .where('userId', '==', userId2)
        .where('postUserId', '==', userId1)
        .get();
    user2FeedEntries.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}
async function handleFriendshipStatusChanged(userId1, userId2, status) {
    if (status === 'accepted') {
        await handleFriendshipCreated(userId1, userId2);
    }
    else {
        await handleFriendshipDeleted(userId1, userId2);
    }
}
async function handleUserPrivacyChange(userId, oldPrivacy, newPrivacy) {
    // Regenerate feeds for all users who follow this user
    const followersSnapshot = await db.collection('friendships')
        .where('friendId', '==', userId)
        .where('status', '==', 'accepted')
        .get();
    const batch = db.batch();
    followersSnapshot.docs.forEach(doc => {
        const followerId = doc.data().userId;
        const jobRef = db.collection('feedGenerationJobs').doc();
        batch.set(jobRef, {
            jobType: feed_schema_1.JobTypeEnum.PRIVACY_CHANGED,
            userId: followerId,
            affectedUserIds: [userId],
            feedTypes: [feed_schema_1.FeedTypeEnum.CHRONOLOGICAL, feed_schema_1.FeedTypeEnum.ALGORITHMIC, feed_schema_1.FeedTypeEnum.FRIENDS],
            priority: 5,
            status: feed_schema_1.JobStatusEnum.PENDING,
            attempts: 0,
            maxAttempts: 3,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
}
async function processFeedJob(job, jobRef) {
    try {
        const { userId, feedTypes, postId } = job;
        // Generate feeds for each type
        for (const feedType of feedTypes) {
            await generateFeedForUser(userId, feedType, postId);
        }
        // Mark job as completed
        await jobRef.update({
            status: feed_schema_1.JobStatusEnum.COMPLETED,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error(`Error processing job ${jobRef.id}:`, error);
        // Mark job as failed
        await jobRef.update({
            status: feed_schema_1.JobStatusEnum.FAILED,
            attempts: admin.firestore.FieldValue.increment(1),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
}
async function generateFeedForUser(userId, feedType, postId) {
    const startTime = Date.now();
    // Get eligible posts for this user and feed type
    const eligiblePosts = await getEligiblePostsForUser(userId, feedType);
    // Calculate feed entries
    const feedEntries = await calculateFeedEntries(userId, feedType, eligiblePosts);
    // Batch write feed entries
    const batch = db.batch();
    // Remove old entries for this user and feed type
    const oldEntriesSnapshot = await db.collection('feedEntries')
        .where('userId', '==', userId)
        .where('feedType', '==', feedType)
        .get();
    oldEntriesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    // Add new entries
    feedEntries.forEach(entry => {
        const docRef = db.collection('feedEntries').doc();
        batch.set(docRef, {
            ...entry,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
    const loadTime = Date.now() - startTime;
    console.log(`Generated ${feedType} feed for user ${userId} in ${loadTime}ms`);
}
async function getEligiblePostsForUser(userId, feedType) {
    let postsQuery = db.collection('posts')
        .where('privacy', 'in', ['public', 'friends'])
        .orderBy('createdAt', 'desc')
        .limit(1000);
    const postsSnapshot = await postsQuery.get();
    const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Filter based on feed type and user relationships
    switch (feedType) {
        case feed_schema_1.FeedTypeEnum.CHRONOLOGICAL:
            return posts.filter(post => post.privacy === 'public' ||
                (post.privacy === 'friends' && await areFriends(userId, post.userId)));
        case feed_schema_1.FeedTypeEnum.FRIENDS:
            return posts.filter(async (post) => await areFriends(userId, post.userId));
        case feed_schema_1.FeedTypeEnum.ALGORITHMIC:
            return posts.filter(post => post.privacy === 'public' ||
                (post.privacy === 'friends' && await areFriends(userId, post.userId)));
        case feed_schema_1.FeedTypeEnum.TRENDING:
            return posts.filter(post => post.privacy === 'public' &&
                post.engagement > 10);
        default:
            return posts;
    }
}
async function calculateFeedEntries(userId, feedType, posts) {
    const entries = [];
    for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const isFriend = await areFriends(userId, post.userId);
        let score;
        let chronologicalRank;
        let algorithmicRank;
        let friendsRank;
        let trendingRank;
        // Calculate ranks based on feed type
        switch (feedType) {
            case feed_schema_1.FeedTypeEnum.CHRONOLOGICAL:
                chronologicalRank = i + 1;
                break;
            case feed_schema_1.FeedTypeEnum.ALGORITHMIC:
                score = calculateScore(feedType, post, isFriend);
                algorithmicRank = i + 1;
                break;
            case feed_schema_1.FeedTypeEnum.FRIENDS:
                if (isFriend) {
                    friendsRank = i + 1;
                }
                break;
            case feed_schema_1.FeedTypeEnum.TRENDING:
                score = calculateScore(feedType, post);
                trendingRank = i + 1;
                break;
        }
        const entry = {
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
        };
        entries.push(entry);
    }
    return entries;
}
function calculateScore(feedType, post, isFriend) {
    const timeDecay = Math.exp(-0.1 * (Date.now() - post.createdAt?.toDate().getTime()) / (24 * 60 * 60 * 1000));
    const engagementScore = (post.likeCount || 0) * 1 + (post.commentCount || 0) * 2 + (post.shareCount || 0) * 3;
    if (feedType === feed_schema_1.FeedTypeEnum.ALGORITHMIC) {
        const friendBonus = isFriend ? 1.5 : 1.0;
        const userReputation = post.userReputation || 1.0;
        return timeDecay * engagementScore * friendBonus * userReputation;
    }
    else if (feedType === feed_schema_1.FeedTypeEnum.TRENDING) {
        const velocityScore = (post.viewCount || 0) / Math.max(1, (Date.now() - post.createdAt?.toDate().getTime()) / (60 * 60 * 1000));
        return timeDecay * (engagementScore + velocityScore);
    }
    return engagementScore;
}
async function areFriends(userId1, userId2) {
    if (userId1 === userId2)
        return false;
    const friendshipSnapshot = await db.collection('friendships')
        .where('userId', '==', userId1)
        .where('friendId', '==', userId2)
        .where('status', '==', 'accepted')
        .get();
    return !friendshipSnapshot.empty;
}
