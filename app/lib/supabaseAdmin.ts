// Server-only Supabase admin client using the service role key
// Do not import this from client components
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for admin operations');
  }
  return createClient(url, serviceKey);
}

export const supabaseAdmin = createAdminClient();
