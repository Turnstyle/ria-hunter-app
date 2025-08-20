// This file can only be imported in server contexts (Server Components, API routes, etc.)
import { createClient as supabaseCreateClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Export createClient for API routes
export function createClient(cookieStore?: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  if (!supabaseUrl || !supabaseKey) {
    logSupabaseEnvVars();
    throw new Error('Supabase URL and anon key are required for client');
  }
  
  // Use the basic client without cookies for server-side components
  return supabaseCreateClient(supabaseUrl, supabaseKey);
}

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
}

// Get the server-side Supabase client (for Server Components and API routes)
export function getServerSupabaseClient() {
  // Prefer secure service role in server context; fallback to anon/public if not set
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
    || process.env.SUPABASE_ANON_KEY 
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logSupabaseEnvVars();
    throw new Error('Supabase URL and anon key are required for server-side client');
  }

  return supabaseCreateClient(supabaseUrl, supabaseKey);
}
