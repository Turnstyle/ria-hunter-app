import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabaseAdmin'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const crd = params.id
    if (!crd) {
      return NextResponse.json({ error: 'Missing CRD number' }, { status: 400, headers: CORS_HEADERS })
    }

    // Get core profile data from advisers table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('advisers')
      .select('*')
      .eq('crd_number', crd)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Get executives from control_persons table
    const { data: executives } = await supabaseAdmin
      .from('control_persons')
      .select('person_name as name, title')
      .eq('crd_number', crd)
      .order('person_name')

    // Get filings from filings table
    let filings = []
    try {
      const { data: filingData } = await supabaseAdmin
        .from('filings')
        .select('*')
        .eq('crd_number', crd)
        .order('filing_date', { ascending: false })
        .limit(10)
      filings = filingData || []
    } catch (e) {
      console.log('Filings table not available:', e)
    }

    // Get private funds from private_funds table
    let privateFunds = []
    try {
      const { data: fundData } = await supabaseAdmin
        .from('private_funds')
        .select('*')
        .eq('crd_number', crd)
        .limit(20)
      privateFunds = fundData || []
    } catch (e) {
      console.log('Private funds table not available:', e)
    }

    // Return comprehensive profile data
    const result = {
      cik: profile.cik,
      crd_number: profile.crd_number,
      legal_name: profile.legal_name,
      main_addr_street1: profile.main_addr_street1,
      main_addr_street2: profile.main_addr_street2,
      main_addr_city: profile.main_addr_city,
      main_addr_state: profile.main_addr_state,
      main_addr_zip: profile.main_addr_zip,
      main_addr_country: profile.main_addr_country,
      phone_number: profile.phone_number,
      fax_number: profile.fax_number,
      website: profile.website,
      executives: executives || [],
      filings: filings.map(f => ({
        filing_id: f.id,
        filing_date: f.filing_date,
        total_aum: f.total_aum,
        manages_private_funds_flag: f.manages_private_funds_flag
      })),
      private_funds: privateFunds.map(pf => ({
        fund_id: pf.id,
        fund_name: pf.fund_name,
        fund_type: pf.fund_type,
        gross_asset_value: pf.gross_asset_value,
        min_investment: pf.min_investment
      }))
    }

    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
