'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase-client';

export function SupabaseConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking connection...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        // Simple test to see if Supabase is connected by getting system health
        const { data, error } = await supabase.rpc('heartbeat');

        if (error) {
          throw error;
        }

        setConnectionStatus('Connected to Supabase!');
      } catch (err) {
        console.error('Supabase connection error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setConnectionStatus('Connection failed');
      }
    }

    checkConnection();

    return () => {
      // Clean up any subscriptions or connections if needed
    };
  }, []);

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-xl font-bold mb-2">Supabase Connection Status</h2>
      <p className={`${connectionStatus === 'Connected to Supabase!' ? 'text-green-600' : 'text-red-600'}`}>
        {connectionStatus}
      </p>
      {error && <p className="text-red-600 mt-2">Error: {error}</p>}
      <p className="mt-4 text-sm text-gray-600">
        This component checks if your Supabase connection is properly configured.
        Make sure your environment variables are correctly set in .env.local:
      </p>
      <ul className="mt-2 text-sm list-disc list-inside text-gray-600">
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
      </ul>
    </div>
  );
}

export default SupabaseConnectionTest;
