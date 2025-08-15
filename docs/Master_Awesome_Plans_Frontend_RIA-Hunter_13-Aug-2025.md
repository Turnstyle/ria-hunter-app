# **Master Awesome Plan: ria-hunter-app (Frontend Agent) \- Detailed**

## **1\. Executive Summary & Guiding Principles**

**The Core Mandate:** Your primary mission is to transform the user interface from a static data display into a dynamic, **conversational AI experience**. You will connect to a new, powerful backend API to deliver natural language answers, build user trust through verifiable sources, and create a fluid, modern chat interface.

**The Unified Strategy:**

1. **Integrate, Don't Rebuild:** Continue using the existing frontend stack (Next.js, React, Tailwind CSS). Your focus is on consuming the new backend capabilities, not on a costly rewrite.  
2. **Conversational UX is Key:** The goal is to make the app *feel* like a modern AI chatbot. This is achieved through a clean chat input, immediate visual feedback (loading states), and clear presentation of information.  
3. **Trust Through Transparency:** Every piece of data presented in a natural language answer must be traceable back to a verifiable source. Your implementation of interactive citations is the most critical feature for establishing user trust.

## **2\. Dependencies, Tooling & Agent Capabilities**

This section outlines the tools, libraries, and protocols available to you.

### **Core Dependencies**

* **react & react-dom**: The core library for building the user interface.  
* **next**: The React framework for production.  
* **tailwindcss**: A utility-first CSS framework for styling.  
* **lucide-react**: For beautiful and consistent icons.  
* **uuid & @types/uuid**: To generate unique IDs for chat messages.

### **Platform & Services**

* **Vercel**: The hosting platform for the Next.js application.

### **Agent Capabilities & Protocols**

* **Github MCP (Model Context Protocol)**: You have access to the project's codebase via the Github MCP. Use this to read existing files, understand component structure, and write new code.  
* **Vercel CLI**: You can use the vercel CLI to check deployment status (vercel list) and view production logs (vercel logs ria-hunter-app \--prod) to troubleshoot any frontend-specific issues that arise after deployment.

## **3\. The Critical Path to MVP: A Phased Implementation**

### **Phase 1: Connect to the New Conversational API (Target: Week 1\)**

**Action 1.1: Define API Data Structures**

* **Task:** Define the shape of the API data in TypeScript to prevent bugs.  
* **File:** lib/types.ts  
  export interface Executive { name: string; title: string; }  
  export interface Source {  
    crd\_number: number;  
    legal\_name: string;  
    city: string;  
    state: string;  
    executives: Executive\[\];  
    vc\_fund\_count: number;  
    vc\_total\_aum: number;  
    activity\_score: number;  
  }  
  export interface ApiResponse {  
    answer: string;  
    sources: Source\[\];  
    metadata?: { plan?: any; };  
  }  
  export interface ChatMessage {  
    id: string;  
    role: 'user' | 'assistant';  
    content: string;  
    sources?: Source\[\];  
    isLoading?: boolean;  
  }

* **Documentation:** [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

**Action 1.2: Create a Reusable API Hook**

* **Task:** Centralize all API communication logic into a custom React hook.  
* **File:** hooks/useApi.ts  
  import { useState } from 'react';  
  import { ApiResponse } from '@/lib/types';

  export function useAskApi() {  
    const \[isLoading, setIsLoading\] \= useState(false);  
    const \[error, setError\] \= useState\<string | null\>(null);

    const askQuestion \= async (query: string): Promise\<ApiResponse | null\> \=\> {  
      setIsLoading(true);  
      setError(null);  
      try {  
        const response \= await fetch('/api/ask', {  
          method: 'POST',  
          headers: { 'Content-Type': 'application/json' },  
          body: JSON.stringify({ query }),  
        });  
        if (\!response.ok) throw new Error(\`API Error: ${response.statusText}\`);  
        return await response.json();  
      } catch (e: any) {  
        setError(e.message);  
        return null;  
      } finally {  
        setIsLoading(false);  
      }  
    };  
    return { isLoading, error, askQuestion };  
  }

* **Documentation:** [React: Building Your Own Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks), [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

**Action 1.3: Integrate Hook into the Main Chat Component**

* **Task:** Manage the conversation state and message flow.  
* **File:** components/ChatInterface.tsx  
  'use client';  
  import { useState } from 'react';  
  import { ChatMessage } from '@/lib/types';  
  import { useAskApi } from '@/hooks/useApi';  
  import { v4 as uuidv4 } from 'uuid';

  export default function ChatInterface() {  
    const \[messages, setMessages\] \= useState\<ChatMessage\[\]\>(\[\]);  
    const { isLoading, error, askQuestion } \= useAskApi();

    const handleSendMessage \= async (query: string) \=\> {  
      if (\!query.trim() || isLoading) return;  
      const userMessage: ChatMessage \= { id: uuidv4(), role: 'user', content: query };  
      const assistantPlaceholder: ChatMessage \= { id: uuidv4(), role: 'assistant', content: '', isLoading: true };  
      setMessages(prev \=\> \[...prev, userMessage, assistantPlaceholder\]);

      const apiResponse \= await askQuestion(query);  
      const finalMessage: ChatMessage \= {  
        id: assistantPlaceholder.id,  
        role: 'assistant',  
        content: apiResponse?.answer || "Sorry, I encountered an error.",  
        sources: apiResponse?.sources || \[\],  
        isLoading: false,  
      };  
      setMessages(prev \=\> prev.map(msg \=\> msg.id \=== finalMessage.id ? finalMessage : msg));  
    };  
    // ... rest of component: input bar, message rendering loop ...  
  }

* **Documentation:** [Next.js: Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

### **Phase 2: Build a Trustworthy & Modern UX (Target: Week 2\)**

**Action 2.1: Create the AssistantMessage Component with Citations**

* **Task:** Render the AI's response and the crucial interactive source cards.  
* **File:** components/AssistantMessage.tsx  
  import { ChatMessage, Source } from '@/lib/types';  
  import Link from 'next/link';  
  import { Loader2 } from 'lucide-react';

  const SourceCard \= ({ source, index }: { source: Source, index: number }) \=\> (  
    \<Link href={\`/profile/${source.crd\_number}\`} className="block p-3 mb-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all"\>  
      \<div className="font-bold text-sm text-blue-600"\>  
        \<span className="inline-block w-5 text-center mr-2 bg-gray-200 rounded-full text-xs py-0.5"\>{index \+ 1}\</span\>  
        {source.legal\_name}  
      \</div\>  
      \<div className="text-xs text-gray-500 pl-7"\>{source.city}, {source.state}\</div\>  
    \</Link\>  
  );

  export default function AssistantMessage({ message }: { message: ChatMessage }) {  
    if (message.isLoading) {  
      return \<div className="flex items-center"\>\<Loader2 className="animate-spin h-5 w-5 text-gray-400" /\>\</div\>;  
    }  
    return (  
      \<div className="prose prose-sm max-w-none"\>  
        \<p\>{message.content}\</p\>  
        {message.sources && message.sources.length \> 0 && (  
          \<div className="mt-4"\>  
            \<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider"\>Sources\</h4\>  
            {message.sources.map((source, i) \=\> \<SourceCard key={source.crd\_number} source={source} index={i} /\>)}  
          \</div\>  
        )}  
      \</div\>  
    );  
  }

* **Documentation:** [Next.js \<Link\> Component](https://www.google.com/search?q=%5Bhttps://nextjs.org/docs/app/api-reference/components/link%5D\(https://nextjs.org/docs/app/api-reference/components/link\)), [Tailwind CSS Documentation](https://tailwindcss.com/docs)

**Action 2.2: Implement Smart Query Suggestions**

* **Task:** Guide users with clickable example questions. This component will be displayed when the message list is empty.

## **4\. Post-MVP Roadmap & Architecture**

1. **Activate Streaming:** This is the highest priority for improving the "AI feel."  
   * **Task:** Implement a useAskApiStream hook using the EventSource API to listen to a new /api/ask-stream backend endpoint. The hook will accept an onData callback to stream tokens directly into the AssistantMessage component's state.  
   * **Documentation:** [MDN: EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)  
2. **Offer User Controls:**  
   * **Task:** Add UI controls (dropdowns, sliders) to let users adjust search parameters like ranking\_metric and limit, passing these values to the backend API.  
3. **Rich Data Visualization:**  
   * **Task:** When the API response warrants it, display a "View Chart" button that renders a component using a library like Recharts to visualize the data in the sources array.  
   * **Documentation:** [Recharts Library](https://recharts.org/)