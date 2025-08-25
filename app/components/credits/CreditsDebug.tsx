'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/app/lib/api/client';

export default function CreditsDebug() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await apiClient.getCreditsDebug();
        setDebugData(data);
      } catch (err) {
        console.error('Error fetching credits debug data:', err);
        setError('Failed to load credits debug data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDebugData();
  }, []);
  
  if (loading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Credits Ledger Debug</h2>
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 border rounded bg-red-50">
        <h2 className="text-lg font-semibold mb-4">Credits Ledger Debug</h2>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }
  
  if (!debugData) {
    return (
      <div className="p-4 border rounded bg-yellow-50">
        <h2 className="text-lg font-semibold mb-4">Credits Ledger Debug</h2>
        <div className="text-yellow-700">No debug data available. You may need to be authenticated.</div>
      </div>
    );
  }
  
  return (
    <div className="p-4 border rounded bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">Credits Ledger Debug</h2>
      
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">User Information</h3>
        <div className="bg-white p-3 rounded border">
          <div><span className="font-semibold">User ID:</span> {debugData.userId}</div>
          <div><span className="font-semibold">Current Credits:</span> {debugData.credits || debugData.balance} credits</div>
          <div><span className="font-semibold">Subscriber:</span> {debugData.isSubscriber ? 'Yes' : 'No'}</div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">Ledger Entries (Last 20)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border text-left">Date</th>
                <th className="py-2 px-4 border text-left">Source</th>
                <th className="py-2 px-4 border text-left">Type</th>
                <th className="py-2 px-4 border text-right">Amount</th>
                <th className="py-2 px-4 border text-left">Reference</th>
              </tr>
            </thead>
            <tbody>
              {debugData.ledgerEntries.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 border">{entry.source}</td>
                  <td className="py-2 px-4 border">{entry.refType}</td>
                  <td className={`py-2 px-4 border text-right ${entry.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta}
                  </td>
                  <td className="py-2 px-4 border">
                    <span className="truncate block max-w-xs" title={entry.refId}>
                      {entry.refId.substring(0, 20)}
                      {entry.refId.length > 20 ? '...' : ''}
                    </span>
                  </td>
                </tr>
              ))}
              {debugData.ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">
                    No ledger entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">Stripe Events (Last 50)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border text-left">Date</th>
                <th className="py-2 px-4 border text-left">Event Type</th>
                <th className="py-2 px-4 border text-left">Status</th>
                <th className="py-2 px-4 border text-left">Event ID</th>
              </tr>
            </thead>
            <tbody>
              {debugData.stripeEvents.map((event: any) => (
                <tr key={event.eventId} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">
                    {new Date(event.receivedAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 border">{event.type}</td>
                  <td className={`py-2 px-4 border ${
                    event.processedOk === true ? 'text-green-600' : 
                    event.processedOk === false ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {event.processedOk === true ? 'Processed' : 
                     event.processedOk === false ? 'Failed' : 'Pending'}
                    {event.error && 
                      <span className="block text-xs text-red-500" title={event.error}>
                        {event.error.substring(0, 30)}
                        {event.error.length > 30 ? '...' : ''}
                      </span>
                    }
                  </td>
                  <td className="py-2 px-4 border">
                    <span className="truncate block max-w-xs" title={event.eventId}>
                      {event.eventId.substring(0, 20)}
                      {event.eventId.length > 20 ? '...' : ''}
                    </span>
                  </td>
                </tr>
              ))}
              {debugData.stripeEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">
                    No Stripe events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
