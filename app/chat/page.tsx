import ChatInterface from '@/components/ChatInterface';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">RIA Hunter Chat</h1>
        <ChatInterface />
      </div>
    </div>
  );
}
