import { createClient } from '@supabase/supabase-js';

// Browser-safe version - no fs or path imports
// Use environment variables that have been processed by Next.js
// NEXT_PUBLIC_ prefix is required for client-side access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   "https://llusjnpltqxhokycwzry.supabase.co";

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsdXNqbnBsdHF4aG9reWN3enJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczMzA5NjgsImV4cCI6MjA2MjkwNjk2OH0.mRCFwNzgyrcDsMm6gtLKpwsvwZPe3yunomb36QrOUj4";

// Log only in development
if (process.env.NODE_ENV !== 'production') {
  console.log('Creating Supabase client with:');
  console.log('URL:', supabaseUrl);
  if (supabaseAnonKey) {
    console.log('Key:', supabaseAnonKey.substring(0, 6) + '...');
  }
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add helper methods to expose configuration
export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey
  };
}

// Helper function to test connection
export async function testSupabaseConnection() {
  try {
    const { error, data } = await supabase.auth.getSession();
    return { success: !error, error, data };
  } catch (error) {
    return { success: false, error, data: null };
  }
}
