// This file can only be imported in server contexts (Server Components, API routes, etc.)
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Server-side environment variable loading function
export function ensureSupabaseEnvVarsLoaded() {
  // Server-side can access both NEXT_PUBLIC_ and regular environment variables
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return;
  }

  console.log('Supabase variables not found in environment, attempting to load from .env.local...');

  // Try to find the root .env.local file
  const rootDir = path.resolve(process.cwd());
  const envPath = path.resolve(rootDir, '.env.local');

  if (fs.existsSync(envPath)) {
    try {
      // Read content and handle BOM if present
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
        console.log('Removed BOM character from .env.local for Supabase');
      }

      // Parse and set environment variables
      const lines = content.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) {
            process.env[key] = value;
            console.log(`Directly set ${key} from .env.local for Supabase`);
          }
        }
      });

      // Also ensure NEXT_PUBLIC_ variables are set for client-side access
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
        console.log('Set NEXT_PUBLIC_SUPABASE_URL from SUPABASE_URL');
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
        console.log('Set NEXT_PUBLIC_SUPABASE_ANON_KEY from SUPABASE_ANON_KEY');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading .env.local for Supabase:', errorMessage);
    }
  } else {
    console.log('.env.local file not found at path:', envPath);
  }
}

// Log Supabase environment variables for debugging
export function logSupabaseEnvVars() {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;
  const hasPublicUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasPublicAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Supabase environment variables status:');
  console.log('SUPABASE_URL:', hasUrl ? 'Set ✓' : 'Not set ✗');
  console.log('SUPABASE_ANON_KEY:', hasAnonKey ? 'Set ✓' : 'Not set ✗');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', hasPublicUrl ? 'Set ✓' : 'Not set ✗');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', hasPublicAnonKey ? 'Set ✓' : 'Not set ✗');

  return { hasUrl, hasAnonKey, hasPublicUrl, hasPublicAnonKey };
}

// Create a server-side Supabase client
export function getServerSupabaseClient() {
  // Prioritize server-side environment variables
  const supabaseUrl = process.env.SUPABASE_URL ||
                     process.env.NEXT_PUBLIC_SUPABASE_URL ||
                     "https://llusjnpltqxhokycwzry.supabase.co";

  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ||
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsdXNqbnBsdHF4aG9reWN3enJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczMzA5NjgsImV4cCI6MjA2MjkwNjk2OH0.mRCFwNzgyrcDsMm6gtLKpwsvwZPe3yunomb36QrOUj4";

  return createClient(supabaseUrl, supabaseAnonKey);
}
