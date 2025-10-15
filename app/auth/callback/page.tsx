'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/app/lib/supabase-client';

type Status = 'verifying' | 'error';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string>('Verifying your session...');

  useEffect(() => {
    const handleAuth = async () => {
      const currentUrl = new URL(window.location.href);
      const redirectTo = currentUrl.searchParams.get('redirect_to') || '/';
      const errorParam = currentUrl.searchParams.get('error');
      const code = currentUrl.searchParams.get('code');

      if (errorParam) {
        setStatus('error');
        setMessage(errorParam);
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }
          if (!data.session) {
            throw new Error('Unable to detect a valid session.');
          }
        }

        router.replace(redirectTo);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Sign-in verification failed.';
        setStatus('error');
        setMessage(errorMessage);
      }
    };

    void handleAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
        {status === 'verifying' ? (
          <>
            <div className="mx-auto mb-4 h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <h1 className="text-lg font-semibold text-gray-900">Checking your session…</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-red-600">Sign-in failed</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <button
              onClick={() => router.replace('/login')}
              className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
