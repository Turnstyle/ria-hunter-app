import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (typeof window !== 'undefined' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn('Missing Supabase environment variables');
}

// Create Supabase client for client-side usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get the current session
export const getSession = () => supabase.auth.getSession();

// Helper function to get the current user
export const getUser = () => supabase.auth.getUser();

// Helper function to sign out
export const signOut = () => supabase.auth.signOut();

// Helper function to sign in with Google OAuth
export const signInWithGoogle = (redirectTo?: string) => {
  const defaultRedirectTo = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/callback`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;
    
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || defaultRedirectTo
    }
  });
};

export default supabase;