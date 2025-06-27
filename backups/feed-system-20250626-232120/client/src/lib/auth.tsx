import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, User, AuthError, AuthState } from './auth-service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, username?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  });

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChanged((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    await authService.signIn(email, password);
  };

  const signUp = async (email: string, password: string, name: string, username?: string): Promise<void> => {
    await authService.signUp(email, password, name, username);
  };

  const signInWithGoogle = async (): Promise<void> => {
    await authService.signInWithGoogle();
  };

  const signOut = async (): Promise<void> => {
    await authService.signOut();
  };

  const getIdToken = async (): Promise<string | null> => {
    return await authService.getIdToken();
  };

  return (
    <AuthContext.Provider value={{
      user: authState.user,
      isLoading: authState.isLoading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      isAuthenticated: authState.isAuthenticated,
      getIdToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}
