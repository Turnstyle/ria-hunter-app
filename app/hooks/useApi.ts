'use client';

import { useState } from 'react';
import type { ApiResponse } from '@/lib/types';

export function useAskApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = async (query: string): Promise<ApiResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
      return (await response.json()) as ApiResponse;
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, error, askQuestion };
}
