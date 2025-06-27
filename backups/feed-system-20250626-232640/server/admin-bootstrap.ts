import { db } from "./firebase-db";
import bcrypt from 'bcryptjs';

export async function createBootstrapAdmin() {
  try {
    // Check if admin already exists
    const adminSnapshot = await db.collection('adminUsers').limit(1).get();
    
    if (!adminSnapshot.empty) {
      console.log('Admin user already exists');
      return adminSnapshot.docs[0].data();
    }

    // Create bootstrap admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminData = {
      username: 'admin',
      password: hashedPassword,
      email: 'admin@share.com',
      role: 'super_admin',
      permissions: [
        'user_management',
        'content_moderation', 
        'system_config',
        'admin_management',
        'data_export'
      ],
      isActive: true,
      createdAt: new Date()
    };

    const adminRef = await db.collection('adminUsers').add(adminData);
    const admin = { id: adminRef.id, ...adminData };

    console.log('Bootstrap admin user created successfully');
    return admin;
    
  } catch (error) {
    console.error('Error creating bootstrap admin:', error);
    throw error;
  }
}