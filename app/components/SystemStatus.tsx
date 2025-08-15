'use client';

import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'healthy' | 'degraded' | 'error';

export function SystemStatus() {
  const [backend, setBackend] = useState<HealthState>('checking');

  useEffect(() => {
    const check = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || '';
        const healthEndpoint = backendUrl ? 
          `${backendUrl.replace(/\/$/, '')}/api/debug/health` : 
          '/api/debug/health';
        const res = await fetch(healthEndpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const isHealthy = data.status === 'healthy' && 
            data.openai?.status === 'healthy' && 
            data.supabase?.status === 'healthy';
          setBackend(isHealthy ? 'healthy' : 'degraded');
        } else {
          setBackend('degraded');
        }
      } catch {
        setBackend('error');
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const color = backend === 'healthy' ? 'bg-green-500' : backend === 'degraded' ? 'bg-yellow-500' : backend === 'error' ? 'bg-red-500' : 'bg-gray-400';

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
      <span className="hidden sm:inline">System {backend === 'healthy' ? 'operational' : backend}</span>
    </div>
  );
}
