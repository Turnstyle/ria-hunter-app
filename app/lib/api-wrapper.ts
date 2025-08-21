import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/app/lib/supabase-server';

export type ApiHandler = (
  req: NextRequest,
  user: any,
  supabase: any
) => Promise<NextResponse>;

export function withAuth(handler: ApiHandler) {
  return async function(req: NextRequest): Promise<NextResponse> {
    try {
      // Extract user credentials from cookies
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      
      // Check for session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
      }
      
      // Then get user details
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('User error:', userError);
        return NextResponse.json({ error: 'Unable to get user data' }, { status: 401 });
      }
      
      // If we got here, user is authenticated, proceed with the handler
      return handler(req, user, supabase);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
    }
  };
}
