// app/components/MarkdownResponse.tsx
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Link from 'next/link';

interface RIAData {
  crd_number: string;
  firm_name?: string;
  legal_name?: string;
}

interface MarkdownResponseProps {
  content: string;
  sources?: Array<{ 
    title?: string; 
    url?: string; 
    crd?: string;
    crd_number?: string;
    firm_name?: string;
    legal_name?: string;
  }>;
}

// Utility function to detect RIA mentions and create profile links
function enhanceTextWithRIALinks(text: string, sources?: Array<any>): string {
  if (!sources || sources.length === 0) return text;
  
  let enhancedText = text;
  
  // Create a map of RIA names to CRD numbers from sources
  const riaMap = new Map<string, string>();
  sources.forEach(source => {
    const crdNumber = source.crd || source.crd_number;
    const firmName = source.firm_name || source.legal_name || source.title;
    if (crdNumber && firmName) {
      riaMap.set(firmName, crdNumber);
    }
  });
  
  // Replace RIA firm names with markdown links
  riaMap.forEach((crdNumber, firmName) => {
    // Create a case-insensitive regex to match the firm name
    const regex = new RegExp(`\\b${firmName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const replacement = `[${firmName}](/profile/${crdNumber})`;
    enhancedText = enhancedText.replace(regex, replacement);
  });
  
  return enhancedText;
}

export default function MarkdownResponse({ content, sources }: MarkdownResponseProps) {
  // Enhance the content with RIA profile links
  const enhancedContent = enhanceTextWithRIALinks(content, sources);

  return (
    <div className="prose prose-sm max-w-none prose-blue">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom link component to use Next.js Link for internal links
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('/profile/')) {
              return (
                <Link
                  href={href}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                  {...props}
                >
                  {children}
                </Link>
              );
            }
            // External links
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Style headings
          h1: ({ children, ...props }) => (
            <h1 className="text-xl font-bold text-gray-900 mb-2" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-lg font-semibold text-gray-900 mb-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-base font-medium text-gray-900 mb-1" {...props}>
              {children}
            </h3>
          ),
          // Style lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside mb-2 space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>
              {children}
            </ol>
          ),
          // Style paragraphs
          p: ({ children, ...props }) => (
            <p className="mb-2 text-gray-800 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Style strong/bold text
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props}>
              {children}
            </strong>
          ),
          // Style emphasis/italic text
          em: ({ children, ...props }) => (
            <em className="italic text-gray-800" {...props}>
              {children}
            </em>
          ),
          // Style code blocks
          code: ({ children, className, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block bg-gray-100 text-gray-800 p-3 rounded text-sm font-mono overflow-x-auto ${className}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Style blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-300 pl-4 italic text-gray-700 my-2"
              {...props}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {enhancedContent}
      </ReactMarkdown>
    </div>
  );
}
