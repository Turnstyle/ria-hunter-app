'use client';

// This file has been deprecated as we're standardizing on POST with fetch streaming
// See app/lib/api/client.ts for the new implementation

import { useCallback, useState } from 'react';
import { apiClient } from '../lib/api/client';
import type { AskRequest, AskResponse } from '../lib/api/client';

export function useAskApiStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let abortController: AbortController | null = null;

  const start = async (query: string, onData: (chunk: string) => void, onDone?: () => void) => {
    if (isStreaming) return;
    setIsStreaming(true);
    setError(null);

    try {
      const request: AskRequest = { query };
      
      abortController = await apiClient.askStream(
        request,
        // On token callback
        (token: string) => {
          onData(token);
        },
        // On complete callback
        (response: AskResponse) => {
          setIsStreaming(false);
          onDone?.();
        },
        // On error callback
        (error: Error) => {
          console.error('Stream error:', error);
          setError(error.message);
          setIsStreaming(false);
          onDone?.();
        }
      );
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError(err instanceof Error ? err.message : String(err));
      setIsStreaming(false);
      onDone?.();
    }
  };

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    setIsStreaming(false);
  };

  return { isStreaming, error, start, stop };
}