import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase environment variables are not set. Using placeholder client.');
  // Provide a placeholder client to avoid crashing the app
  supabase = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithOAuth: () => Promise.resolve({ error: { message: "Supabase not configured" } }),
    },
  } as any;
}

export { supabase };

// Helper function to get the current session
export const getSession = () => supabase.auth.getSession();


// Helper function to get the current user
export const getUser = () => supabase.auth.getUser();

// Helper function to sign out
export const signOut = () => supabase.auth.signOut();

// Helper function to sign in with Google OAuth
export const signInWithGoogle = (redirectTo?: string) => {
  // Redirect users back to the app root by default to avoid 404s on missing callback routes
  const defaultRedirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`;
    
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || defaultRedirectTo
    }
  });
};

export default supabase;