import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ChatMessage, Source } from '@/lib/types';

function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <Link
      href={`/profile/${source.crd_number}`}
      className="block p-3 mb-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all"
    >
      <div className="font-bold text-sm text-blue-600">
        <span className="inline-block w-5 text-center mr-2 bg-gray-200 rounded-full text-xs py-0.5">
          {index + 1}
        </span>
        {source.legal_name}
      </div>
      <div className="text-xs text-gray-500 pl-7">
        {source.city}, {source.state}
      </div>
    </Link>
  );
}

export default function AssistantMessage({ message }: { message: ChatMessage }) {
  if (message.isLoading) {
    return (
      <div className="flex items-center">
        <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    <div className="prose prose-sm max-w-none">
      <p>{message.content}</p>
      {message.sources && message.sources.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sources</h4>
          {message.sources.map((source, i) => (
            <SourceCard key={`${source.crd_number}-${i}`} source={source} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
