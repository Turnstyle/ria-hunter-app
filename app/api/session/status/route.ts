import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

// Demo session constants
const DEMO_SEARCHES_ALLOWED = 5;
const DEMO_SESSION_COOKIE = 'rh_demo';
const DEMO_SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

interface DemoSession {
  searchesUsed: number;
  expiresAt: number;
}

function getDemoSession(cookieStore: any): DemoSession | null {
  try {
    const cookie = cookieStore.get(DEMO_SESSION_COOKIE);
    if (!cookie?.value) return null;
    
    const session = JSON.parse(cookie.value);
    if (session.expiresAt < Date.now()) {
      return null; // Session expired
    }
    return session;
  } catch {
    return null;
  }
}

function setDemoSession(cookieStore: any, searchesUsed: number): void {
  const session: DemoSession = {
    searchesUsed,
    expiresAt: Date.now() + (DEMO_SESSION_TTL * 1000)
  };
  
  cookieStore.set({
    name: DEMO_SESSION_COOKIE,
    value: JSON.stringify(session),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: DEMO_SESSION_TTL,
    path: '/'
  });
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authHeader = request.headers.get('Authorization');
    
    let user = null;
    let isSubscriber = false;
    let isAuthenticated = false;
    
    // Check if user is authenticated
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      
      if (!error && authUser) {
        user = authUser;
        isAuthenticated = true;
        
        // Check subscription status
        try {
          const subscriptionStatus = await checkUserSubscription(user.id);
          isSubscriber = subscriptionStatus.hasActiveSubscription;
        } catch (subError) {
          console.error('Error checking subscription:', subError);
        }
      }
    }
    
    // If subscriber, return unlimited searches
    if (isSubscriber) {
      return NextResponse.json({
        searchesRemaining: -1, // -1 indicates unlimited
        searchesUsed: 0,
        isSubscriber: true,
        isAuthenticated,
        totalAllowed: -1
      });
    }
    
    // For non-subscribers (both anonymous and authenticated), use demo session
    let demoSession = getDemoSession(cookieStore);
    
    if (!demoSession) {
      // Initialize new demo session
      setDemoSession(cookieStore, 0);
      demoSession = { searchesUsed: 0, expiresAt: Date.now() + (DEMO_SESSION_TTL * 1000) };
    }
    
    const searchesRemaining = Math.max(0, DEMO_SEARCHES_ALLOWED - demoSession.searchesUsed);
    
    return NextResponse.json({
      searchesRemaining,
      searchesUsed: demoSession.searchesUsed,
      isSubscriber: false,
      isAuthenticated,
      totalAllowed: DEMO_SEARCHES_ALLOWED
    });
    
  } catch (error) {
    console.error('Session status error:', error);
    
    // Return default demo session on error
    return NextResponse.json({
      searchesRemaining: DEMO_SEARCHES_ALLOWED,
      searchesUsed: 0,
      isSubscriber: false,
      isAuthenticated: false,
      totalAllowed: DEMO_SEARCHES_ALLOWED
    });
  }
}

// Support OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
