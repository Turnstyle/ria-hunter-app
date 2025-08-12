import React, { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface SearchFormProps {
  onResult?: (result: any) => void;
  onError?: (error: string, query: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onResult, onError }) => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user, session, signInWithGoogle } = useAuth();
  const [aiProvider, setAiProvider] = useState<'openai' | 'vertex'>('openai');
  const [limit, setLimit] = useState<number>(10);
  const [showMaxResultsPopover, setShowMaxResultsPopover] = useState<boolean>(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [queryCount, setQueryCount] = useState<number>(0);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  const getKey = (base: string) => {
    const suffix = user?.id ? `:${user.id}` : ':anon';
    return `${base}${suffix}`;
  };

  useEffect(() => {
    const savedQueryCount = localStorage.getItem(getKey('ria-hunter-query-count'));
    const savedShareStatus = localStorage.getItem(getKey('ria-hunter-linkedin-shared'));
    
    if (savedQueryCount) {
      setQueryCount(parseInt(savedQueryCount));
    }
    if (savedShareStatus === 'true') {
      setHasSharedOnLinkedIn(true);
    }
  }, [user?.id]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'true' && session) {
      window.history.replaceState({}, '', window.location.pathname);
      handleAccountCreation();
    }
  }, [session]);

  const toggleAiProvider = () => {
    setAiProvider((aiProvider === 'openai' ? 'vertex' : 'openai'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!query.trim()) return;

    if (!session) {
      const signupBonusAwarded = localStorage.getItem(getKey('ria-hunter-signup-bonus'));
      const baseCredits = 2;
      const linkedInBonus = hasSharedOnLinkedIn ? 1 : 0;
      const signupBonus = signupBonusAwarded === 'true' ? 2 : 0;
      const maxFreeQueries = baseCredits + linkedInBonus + signupBonus;
      
      if (queryCount >= maxFreeQueries) {
        setShowAccountModal(true);
        return;
      }
    }
    
    setIsLoading(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const apiBase = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
      if (!apiBase) {
        throw new Error('Search service not configured');
      }

      const response = await fetch(`${apiBase}/api/v1/ria/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            alert('Please sign in to continue');
          }
          return;
        }
        if (response.status === 402 || errorData?.code === 'PAYMENT_REQUIRED') {
          setShowAccountModal(true);
          return;
        }
        throw new Error(errorData?.error || 'Search failed');
      }

      const data = await response.json();

      let normalized = data;
      if (!data.answer || !Array.isArray(data.sources)) {
        normalized = { answer: '', sources: [], results: data.results || data.data || [], meta: data.meta };
      }

      setQueryCount((prev) => {
        const newQueryCount = prev + 1;
        localStorage.setItem(getKey('ria-hunter-query-count'), String(newQueryCount));
        if (newQueryCount === 2 && !hasSharedOnLinkedIn) {
          setTimeout(() => setShowLinkedInModal(true), 1000);
        }
        return newQueryCount;
      });

      onResult?.(normalized);
    } catch (e: any) {
      onError?.(e?.message || 'Search failed', query);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkedInShare = async () => {
    const shareText = encodeURIComponent("Just discovered this RIA Hunter app - it's incredible for researching investment advisors! The AI-powered search is a game-changer for finding RIAs. Check it out! #vibecoding");
    const shareUrl = encodeURIComponent(window.location.origin);
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&text=${shareText}`;
    
    const popup = window.open(linkedInUrl, '_blank', 'width=600,height=600');
    
    try {
      if (session?.access_token) {
        await fetch('/api/redeem-share', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch {}

    setHasSharedOnLinkedIn(true);
    localStorage.setItem(getKey('ria-hunter-linkedin-shared'), 'true');
    setShowLinkedInModal(false);
  };

  return null;
};

export default SearchForm;
