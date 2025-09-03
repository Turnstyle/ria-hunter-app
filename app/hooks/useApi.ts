'use client';

import { useState, useCallback } from 'react';
import { apiClient, type AskResponse } from '@/app/lib/api/client';
import type { ApiError } from '@/lib/types';
import { useAuth } from '@/app/contexts/AuthContext';

export function useAskApi() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { session } = useAuth();

	const askQuestion = useCallback(async (
		query: string, 
		options?: { maxResults?: number; includeDetails?: boolean; onRetry?: (attempt: number, delay: number) => void }
	): Promise<AskResponse | null> => {
		if (!query.trim()) return null;

		setIsLoading(true);
		setError(null);

		try {
			// Set auth token if we have a session
			if (session?.access_token) {
				apiClient.setAuthToken(session.access_token);
			}
			const response = await apiClient.ask({ query, options });
			return response;
		} catch (err: any) {
			if (err.code === 'PAYMENT_REQUIRED') {
				setError('Credits exhausted - upgrade to continue');
			} else if (err.code === 'RATE_LIMITED') {
				setError('Too many requests. Please try again later.');
			} else {
				setError(err.message || 'An error occurred while processing your query');
			}
			throw err as ApiError;
		} finally {
			setIsLoading(false);
		}
	}, [session]);

	return { askQuestion, isLoading, error };
}
