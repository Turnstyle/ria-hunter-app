'use client';

import { getErrorMessageFromException, ApiErrorDetails } from '@/app/lib/errorMessages';
import { useAuthStatus } from '@/app/hooks/useAuthStatus';
import AuthPrompt from '@/app/components/auth/AuthPrompt';

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorDisplay({ error, onRetry, className = "" }: ErrorDisplayProps) {
  const { isAuthenticated } = useAuthStatus();
  const errorDetails: ApiErrorDetails = getErrorMessageFromException(error);

  const handleAction = () => {
    if (errorDetails.action === 'retry' && onRetry) {
      onRetry();
    } else if (errorDetails.action === 'upgrade') {
      // Navigate to subscription page
      window.location.href = '/subscription';
    }
  };

  // Special handling for authentication errors
  if (errorDetails.action === 'login' && !isAuthenticated) {
    return (
      <AuthPrompt 
        resource="this content"
        action="access"
        className={className}
      />
    );
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Error
          </h3>
          <p className="mt-1 text-sm text-red-700">
            {errorDetails.message}
          </p>
          {errorDetails.recoverable && errorDetails.action && (
            <div className="mt-3">
              <button
                onClick={handleAction}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
              >
                {errorDetails.actionLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
