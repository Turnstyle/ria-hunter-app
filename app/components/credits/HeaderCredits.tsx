'use client';

import React from 'react';
import { useCredits } from '@/hooks/useCredits';

const HeaderCredits: React.FC = () => {
	const { credits, isSubscriber, loading } = useCredits();

	if (loading) return null;

	const displayText = isSubscriber || credits === -1 ? 'Unlimited' : `${credits} Credit${credits === 1 ? '' : 's'}`;
	const colorClass = isSubscriber || credits === -1 ? 'text-green-600' : 
						credits === 0 ? 'text-red-600' : 
						credits === 1 ? 'text-orange-600' : 'text-blue-600';

	return (
		<div className="flex items-center space-x-3">
			<div className="text-sm font-medium text-gray-700">
				<span className={`font-semibold ${colorClass}`}>
					{displayText}
				</span>
			</div>
		</div>
	);
};

export default HeaderCredits;
