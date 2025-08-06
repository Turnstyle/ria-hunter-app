import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

// Define Zod schema for query parameters
const getBrowseParamsSchema = z.object({
  location: z.string().optional(),
  privateInvestment: z.string().optional(),
});

// Zod schema for a single RIA in the search results
const riaResultItemSchema = z.object({
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
  latest_filing: z.object({
    filing_date: z.string(),
    total_aum: z.number().nullable(),
    manages_private_funds_flag: z.boolean().nullable(),
  }).nullable().optional(),
});

const riaResultsSchema = z.array(riaResultItemSchema);

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', requiresAuth: true },
        { status: 401 }
      );
    }

    // Check subscription status
    const subscriptionStatus = await checkUserSubscription(user.id);
    
    if (!subscriptionStatus.hasActiveSubscription) {
      return NextResponse.json(
        { 
          error: 'Subscription required', 
          requiresSubscription: true,
          subscriptionStatus 
        },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      location: searchParams.get('location') || undefined,
      privateInvestment: searchParams.get('privateInvestment') || undefined,
    };

    const validation = getBrowseParamsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { location, privateInvestment } = validation.data;

    // Build query to fetch RIAs
    let queryBuilder = supabase
      .from('advisers')
      .select(`
        cik,
        crd_number,
        legal_name,
        main_addr_street1,
        main_addr_street2,
        main_addr_city,
        main_addr_state,
        main_addr_zip,
        main_addr_country,
        phone_number,
        fax_number,
        website,
        is_st_louis_msa,
        filings:filings!inner(
          filing_date,
          total_aum,
          manages_private_funds_flag
        )
      `);

    // Apply filters
    if (location) {
      const locationLower = location.toLowerCase();
      queryBuilder = queryBuilder.or(
        `main_addr_city.ilike.%${locationLower}%,main_addr_state.ilike.%${locationLower}%,main_addr_zip.like.${locationLower}%`
      );
    }

    if (privateInvestment === 'true') {
      queryBuilder = queryBuilder.eq('filings.manages_private_funds_flag', true);
    } else if (privateInvestment === 'false') {
      queryBuilder = queryBuilder.eq('filings.manages_private_funds_flag', false);
    }

    // Order by most recent filing and limit results
    queryBuilder = queryBuilder
      .order('filing_date', { referencedTable: 'filings', ascending: false })
      .limit(50);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Supabase error in browse RIAs:', error);
      return NextResponse.json(
        { error: 'Error fetching RIA data', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const transformedData = data?.map(adviser => ({
      ...adviser,
      latest_filing: adviser.filings && adviser.filings.length > 0 ? adviser.filings[0] : null,
      filings: undefined, // Remove filings array from response
    })) || [];

    // Validate the response
    const validationResult = riaResultsSchema.safeParse(transformedData);
    if (!validationResult.success) {
      console.error('Response validation error:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid response data format' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Browse results for RIAs',
      subscriptionStatus,
      data: validationResult.data,
    });

  } catch (error) {
    console.error('Error in browse RIAs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}