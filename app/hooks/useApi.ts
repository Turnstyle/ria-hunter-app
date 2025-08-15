'use client';

import { useState, useCallback } from 'react';
import { queryRia, QueryResponse } from '@/services/ria';
import type { ApiError } from '@/lib/types';

export function useAskApi() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const askQuestion = useCallback(async (query: string): Promise<QueryResponse | null> => {
		if (!query.trim()) return null;

		setIsLoading(true);
		setError(null);

		try {
			const response = await queryRia(query);
			return response;
		} catch (err: any) {
			if (err.code === 'PAYMENT_REQUIRED') {
				setError('Credits exhausted - upgrade to continue');
			} else {
				setError(err.message || 'An error occurred while processing your query');
			}
			throw err as ApiError;
		} finally {
			setIsLoading(false);
		}
	}, []);

	return { askQuestion, isLoading, error };
}
