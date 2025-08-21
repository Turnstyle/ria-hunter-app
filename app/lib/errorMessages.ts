export interface ApiErrorDetails {
  message: string;
  action?: string;
  actionLabel?: string;
  recoverable: boolean;
}

export function getErrorMessage(status: number, code?: string): ApiErrorDetails {
  switch (status) {
    case 401:
      return {
        message: 'You must be signed in to access this resource.',
        action: 'login',
        actionLabel: 'Sign In',
        recoverable: true
      };
    
    case 402:
      return {
        message: code === 'PAYMENT_REQUIRED' 
          ? 'You\'ve used all your free queries. Upgrade to Pro for unlimited access.'
          : 'Payment is required to access this feature.',
        action: 'upgrade',
        actionLabel: 'Upgrade to Pro',
        recoverable: true
      };
    
    case 403:
      return {
        message: 'You do not have permission to perform this action.',
        recoverable: false
      };
    
    case 404:
      return {
        message: 'The requested item could not be found.',
        recoverable: false
      };
    
    case 429:
      return {
        message: 'Too many requests. Please try again later.',
        action: 'retry',
        actionLabel: 'Retry',
        recoverable: true
      };
    
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        message: 'Server error. Please try again in a moment.',
        action: 'retry',
        actionLabel: 'Retry',
        recoverable: true
      };
    
    default:
      return {
        message: 'An unexpected error occurred. Please try again.',
        action: 'retry',
        actionLabel: 'Retry',
        recoverable: true
      };
  }
}

export function getErrorMessageFromException(error: any): ApiErrorDetails {
  if (error?.code) {
    switch (error.code) {
      case 'PAYMENT_REQUIRED':
        return getErrorMessage(402, error.code);
      case 'UNAUTHORIZED':
        return getErrorMessage(401, error.code);
      case 'RATE_LIMITED':
        return getErrorMessage(429, error.code);
      default:
        return {
          message: error.message || 'An unexpected error occurred.',
          recoverable: true
        };
    }
  }
  
  if (error?.status) {
    return getErrorMessage(error.status);
  }
  
  return {
    message: error?.message || 'An unexpected error occurred.',
    recoverable: true
  };
}
