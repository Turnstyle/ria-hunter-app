'use client';

import { useAuthStatus } from '@/app/hooks/useAuthStatus';

interface AuthPromptProps {
  resource?: string;
  action?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function AuthPrompt({ 
  resource = "this feature", 
  action = "access",
  className = "",
  children 
}: AuthPromptProps) {
  const { promptLogin } = useAuthStatus();

  const handleClick = () => {
    promptLogin();
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 text-center ${className}`}>
      <h3 className="text-lg font-semibold text-blue-900 mb-2">
        Sign In Required
      </h3>
      <p className="text-blue-700 mb-4">
        You need to sign in to {action} {resource}.
      </p>
      <button
        onClick={handleClick}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign In to Continue
      </button>
      {children}
    </div>
  );
}
