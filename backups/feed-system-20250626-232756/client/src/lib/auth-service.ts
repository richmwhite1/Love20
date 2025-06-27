import { auth } from '../firebase';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  onIdTokenChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  profilePictureUrl?: string | null;
  privacy?: string;
  createdAt?: Date;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

class AuthService {
  private currentUser: User | null = null;
  private isLoading = true;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private authStateListeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Listen for authentication state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await this.handleUserSignIn(firebaseUser);
      } else {
        this.handleUserSignOut();
      }
      this.isLoading = false;
      this.notifyListeners();
    });

    // Listen for token changes to handle automatic refresh
    onIdTokenChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        this.setupTokenRefresh();
      } else {
        this.clearTokenRefresh();
      }
    });
  }

  private async handleUserSignIn(firebaseUser: FirebaseUser) {
    try {
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        this.currentUser = userDoc.data() as User;
      } else {
        // Create user document in Firestore if it doesn't exist
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          profilePictureUrl: firebaseUser.photoURL || null,
          privacy: 'public',
          createdAt: new Date()
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), userData);
        this.currentUser = userData;
        
        // Call backend to ensure user exists and has General list
        await this.ensureUserInBackend();
      }
    } catch (error) {
      console.error('Error handling user sign in:', error);
      // Fallback to Firebase user data
      this.currentUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
        profilePictureUrl: firebaseUser.photoURL || null,
        privacy: 'public',
        createdAt: new Date()
      };
    }
  }

  private handleUserSignOut() {
    this.currentUser = null;
    this.clearTokenRefresh();
  }

  private async ensureUserInBackend() {
    try {
      const token = await this.getIdToken();
      if (!token) return;

      const response = await fetch('/api/auth/ensure-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('Failed to ensure user in backend:', response.status);
      }
    } catch (error) {
      console.warn('Error ensuring user in backend:', error);
    }
  }

  private setupTokenRefresh() {
    // Clear existing timer
    this.clearTokenRefresh();
    
    // Set up token refresh every 50 minutes (tokens expire after 1 hour)
    this.tokenRefreshTimer = setInterval(async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true); // Force refresh
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }, 50 * 60 * 1000); // 50 minutes
  }

  private clearTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private notifyListeners() {
    const state: AuthState = {
      user: this.currentUser,
      isLoading: this.isLoading,
      isAuthenticated: !!this.currentUser
    };
    
    this.authStateListeners.forEach(listener => listener(state));
  }

  // Public methods
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async getIdToken(): Promise<string | null> {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
      return null;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  public async signIn(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  public async signUp(email: string, password: string, name: string, username?: string): Promise<void> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Update Firebase profile with display name
      await updateProfile(firebaseUser, {
        displayName: name
      });
      
      // Create user document in Firestore
      const userData: User = {
        id: firebaseUser.uid,
        email,
        username: username || email.split('@')[0],
        name,
        profilePictureUrl: null,
        privacy: 'public',
        createdAt: new Date()
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  public async signInWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  public async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  public onAuthStateChanged(listener: (state: AuthState) => void): () => void {
    this.authStateListeners.push(listener);
    
    // Call immediately with current state
    listener({
      user: this.currentUser,
      isLoading: this.isLoading,
      isAuthenticated: !!this.currentUser
    });
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(listener);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  private handleAuthError(error: any): AuthError {
    let message = 'An unexpected error occurred';
    
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email address';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later';
        break;
      case 'auth/popup-closed-by-user':
        message = 'Sign-in was cancelled';
        break;
      case 'auth/popup-blocked':
        message = 'Sign-in popup was blocked. Please allow popups for this site';
        break;
      default:
        message = error.message || 'Authentication failed';
    }
    
    return {
      code: error.code || 'unknown',
      message
    };
  }
}

// Export singleton instance
export const authService = new AuthService(); 