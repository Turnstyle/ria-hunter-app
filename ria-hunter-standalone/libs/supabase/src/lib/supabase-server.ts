// This file can only be imported in server contexts (Server Components, API routes, etc.)
// import * as fs from 'fs'; // No longer needed
// import * as path from 'path'; // No longer needed
import { createClient } from '@supabase/supabase-js';

// The ensureSupabaseEnvVarsLoaded function is removed.
// Supabase configuration will rely on process.env variables set by Vercel.

// Log Supabase environment variables for debugging
export function logSupabaseEnvVars() {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;
  const hasPublicUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasPublicAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Supabase environment variables status from process.env:');
  console.log('SUPABASE_URL:', hasUrl ? (process.env.SUPABASE_URL?.substring(0,20) + '...') : 'Not set ');
  console.log('SUPABASE_ANON_KEY:', hasAnonKey ? (process.env.SUPABASE_ANON_KEY?.substring(0,5) + '...') : 'Not set ');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', hasPublicUrl ? (process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0,20) + '...') : 'Not set ');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', hasPublicAnonKey ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0,5) + '...') : 'Not set ');

  return { hasUrl, hasAnonKey, hasPublicUrl, hasPublicAnonKey };
}

// Create a server-side Supabase client
export function getServerSupabaseClient() {
  // Prioritize server-side environment variables from process.env
  const supabaseUrl = process.env.SUPABASE_URL ||
                     process.env.NEXT_PUBLIC_SUPABASE_URL ||
                     "https://llusjnpltqxhokycwzry.supabase.co";

  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ||
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsdXNqbnBsdHF4aG9reWN3enJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczMzA5NjgsImV4cCI6MjA2MjkwNjk2OH0.mRCFwNzgyrcDsMm6gtLKpwsvwZPe3yunomb36QrOUj4";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing. Ensure environment variables are set.');
    // Depending on strictness, you might throw an error here or allow client creation to fail
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
