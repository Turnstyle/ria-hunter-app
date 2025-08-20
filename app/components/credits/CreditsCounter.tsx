'use client';

import React from 'react';
import { useCredits } from '@/app/hooks/useCredits';

interface CreditsCounterProps {
	className?: string;
}

const CreditsCounter: React.FC<CreditsCounterProps> = ({ className = "" }) => {
	const { credits, isSubscriber, isLoadingCredits } = useCredits();

	if (isLoadingCredits) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className="h-20 bg-gray-200 rounded-lg"></div>
			</div>
		);
	}

	if (isSubscriber || credits === -1) {
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

	const isLowCredits = credits <= 1;

	return (
		<div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div className="flex-shrink-0">
						<div className={`w-10 h-10 rounded-full flex items-center justify-center ${
							isLowCredits ? 'bg-orange-100' : 'bg-blue-100'
						}` }>
							<svg className={`w-5 h-5 ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
					</div>
					<div>
						<h3 className={`text-sm font-medium ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
							Free Queries Remaining
						</h3>
						<p className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
							{isLowCredits ? 'Running low on credits!' : 'Use them wisely'}
						</p>
					</div>
				</div>
				<div className="text-right">
					<div className={`text-2xl font-bold ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
						{credits}
					</div>
					<div className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
						Credits
					</div>
				</div>
			</div>

			{credits === 0 && (
				<div className="mt-4 pt-4 border-t border-blue-200">
					<div className="text-center">
						<p className="text-sm text-blue-700 font-medium">Ready for unlimited access?</p>
						<button 
							onClick={() => { window.location.href = '/pricing'; }}
							className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
						>
							Upgrade to Pro
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default CreditsCounter;
