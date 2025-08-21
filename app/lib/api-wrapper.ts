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
      
      // Check for Authorization header first
      const authHeader = req.headers.get('authorization');
      let user = null;
      let session = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token) {
          try {
            // Verify token and get user data
            const { data: authData, error: authError } = await supabase.auth.getUser(token);
            if (!authError && authData.user) {
              user = authData.user;
              // Create a mock session 
              session = { user, access_token: token };
            }
          } catch (tokenError) {
            console.error('Token verification error:', tokenError);
          }
        }
      }
      
      // If no user from token, fall back to cookie session
      if (!user) {
        // Check for session from cookies
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData.session) {
          console.error('Session error:', sessionError);
          return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
        }
        
        session = sessionData.session;
        
        // Then get user details
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError || !userData.user) {
          console.error('User error:', userError);
          return NextResponse.json({ error: 'Unable to get user data' }, { status: 401 });
        }
        
        user = userData.user;
      }
      
      // If we got here, user is authenticated, proceed with the handler
      return handler(req, user, supabase);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
    }
  };
}
