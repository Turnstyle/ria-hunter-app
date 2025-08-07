import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Zod schema for the profile response
const profileResponseSchema = z.object({
  cik: z.number(),
  crd_number: z.number().nullable(),
  legal_name: z.string(),
  main_addr_street1: z.string().nullable(),
  main_addr_street2: z.string().nullable(),
  main_addr_city: z.string().nullable(),
  main_addr_state: z.string().nullable(),
  main_addr_zip: z.string().nullable(),
  main_addr_country: z.string().nullable(),
  phone_number: z.string().nullable(),
  fax_number: z.string().nullable(),
  website: z.string().nullable(),
  is_st_louis_msa: z.boolean().nullable(),
  filings: z.array(z.object({
    filing_id: z.string(),
    filing_date: z.string(),
    total_aum: z.number().nullable(),
    manages_private_funds_flag: z.boolean().nullable(),
    report_period_end_date: z.string().nullable(),
    form_type: z.string().nullable(),
  })),
  private_funds: z.array(z.object({
    fund_id: z.string(),
    fund_name: z.string(),
    fund_type: z.string().nullable(),
    gross_asset_value: z.number().nullable(),
    min_investment: z.number().nullable(),
    auditor_name: z.string().nullable(),
    auditor_location: z.string().nullable(),
  })),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const resolvedParams = await params;
    const cik = parseInt(resolvedParams.cik);

    if (isNaN(cik)) {
      return NextResponse.json({ error: 'Invalid CIK provided' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Fetch adviser basic info
    const { data: adviser, error: adviserError } = await supabase
      .from('advisers')
      .select('*')
      .eq('cik', cik)
      .single();

    if (adviserError || !adviser) {
      console.error('Adviser not found:', adviserError);
      return NextResponse.json({ error: 'RIA profile not found' }, { status: 404 });
    }

    // Fetch filings for this adviser using adviser.id
    const { data: filings, error: filingsError } = await supabase
      .from('filings')
      .select(`
        id as filing_id,
        filing_date,
        total_aum,
        private_fund_count,
        report_period_end_date
      `)
      .eq('adviser_id', adviser.id)
      .order('filing_date', { ascending: false })
      .limit(10);

    if (filingsError) {
      console.error('Error fetching filings:', filingsError);
      Sentry.captureException(filingsError);
    }

    // Fetch private funds for this adviser using filing IDs
    let privateFunds: any[] = [];
    if (filings && filings.length > 0) {
      const fillingIds = filings.map(f => f.filing_id);
      const { data: privateFundsData, error: privateFundsError } = await supabase
        .from('private_funds')
        .select(`
          id as fund_id,
          fund_name,
          fund_type,
          gross_asset_value
        `)
        .in('filing_id', fillingIds)
        .limit(20);
      
      privateFunds = privateFundsData || [];
      if (privateFundsError) {
        console.error('Error fetching private funds:', privateFundsError);
        Sentry.captureException(privateFundsError);
      }
    }



    // Transform data to match expected format
    const profileData = {
      cik: adviser.cik,
      crd_number: null, // Not available in current schema
      legal_name: adviser.legal_name,
      main_addr_street1: adviser.main_office_location?.street || null,
      main_addr_street2: null,
      main_addr_city: adviser.main_office_location?.city || null,
      main_addr_state: adviser.main_office_location?.state || null,
      main_addr_zip: adviser.main_office_location?.zipcode || null,
      main_addr_country: adviser.main_office_location?.country || null,
      phone_number: null,
      fax_number: null,
      website: null,
      is_st_louis_msa: null,
      filings: (filings || []).map(f => ({
        filing_id: f.filing_id.toString(),
        filing_date: f.filing_date,
        total_aum: f.total_aum,
        manages_private_funds_flag: f.private_fund_count > 0,
        report_period_end_date: f.report_period_end_date,
        form_type: null
      })),
      private_funds: privateFunds.map(pf => ({
        fund_id: pf.fund_id.toString(),
        fund_name: pf.fund_name,
        fund_type: pf.fund_type,
        gross_asset_value: pf.gross_asset_value,
        min_investment: null,
        auditor_name: null,
        auditor_location: null
      }))
    };

    // Validate response
    const validationResult = profileResponseSchema.safeParse(profileData);
    if (!validationResult.success) {
      console.error('Profile response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Profile response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: profileData },
      });
      return NextResponse.json(
        {
          error: 'Invalid profile data structure',
          details: validationResult.error.issues,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in /api/ria-hunter/profile/[cik] GET:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
