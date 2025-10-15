'use client';

/** @jsxRuntime classic */
/** @jsx React.createElement */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';
import { X } from 'lucide-react';

interface DebugInfo {
  authState: 'loading' | 'authenticated' | 'unauthenticated';
  userId?: string;
  searchesRemaining: number | null;
  isSubscriber: boolean;
  lastBalanceStatus?: number;
  streamDoneObserved: boolean;
  timestamp: string;
}

export function DebugOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    authState: 'loading',
    searchesRemaining: null,
    isSubscriber: false,
    streamDoneObserved: false,
    timestamp: new Date().toISOString()
  });

  const { user, session, loading } = useAuth();
  const { searchesRemaining, isSubscriber } = useSessionDemo();

  // Check if debug mode is enabled
  useEffect(() => {
    const checkDebugMode = () => {
      const debugEnabled = localStorage.getItem('debug') === '1';
      setIsVisible(debugEnabled);
    };

    checkDebugMode();
    
    // Listen for storage changes
    window.addEventListener('storage', checkDebugMode);
    
    // Also check on focus
    window.addEventListener('focus', checkDebugMode);
    
    return () => {
      window.removeEventListener('storage', checkDebugMode);
      window.removeEventListener('focus', checkDebugMode);
    };
  }, []);

  // Update debug info
  useEffect(() => {
    const authState = loading ? 'loading' : user ? 'authenticated' : 'unauthenticated';
    
    setDebugInfo(prev => ({
      ...prev,
      authState,
      userId: user?.id,
      searchesRemaining,
      isSubscriber,
      timestamp: new Date().toISOString()
    }));
  }, [loading, user, searchesRemaining, isSubscriber]);

  // Listen for balance API responses
  useEffect(() => {
    if (!isVisible) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check if this is a session status request
      const url = args[0]?.toString() || '';
      if (url.includes('/api/session/status') || url.includes('/api/credits/balance')) {
        setDebugInfo(prev => ({
          ...prev,
          lastBalanceStatus: response.status
        }));
      }
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isVisible]);

  // Listen for [DONE] markers in streams
  useEffect(() => {
    if (!isVisible) return;

    // Create a global function to report [DONE] observations
    (window as any).__reportStreamDone = () => {
      setDebugInfo(prev => ({
        ...prev,
        streamDoneObserved: true
      }));
      
      // Reset after 5 seconds
      setTimeout(() => {
        setDebugInfo(prev => ({
          ...prev,
          streamDoneObserved: false
        }));
      }, 5000);
    };

    return () => {
      delete (window as any).__reportStreamDone;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg shadow-xl z-[9999] font-mono text-xs max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-green-400">DEBUG OVERLAY</span>
        <button
          onClick={() => {
            localStorage.removeItem('debug');
            setIsVisible(false);
          }}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Auth:</span>
          <span className={debugInfo.authState === 'authenticated' ? 'text-green-400' : 'text-yellow-400'}>
            {debugInfo.authState}
          </span>
        </div>
        
        {debugInfo.userId && (
          <div className="flex justify-between">
            <span className="text-gray-400">User ID:</span>
            <span className="text-blue-400 text-[10px]">{debugInfo.userId.slice(0, 8)}...</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-400">Searches Remaining:</span>
          <span className="text-cyan-400">{debugInfo.searchesRemaining ?? 'null'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Subscriber:</span>
          <span className={debugInfo.isSubscriber ? 'text-green-400' : 'text-red-400'}>
            {debugInfo.isSubscriber ? 'Pro' : 'Free'}
          </span>
        </div>
        
        {debugInfo.lastBalanceStatus !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-400">Balance API:</span>
            <span className={debugInfo.lastBalanceStatus === 200 ? 'text-green-400' : 'text-yellow-400'}>
              {debugInfo.lastBalanceStatus}
            </span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-400">[DONE]:</span>
          <span className={debugInfo.streamDoneObserved ? 'text-green-400' : 'text-gray-600'}>
            {debugInfo.streamDoneObserved ? 'Observed ✓' : 'Not seen'}
          </span>
        </div>
        
        <div className="pt-1 mt-1 border-t border-gray-700">
          <div className="text-[10px] text-gray-500">
            Updated: {new Date(debugInfo.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-[10px] text-gray-500">
        Toggle: localStorage.debug = "1"
      </div>
    </div>
  );
}
