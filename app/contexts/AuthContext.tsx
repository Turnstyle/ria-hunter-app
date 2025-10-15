'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, signInWithMagicLink, signOut } from '@/app/lib/supabase-client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  account: Record<string, any> | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const lastSyncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const syncAccount = async () => {
      if (!session?.access_token) {
        setAccount(null);
        lastSyncedTokenRef.current = null;
        return;
      }

      if (lastSyncedTokenRef.current === session.access_token) {
        return;
      }

      try {
        const response = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Account sync failed:', response.statusText);
          return;
        }

        const data = await response.json().catch(() => ({}));
        setAccount(data || null);
        lastSyncedTokenRef.current = session.access_token;
      } catch (error) {
        console.error('Account sync error:', error);
      }
    };

    syncAccount();
  }, [session?.access_token]);

  const contextValue: AuthContextType = {
    user,
    session,
    loading,
    signInWithMagicLink: async (email: string, redirectTo?: string) => {
      try {
        const { error } = await signInWithMagicLink(email, redirectTo);
        return { error };
      } catch (error) {
        console.error('Sign in error:', error);
        return { error: error as AuthError };
      }
    },
    signOut: async () => {
      try {
        const result = await signOut();
        if (!result.error) {
          setUser(null);
          setSession(null);
          setAccount(null);
          lastSyncedTokenRef.current = null;
        }
        return result;
      } catch (error) {
        console.error('Sign out error:', error);
        return { error: error as AuthError };
      }
    },
    account,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
