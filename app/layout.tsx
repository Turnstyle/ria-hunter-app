/** @jsxRuntime classic */
/** @jsx React.createElement */

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from '@/app/contexts/AuthContext';
import { Header } from '@/app/components/layout/Header';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { DebugOverlay } from '@/app/components/DebugOverlay';
import React from 'react';
import "./globals.css";

export const metadata: Metadata = {
  title: "RIA Hunter - Investment Advisor Intelligence",
  description: "Search and analyze Registered Investment Advisors using AI-powered natural language queries",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' }
    ],
    apple: '/favicon.svg',
  },
  openGraph: {
    title: "RIA Hunter - Investment Advisor Intelligence",
    description: "Search and analyze Registered Investment Advisors using AI-powered natural language queries",
    url: "https://ria-hunter.app",
    siteName: "RIA Hunter",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-gray-50 min-h-screen overflow-x-hidden">
        <ErrorBoundary>
          <AuthProvider>
            <Header />
            <main className="flex-1 min-h-screen pt-16">
              {children}
            </main>
            <DebugOverlay />
            <Analytics />
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
