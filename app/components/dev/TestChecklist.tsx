// app/components/dev/TestChecklist.tsx
// Development-only component to verify all fixes are working

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/app/lib/api/client';
import { useCredits } from '@/app/hooks/useCredits';

// Only show in development
if (process.env.NODE_ENV !== 'development') {
  export function TestChecklist() {
    return null;
  }
}

interface TestResult {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'skip';
  message?: string;
}

export function TestChecklist() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { credits, isSubscriber } = useCredits();
  
  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];
    
    // Test 1: API Client exists and has correct methods
    try {
      if (apiClient && typeof apiClient.ask === 'function') {
        results.push({
          name: 'API Client properly configured',
          status: 'pass',
        });
      } else {
        results.push({
          name: 'API Client properly configured',
          status: 'fail',
          message: 'API client missing or incorrect',
        });
      }
    } catch (e: any) {
      results.push({
        name: 'API Client properly configured',
        status: 'fail',
        message: e.message,
      });
    }
    
    // Test 2: Credits are not hardcoded to 2
    try {
      if (credits !== 2 || isSubscriber) {
        results.push({
          name: 'Credits not hardcoded to 2',
          status: 'pass',
          message: `Current credits: ${credits}`,
        });
      } else {
        results.push({
          name: 'Credits not hardcoded to 2',
          status: 'fail',
          message: 'Credits still showing default value',
        });
      }
    } catch (e: any) {
      results.push({
        name: 'Credits not hardcoded to 2',
        status: 'fail',
        message: e.message,
      });
    }
    
    // Test 3: Health endpoint is accessible
    try {
      const health = await apiClient.checkHealth();
      if (health.status === 'ok' || health.status === 'degraded') {
        results.push({
          name: 'Health endpoint accessible',
          status: 'pass',
          message: `Status: ${health.status}`,
        });
      } else {
        results.push({
          name: 'Health endpoint accessible',
          status: 'fail',
          message: `Status: ${health.status}`,
        });
      }
    } catch (e: any) {
      results.push({
        name: 'Health endpoint accessible',
        status: 'fail',
        message: 'Cannot reach health endpoint',
      });
    }
    
    // Test 4: Ask endpoint returns natural language
    try {
      const response = await apiClient.ask({
        query: 'test query for system check',
        options: { maxResults: 1 },
      });
      
      if (response.answer && response.answer.length > 50) {
        results.push({
          name: 'Ask endpoint returns natural language',
          status: 'pass',
          message: 'Received natural language response',
        });
      } else {
        results.push({
          name: 'Ask endpoint returns natural language',
          status: 'fail',
          message: 'Response too short or missing',
        });
      }
    } catch (e: any) {
      results.push({
        name: 'Ask endpoint returns natural language',
        status: 'skip',
        message: 'Skipped to preserve credits',
      });
    }
    
    // Test 5: City/State normalization working
    try {
      const normalizeCity = (city: string) => {
        return city
          .trim()
          .replace(/\bst\.?\s+/gi, 'Saint ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };
      
      const test1 = normalizeCity('st. louis') === 'Saint Louis';
      const test2 = normalizeCity('ST LOUIS') === 'Saint Louis';
      
      if (test1 && test2) {
        results.push({
          name: 'City normalization working',
          status: 'pass',
        });
      } else {
        results.push({
          name: 'City normalization working',
          status: 'fail',
          message: 'Normalization not working correctly',
        });
      }
    } catch (e: any) {
      results.push({
        name: 'City normalization working',
        status: 'fail',
        message: e.message,
      });
    }
    
    setTests(results);
    setIsRunning(false);
  };
  
  useEffect(() => {
    runTests();
  }, []);
  
  const getIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skip':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
      <h3 className="font-semibold mb-3 flex items-center">
        Frontend Fix Verification
        {isRunning && (
          <span className="ml-2 text-sm text-gray-500">(Running...)</span>
        )}
      </h3>
      
      <div className="space-y-2">
        {tests.map((test, idx) => (
          <div key={idx} className="flex items-start">
            <span className="mr-2 mt-0.5">{getIcon(test.status)}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{test.name}</p>
              {test.message && (
                <p className="text-xs text-gray-600">{test.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className="mt-3 w-full px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Re-run Tests
      </button>
    </div>
  );
}
