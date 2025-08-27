'use client';

import { useState, useEffect } from 'react';
import { XCircle, AlertTriangle, InfoIcon, X } from 'lucide-react';

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorMessage {
  id: string;
  message: string;
  severity: ErrorSeverity;
  details?: string;
  dismissible?: boolean;
  autoHide?: number; // milliseconds to auto-hide
}

interface ErrorBannerProps {
  error?: ErrorMessage | null;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const [visible, setVisible] = useState(false);
  const [currentError, setCurrentError] = useState<ErrorMessage | null>(null);

  useEffect(() => {
    if (error) {
      setCurrentError(error);
      setVisible(true);

      if (error.autoHide) {
        const timer = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, error.autoHide);

        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [error, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !currentError) {
    return null;
  }

  const icons = {
    error: <XCircle className="w-5 h-5 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
    info: <InfoIcon className="w-5 h-5 flex-shrink-0" />
  };

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4 
      p-4 rounded-lg border shadow-lg transition-all duration-300 ${styles[currentError.severity]}`}>
      <div className="flex items-start gap-3">
        {icons[currentError.severity]}
        
        <div className="flex-1 space-y-1">
          <p className="font-medium">{currentError.message}</p>
          {currentError.details && (
            <p className="text-sm opacity-90">{currentError.details}</p>
          )}
        </div>

        {currentError.dismissible !== false && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Global error manager (can be used throughout the app)
class ErrorManager {
  private listeners: ((error: ErrorMessage | null) => void)[] = [];
  private currentError: ErrorMessage | null = null;

  subscribe(listener: (error: ErrorMessage | null) => void) {
    this.listeners.push(listener);
    // Immediately notify of current error if any
    if (this.currentError) {
      listener(this.currentError);
    }

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  showError(message: string, details?: string, severity: ErrorSeverity = 'error', autoHide?: number) {
    const error: ErrorMessage = {
      id: Date.now().toString(),
      message,
      details,
      severity,
      dismissible: true,
      autoHide
    };

    this.currentError = error;
    this.notifyListeners();
  }

  showBackendError() {
    this.showError(
      'Backend services are currently unavailable',
      'Our team has been notified and is working to resolve the issue. Please try again in a few moments.',
      'error',
      10000 // Auto-hide after 10 seconds
    );
  }

  showAuthenticationError() {
    this.showError(
      'Authentication required',
      'Please sign in to continue using this feature.',
      'warning'
    );
  }

  showRateLimitError() {
    this.showError(
      'Too many requests',
      'Please wait a moment before trying again.',
      'warning',
      5000
    );
  }

  showDemoLimitError() {
    this.showError(
      'Demo limit reached',
      'You\'ve used your 5 free searches. Create a free account to continue with unlimited searches for 7 days.',
      'info'
    );
  }

  clear() {
    this.currentError = null;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentError));
  }
}

// Export singleton instance
export const errorManager = new ErrorManager();

// Hook to use error manager in components
export function useErrorManager() {
  const [error, setError] = useState<ErrorMessage | null>(null);

  useEffect(() => {
    const unsubscribe = errorManager.subscribe(setError);
    return unsubscribe;
  }, []);

  return {
    error,
    showError: errorManager.showError.bind(errorManager),
    showBackendError: errorManager.showBackendError.bind(errorManager),
    showAuthenticationError: errorManager.showAuthenticationError.bind(errorManager),
    showRateLimitError: errorManager.showRateLimitError.bind(errorManager),
    showDemoLimitError: errorManager.showDemoLimitError.bind(errorManager),
    clear: errorManager.clear.bind(errorManager)
  };
}
