// app/api/funds/summary/[id]/route.ts
// API endpoint for getting fund summary data for an RIA
// Provides fund type breakdown and summary information

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Generate realistic mock fund summary data
    const fundTypes = [
      { type: 'Hedge Fund', type_short: 'HF' },
      { type: 'Private Equity Fund', type_short: 'PE' },
      { type: 'Venture Capital Fund', type_short: 'VC' },
      { type: 'Real Estate Fund', type_short: 'RE' },
      { type: 'Other Private Fund', type_short: 'Other' }
    ];
    
    // Randomly select 1-3 fund types for this RIA
    const numTypes = Math.floor(Math.random() * 3) + 1;
    const selectedTypes = fundTypes
      .sort(() => Math.random() - 0.5)
      .slice(0, numTypes)
      .map(type => ({
        ...type,
        count: Math.floor(Math.random() * 5) + 1
      }));
    
    const mockResponse = {
      summary: selectedTypes,
      funds: [],
      marketers: [],
      metadata: {
        crd_number: id,
        total_funds: selectedTypes.reduce((sum, type) => sum + type.count, 0),
        last_updated: new Date().toISOString()
      }
    };
    
    return NextResponse.json(mockResponse);
    
  } catch (error) {
    console.error('Error fetching funds summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
