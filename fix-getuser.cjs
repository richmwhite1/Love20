const fs = require('fs');
const content = fs.readFileSync('server/storage-enterprise.ts', 'utf8');

const oldMethod = `  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }`;

const newMethod = `  async getUser(id: number): Promise<User | undefined> {
    try {
      const userDoc = await db.collection('users').doc(id.toString()).get();
      if (userDoc.exists) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }`;

const newContent = content.replace(oldMethod, newMethod);
fs.writeFileSync('server/storage-enterprise.ts', newContent);
console.log('getUser method updated to Firebase syntax');
