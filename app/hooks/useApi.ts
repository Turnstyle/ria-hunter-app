'use client';

import { useState, useCallback } from 'react';
import { queryRia } from '@/services/ria';
import { type AskResponse } from '@/app/lib/api/client';
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
			const response = await queryRia(query, options, session);
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
