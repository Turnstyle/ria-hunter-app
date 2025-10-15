'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase-client';

export default function TestAuthPage() {
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMagicLink = async () => {
    if (!email) {
      setStatus('❌ Please provide a valid email address');
      return;
    }
    setLoading(true);
    setStatus('Sending magic link...');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: `${window.location.origin}/auth/callback` }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data?.error || response.statusText;
        setStatus(`❌ Error: ${message}`);
        console.error('Magic link error:', message);
      } else {
        setStatus('✅ Magic link sent! Check your inbox.');
      }
    } catch (error) {
      setStatus(`❌ Exception: ${error}`);
      console.error('Magic link exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    setLoading(true);
    setStatus('Checking current session...');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`❌ Session Error: ${error.message}`);
      } else if (session) {
        setStatus(`✅ Logged in as: ${session.user.email}`);
      } else {
        setStatus('ℹ️ No active session');
      }
    } catch (error) {
      setStatus(`❌ Session Exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Magic Link Auth Test</h1>

        <div className="space-y-4">
          <label className="w-full text-sm text-gray-700">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              required
            />
          </label>

          <button
            onClick={sendMagicLink}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Magic Link'}
          </button>

          <button
            onClick={checkSession}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Check Session
          </button>
        </div>
        
        {status && (
          <div className="mt-4 p-3 rounded-md bg-gray-100">
            <p className="text-sm font-mono">{status}</p>
          </div>
        )}
        
        <div className="mt-6 text-xs text-gray-500">
          <p><strong>Environment Check:</strong></p>
          <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
          <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
          <p>App URL: {process.env.NEXT_PUBLIC_APP_URL ? '✅ Set' : 'ℹ️ Using localhost fallback'}</p>
        </div>
      </div>
    </div>
  );
}
