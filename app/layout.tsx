import type { Metadata } from "next";
import { AuthProvider } from '@/app/contexts/AuthContext';
import { Header } from '@/app/components/layout/Header';
import "./globals.css";

export const metadata: Metadata = {
  title: "RIA Hunter - Investment Advisor Intelligence",
  description: "Search and analyze Registered Investment Advisors using AI-powered natural language queries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <AuthProvider>
        <body className="bg-gray-50 min-h-screen">
          <Header />
          <main className="flex-1">
            {children}
          </main>
        </body>
      </AuthProvider>
    </html>
  );
}
