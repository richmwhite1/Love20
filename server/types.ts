export interface ApiResponse<T = any> { 
  success: boolean; 
  data?: T; 
  message?: string; 
  error?: string; 
  code?: number;
} 

export interface NotificationData { 
  id: string; 
  userId: string; 
  type: string; 
  title: string; 
  message: string; 
  read: boolean; 
  createdAt: Date; 
  data?: any; 
  postId?: string; 
  fromUserId?: string;
} 

export type PrivacyLevel = "public" | "connections" | "private";

// Firestore-specific types
export interface FirebaseUser {
  id: string;
  username: string;
  email: string;
  name: string;
  profilePictureUrl?: string | null;
  privacy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FirebasePost {
  id: string;
  userId: string;
  listId: string;
  primaryPhotoUrl: string;
  primaryLink: string;
  linkLabel?: string;
  primaryDescription: string;
  discountCode?: string;
  additionalPhotos?: string[];
  additionalPhotoData?: any[];
  spotifyUrl?: string;
  spotifyLabel?: string;
  youtubeUrl?: string;
  youtubeLabel?: string;
  mediaMetadata?: any;
  privacy: string;
  engagement: number;
  isEvent: boolean;
  eventDate?: Date;
  reminders?: string[];
  isRecurring: boolean;
  recurringType?: string;
  taskList?: any[];
  attachedLists?: string[];
  allowRsvp: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirebaseList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  privacyLevel: string;
  createdAt: Date;
  updatedAt: Date;
}
