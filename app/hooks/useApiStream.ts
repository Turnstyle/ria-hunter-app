'use client';

import { useRef, useState } from 'react';

export function useAskApiStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const start = (query: string, onData: (chunk: string) => void, onDone?: () => void) => {
    if (isStreaming) return;
    setIsStreaming(true);
    setError(null);
    const url = `/api/ask-stream?query=${encodeURIComponent(query)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (ev) => {
      onData(ev.data ?? '');
    };
    es.onerror = () => {
      setError('Stream error');
      es.close();
      setIsStreaming(false);
      onDone?.();
    };
    es.addEventListener('done', () => {
      es.close();
      setIsStreaming(false);
      onDone?.();
    });
  };

  const stop = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsStreaming(false);
  };

  return { isStreaming, error, start, stop };
}


