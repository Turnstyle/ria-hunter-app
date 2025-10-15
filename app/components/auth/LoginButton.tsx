'use client';

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface LoginButtonProps {
  className?: string;
  redirectTo?: string;
}

export default function LoginButton({ className = '', redirectTo }: LoginButtonProps) {
  const { signInWithMagicLink, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await signInWithMagicLink(email, redirectTo);

      if (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to send magic link' });
      } else {
        setMessage({
          type: 'success',
          text: 'Check your email! We sent you a sign-in link.',
        });
        setEmail('');
        setTimeout(() => setShowForm(false), 3000);
      }
    } catch (error) {
      console.error('Unexpected magic link error:', error);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        disabled={authLoading}
      >
        Sign In
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white rounded-lg shadow-lg min-w-[280px]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-900">Sign In</h3>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setMessage(null);
              setEmail('');
            }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close sign-in form"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-2 text-sm text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending…' : 'Send Magic Link'}
        </button>

        {message && (
          <div
            className={`text-sm p-2 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="text-xs text-gray-500 text-center">
          We’ll email you a secure link so you can sign in without a password.
        </p>
      </form>
    </div>
  );
}
