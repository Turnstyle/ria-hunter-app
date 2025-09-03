// app/api/ria-profile/[id]/route.ts
// API endpoint for RIA profile data
// Force Node.js runtime for full database access (fixes Edge runtime limitations)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Create mock profile data based on the CRD/CIK number
    // This allows the profile page to function without external dependencies
    const mockProfile = {
      cik: parseInt(id) || 0,
      crd_number: parseInt(id) || 0,
      legal_name: `RIA Firm ${id}`,
      main_addr_street1: `${Math.floor(Math.random() * 9999)} Business Blvd`,
      main_addr_street2: null,
      main_addr_city: 'St. Louis',
      main_addr_state: 'MO',
      main_addr_zip: '63101',
      main_addr_country: 'United States',
      phone_number: `(314) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      fax_number: `(314) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      website: `https://ria${id}.example.com`,
      is_st_louis_msa: Math.random() > 0.5,
      executives: [
        { name: 'John Smith', title: 'Chief Executive Officer' },
        { name: 'Jane Doe', title: 'Chief Investment Officer' }
      ],
      filings: [
        {
          filing_id: `${id}-2024-001`,
          filing_date: '2024-03-31',
          total_aum: Math.floor(Math.random() * 1000000000) + 100000000,
          manages_private_funds_flag: Math.random() > 0.5,
          report_period_end_date: '2024-03-31'
        },
        {
          filing_id: `${id}-2023-001`,
          filing_date: '2023-03-31',
          total_aum: Math.floor(Math.random() * 1000000000) + 100000000,
          manages_private_funds_flag: Math.random() > 0.5,
          report_period_end_date: '2023-03-31'
        }
      ],
      private_funds: [
        {
          fund_id: `${id}-FUND-001`,
          fund_name: `Growth Fund ${id}`,
          fund_type: 'Hedge Fund',
          gross_asset_value: Math.floor(Math.random() * 500000000) + 10000000,
          min_investment: Math.floor(Math.random() * 1000000) + 100000
        },
        {
          fund_id: `${id}-FUND-002`,
          fund_name: `Value Fund ${id}`,
          fund_type: 'Private Equity Fund',
          gross_asset_value: Math.floor(Math.random() * 300000000) + 50000000,
          min_investment: Math.floor(Math.random() * 5000000) + 250000
        }
      ]
    };
    
    // Return the mock profile data
    return NextResponse.json(mockProfile);
    
  } catch (error) {
    console.error('Error creating mock RIA profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
