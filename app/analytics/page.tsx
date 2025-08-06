'use client';

import React from 'react';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RIA Analytics</h1>
          <p className="text-lg text-gray-600">Industry insights and trends from RIA data</p>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-8 mb-8 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 00-2 2v6a2 2 0 00-2 2" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard Coming Soon</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We&apos;re building comprehensive analytics to help you understand RIA trends, geographic distributions, 
            AUM patterns, and market insights. Stay tuned for powerful data visualizations and industry analysis.
          </p>
        </div>

        {/* Preview Cards - What's Coming */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Market Overview */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Market Overview</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Track total industry AUM, number of registered advisors, growth trends, and market concentration metrics.
            </p>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Geographic Insights</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Interactive maps showing RIA density by state and city, regional AUM distribution, and growth hotspots.
            </p>
          </div>

          {/* AUM Analysis */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">AUM Analytics</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Assets under management distributions, size categories, growth patterns, and performance benchmarks.
            </p>
          </div>

          {/* Private Funds Trends */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4M4 10h16m-8 4l8 4-8 4V14z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Private Funds</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Analysis of RIAs managing private funds, alternative investment trends, and regulatory patterns.
            </p>
          </div>

          {/* Regulatory Filings */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Filing Patterns</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Track filing frequency, compliance trends, form ADV changes, and regulatory updates timeline.
            </p>
          </div>

          {/* Custom Reports */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Custom Reports</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Generate custom analytics reports, export data, schedule regular insights, and create personalized dashboards.
            </p>
          </div>
        </div>

        {/* Contact/Feedback Section */}
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Help Shape Our Analytics</h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            What specific analytics and insights would be most valuable for your RIA research? 
            We&apos;re building this dashboard based on user needs and would love your input.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl">
              Request Analytics Features
            </button>
            <button className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200/50 transition-all">
              Get Notified When Ready
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}