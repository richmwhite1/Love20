import { getAllPosts } from './firebase-getposts';

async function testGetPosts() {
  try {
    const posts = await getAllPosts();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGetPosts();
