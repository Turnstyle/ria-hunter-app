'use client';

import React from 'react';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';

interface CreditsCounterProps {
	className?: string;
}

const CreditsCounter: React.FC<CreditsCounterProps> = ({ className = "" }) => {
	const { searchesRemaining, isSubscriber, isLoading } = useSessionDemo();

	// Show loading state or fallback
	if (isLoading) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className="h-20 bg-gray-200 rounded-lg"></div>
			</div>
		);
	}

	if (isSubscriber) {
		return (
			<div className={`bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 ${className}`}>
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div className="flex-shrink-0">
							<div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
								<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
							</div>
						</div>
						<div>
							<h3 className="text-sm font-medium text-green-800">Pro Plan Active</h3>
							<p className="text-xs text-green-600">Unlimited queries</p>
						</div>
					</div>
					<div className="text-right">
						<div className="text-lg font-bold text-green-800">∞</div>
						<div className="text-xs text-green-600">Queries</div>
					</div>
				</div>
			</div>
		);
	}

	const remaining = searchesRemaining ?? 5;
	
	return (
		<div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
			<div className="text-center">
				<div className="text-3xl font-bold text-blue-800 mb-2">
					{remaining}
				</div>
				<h3 className="text-lg font-semibold text-blue-800">Free Searches Left</h3>
				<p className="text-sm text-blue-600 mb-4">
					{remaining === 0 ? 'Demo limit reached' : 'Explore RIA Hunter'}
				</p>
				
				{remaining === 0 && (
					<a
						href="/signup" 
						className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
					>
						Get Unlimited Access
					</a>
				)}
			</div>
		</div>
	);
};

export default CreditsCounter;
