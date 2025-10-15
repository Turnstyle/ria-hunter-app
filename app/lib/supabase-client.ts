import { createClient, SupabaseClient, AuthError } from '@supabase/supabase-js';

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
      signInWithOtp: () => Promise.resolve({ error: { message: "Supabase not configured" } }),
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

// Helper function to trigger backend magic link email
export const signInWithMagicLink = async (email: string, redirectTo?: string): Promise<{ error: AuthError | null }> => {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const defaultRedirect = `${origin.replace(/\/$/, '')}/auth/callback`;

  try {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        redirectTo: redirectTo || defaultRedirect,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message =
        (data?.error as string) ||
        response.statusText ||
        'Failed to send magic link';

      return {
        error: {
          message,
          name: 'AuthApiError',
          status: response.status,
        } as AuthError,
      };
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return {
      error: {
        message,
        name: 'AuthApiError',
        status: 500,
      } as AuthError,
    };
  }
};

export default supabase;
