// Firebase version of getAllPosts
import { db } from "./db";

export async function getAllPosts(viewerId?: number): Promise<any[]> {
  try {
    console.log('Fetching posts from Firestore for viewerId:', viewerId);
    
    // Get posts from Firestore
    const postsSnapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const posts: any[] = [];
    
    for (const doc of postsSnapshot.docs) {
      const postData = doc.data();
      
      // Get user data for each post
      let userData = null;
      if (postData.userId) {
        const userDoc = await db.collection('users').doc(postData.userId).get();
        userData = userDoc.data();
      }
      
      posts.push({
        ...postData,
        id: doc.id,
        user: userData || { id: postData.userId || 'unknown', username: 'Unknown User' }
      });
    }
    
    console.log(`Found ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.error('Error fetching posts from Firestore:', error);
    throw error;
  }
}
