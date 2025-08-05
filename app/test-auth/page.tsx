'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase-client';

export default function TestAuthPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const testGoogleOAuth = async () => {
    setLoading(true);
    setStatus('Testing Google OAuth...');
    
    try {
      // This is the exact call you wanted me to test
      const result = await supabase.auth.signInWithOAuth({ provider: 'google' });
      
      if (result.error) {
        setStatus(`❌ Error: ${result.error.message}`);
        console.error('OAuth Error:', result.error);
      } else {
        setStatus('✅ OAuth call successful! Check browser for redirect...');
        console.log('OAuth Success:', result);
      }
    } catch (error) {
      setStatus(`❌ Exception: ${error}`);
      console.error('OAuth Exception:', error);
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
        <h1 className="text-2xl font-bold text-center mb-6">Google OAuth Test</h1>
        
        <div className="space-y-4">
          <button
            onClick={testGoogleOAuth}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Google OAuth'}
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
        </div>
      </div>
    </div>
  );
}