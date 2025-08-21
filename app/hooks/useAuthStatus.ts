'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export type AuthState = 'anonymous' | 'limited' | 'authenticated';

interface UseAuthStatusReturn {
  authState: AuthState;
  user: any;
  session: any;
  isAuthenticated: boolean;
  isSubscriber: boolean;
  promptLogin: (redirectTo?: string) => void;
  handleUnauthorized: (resource: string) => void;
}

export function useAuthStatus(): UseAuthStatusReturn {
  const { user, session, loading } = useAuth();
  const router = useRouter();

  // Determine auth state
  const getAuthState = (): AuthState => {
    if (loading) return 'anonymous';
    if (!user || !session) return 'anonymous';
    // For now, assume authenticated users have full access
    // This could be enhanced with subscription status checking
    return 'authenticated';
  };

  const authState = getAuthState();
  const isAuthenticated = authState === 'authenticated';
  const isSubscriber = isAuthenticated; // This could be enhanced with actual subscription checking

  const promptLogin = (redirectTo?: string) => {
    const redirect = redirectTo || window.location.pathname;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

  const handleUnauthorized = (resource: string) => {
    console.warn(`Unauthorized access to ${resource}`);
    // Show notification or modal here if needed
    promptLogin();
  };

  return {
    authState,
    user,
    session,
    isAuthenticated,
    isSubscriber,
    promptLogin,
    handleUnauthorized,
  };
}
