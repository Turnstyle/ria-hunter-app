'use client';

import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface ProblemReportFormProps {
  className?: string;
}

const ProblemReportForm: React.FC<ProblemReportFormProps> = ({ className = "" }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const maxLength = 250;
  const remainingChars = maxLength - message.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      setError('Please enter a message describing the problem.');
      return;
    }
    
    if (!user) {
      setError('You must be signed in to submit a problem report.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/problem-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          userEmail: user.email,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit problem report');
      }

      setSubmitted(true);
      setMessage('');
    } catch (err) {
      console.error('Error submitting problem report:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit problem report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    if (newMessage.length <= maxLength) {
      setMessage(newMessage);
      setError(''); // Clear error when user starts typing
    }
  };

  if (submitted) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Problem report submitted successfully!
            </h3>
            <p className="mt-2 text-sm text-green-700">
              Thank you for your feedback. We'll review your report and get back to you if needed.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 text-sm text-green-600 hover:text-green-500 underline focus:outline-none"
            >
              Submit another report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Found a problem?</h3>
        <p className="text-sm text-gray-600">
          Let us know about any issues you've encountered. We'll investigate and work to resolve them quickly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="problem-message" className="block text-sm font-medium text-gray-700 mb-2">
            Describe the problem
          </label>
          <textarea
            id="problem-message"
            rows={4}
            value={message}
            onChange={handleMessageChange}
            placeholder="Please describe what went wrong, what you were trying to do, and any error messages you saw..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            disabled={isSubmitting}
          />
          <div className="mt-1 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Be as specific as possible to help us resolve the issue quickly.
            </div>
            <div className={`text-xs ${remainingChars < 20 ? 'text-red-500' : 'text-gray-500'}`}>
              {remainingChars} characters remaining
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !message.trim() || !user}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </form>

      {!user && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            You must be signed in to submit a problem report.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProblemReportForm;