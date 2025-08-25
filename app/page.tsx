import ChatInterface from './components/ChatInterface';

export default function RIAHunterHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ChatInterface />
      </div>
    </div>
  );
}
