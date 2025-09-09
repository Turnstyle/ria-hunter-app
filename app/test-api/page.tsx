'use client';

import { useState } from 'react';

export default function TestAPIPage() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState('test query');
  
  if (process.env.NODE_ENV !== 'development') {
    return <div className="p-8">This page is only available in development mode</div>;
  }
  
  const testEndpoint = async (endpoint: string, method: string, body?: any) => {
    const baseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL || '';
    const url = `${baseUrl}${endpoint}`;
    
    try {
      console.log(`Testing ${method} ${url}`, body);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': method === 'POST' && endpoint.includes('stream') 
            ? 'text/event-stream' 
            : 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
      
      let responseBody;
      if (response.headers.get('content-type')?.includes('json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
      
      const result = {
        endpoint,
        method,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };
      
      setResults(prev => [result, ...prev]);
    } catch (error) {
      const errorResult = {
        endpoint,
        method,
        error: error instanceof Error ? error.message : String(error),
      };
      
      setResults(prev => [errorResult, ...prev]);
    }
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Endpoint Tester</h1>
      <p className="mb-4 text-gray-600">
        Use this page to test API endpoints during development. This helps troubleshoot 405 method errors and other issues.
      </p>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Query text for test requests:
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Health Checks</h2>
          <button
            onClick={() => testEndpoint('/api/health', 'GET')}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Test Health (GET)
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Ask API Tests (Consolidated Endpoint)</h2>
          <button
            onClick={() => testEndpoint('/api/ask', 'POST', { query, streaming: false })}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Test Ask (Non-Streaming) - Should Work
          </button>
          
          <button
            onClick={() => testEndpoint('/api/ask', 'POST', { query, streaming: true })}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Test Ask (Streaming) - Should Work
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Credits & Subscription</h2>
          <button
            onClick={() => testEndpoint('/api/subscription-status', 'GET')}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
            Test Subscription Status
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Clear Results</h2>
          <button
            onClick={() => setResults([])}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Clear Results
          </button>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Results:</h2>
        {results.length === 0 ? (
          <p className="text-gray-500">No test results yet. Click a button above to test an endpoint.</p>
        ) : (
          results.map((result, index) => (
            <div key={index} className="mb-6 p-4 bg-gray-100 rounded-lg overflow-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">
                  {result.method} {result.endpoint}
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  result.error ? 'bg-red-200 text-red-800' :
                  result.status < 300 ? 'bg-green-200 text-green-800' :
                  result.status < 400 ? 'bg-yellow-200 text-yellow-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {result.error ? 'Error' : `${result.status} ${result.statusText}`}
                </span>
              </div>
              
              {result.error ? (
                <div className="text-red-600 font-mono whitespace-pre-wrap">{result.error}</div>
              ) : (
                <>
                  {result.headers && (
                    <div className="mb-2">
                      <h4 className="font-semibold">Headers:</h4>
                      <pre className="bg-gray-200 p-2 rounded overflow-x-auto text-sm">
                        {JSON.stringify(result.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-semibold">Response:</h4>
                    <pre className="bg-gray-200 p-2 rounded overflow-x-auto text-sm">
                      {typeof result.body === 'string' 
                        ? result.body.substring(0, 500) + (result.body.length > 500 ? '...' : '')
                        : JSON.stringify(result.body, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
