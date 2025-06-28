import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server'; // Import the server-side Supabase client
import { z } from 'zod';
import { google } from '@/lib/ai-models'; // Corrected import path
import { generateText } from 'ai'; // Vercel AI SDK helper
import * as Sentry from "@sentry/nextjs";

// Define Zod schema for query parameters for GET requests
const getSearchParamsSchema = z.object({
  location: z.string().optional(),
  privateInvestment: z.string().optional(),
});

// Define Zod schema for the POST request body
const postBodySchema = z.object({
  query: z.string().min(1, { message: "Search query cannot be empty" }),
});

// Zod schema for a single RIA in the search results using real schema
const riaSearchResultItemSchema = z.object({
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
  // Include latest filing info if joined
  latest_filing: z.object({
    filing_date: z.string(),
    total_aum: z.number().nullable(),
    manages_private_funds_flag: z.boolean().nullable(),
  }).nullable().optional(),
});

// Zod schema for the array of search results
const riaSearchResponseDataSchema = z.array(riaSearchResultItemSchema);

// Zod schema for the POST request's response data
const postResponseDataSchema = z.object({
  naturalLanguageQuery: z.string(),
  aiExtractedParams: z.object({ // Based on ExtractedSearchParams interface
    location: z.string().optional(),
    privateInvestmentInterest: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(), // Making aiExtractedParams itself optional if AI fails or is not used
  results: riaSearchResponseDataSchema, // Reuse the schema for Supabase results
});

interface ExtractedSearchParams {
  location?: string;
  privateInvestmentInterest?: boolean;
  keywords?: string[]; // For other general keywords
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = postBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { query: naturalLanguageQuery } = validation.data;
    let extractedParams: ExtractedSearchParams = {};

    if (google) {
      try {
        const prompt = `Given the user query: "${naturalLanguageQuery}", extract the following information and return it as a JSON object:
        1. "location": The geographical area mentioned (e.g., city, state, ZIP code). If not specified, omit this field.
        2. "privateInvestmentInterest": A boolean indicating if the user is interested in private investments, private funds, or similar concepts. If not specified, assume false or omit.
        3. "keywords": An array of other relevant keywords or proper nouns from the query that might be useful for searching, excluding common stop words. If none, provide an empty array.

        Example Query: "Find RIAs in St. Louis that focus on private equity"
        Expected JSON Output: {"location": "St. Louis", "privateInvestmentInterest": true, "keywords": ["private equity"]}

        Example Query: "Show me investment advisors"
        Expected JSON Output: {"keywords": ["investment advisors"]}

        Example Query: "Advisors in New York City"
        Expected JSON Output: {"location": "New York City", "keywords": []}
        Output ONLY the JSON object.`;

        // Using the generic generateText from Vercel AI SDK with the Google model
        const { text: aiResponse } = await generateText({
          model: google('gemini-pro'), // Specifying a Gemini model
          prompt: prompt,
        });

        console.log('AI Raw Response:', aiResponse);

        // Attempt to parse the AI response as JSON
        let parsedAiResponse: ExtractedSearchParams | null = null;
        try {
          parsedAiResponse = JSON.parse(aiResponse.trim());
          console.log('AI Parsed Response:', parsedAiResponse);
          extractedParams = parsedAiResponse || {};
        } catch (parseError) {
          console.warn('Failed to parse AI response as JSON:', parseError);
          // Fallback: extract basic keywords from the query
          extractedParams.keywords = naturalLanguageQuery
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        }
      } catch (aiError) {
        console.warn('AI processing failed:', aiError);
        // Fallback: extract basic keywords from the query
        extractedParams.keywords = naturalLanguageQuery
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2);
      }
    }

    const supabase = getServerSupabaseClient();

    // Build query with joins to get latest filing information
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

    // Apply filters based on AI extracted params
    if (extractedParams.location) {
      const location = extractedParams.location.toLowerCase();
      // Search in city, state, or zip
      queryBuilder = queryBuilder.or(
        `main_addr_city.ilike.%${location}%,main_addr_state.ilike.%${location}%,main_addr_zip.like.${location}%`
      );
    }

    if (extractedParams.privateInvestmentInterest === true) {
      // Filter for advisers that manage private funds based on latest filing
      queryBuilder = queryBuilder.eq('filings.manages_private_funds_flag', true);
    }

    // If keywords include firm name searches
    if (extractedParams.keywords && extractedParams.keywords.length > 0) {
      const firmNameKeywords = extractedParams.keywords.filter(k =>
        k.length > 3 && !['fund', 'private', 'investment', 'advisor', 'adviser'].includes(k)
      );
      if (firmNameKeywords.length > 0) {
        const nameSearch = firmNameKeywords.map(k => `legal_name.ilike.%${k}%`).join(',');
        queryBuilder = queryBuilder.or(nameSearch);
      }
    }

    // Order by most recent filing and limit results
    queryBuilder = queryBuilder
      .order('filing_date', { referencedTable: 'filings', ascending: false })
      .limit(20);

    const { data: supabaseResults, error: supabaseError } = await queryBuilder;

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      Sentry.captureException(supabaseError);
      return NextResponse.json({ error: 'Error fetching data from Supabase', details: supabaseError.message }, { status: 500 });
    }

    // Transform the data to match our schema (get latest filing per adviser)
    const transformedResults = supabaseResults?.map(adviser => ({
      ...adviser,
      latest_filing: adviser.filings && adviser.filings.length > 0 ? adviser.filings[0] : null,
      filings: undefined, // Remove the filings array from response
    })) || [];

    const responsePayload = {
      naturalLanguageQuery,
      aiExtractedParams: extractedParams,
      results: transformedResults,
    };

    // Validate the response payload
    const validationResult = postResponseDataSchema.safeParse(responsePayload);

    if (!validationResult.success) {
      console.error('POST response data validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('POST response data validation failed'), {
        extra: { issues: validationResult.error.issues, originalPayload: responsePayload },
      });
      return NextResponse.json(
        {
          error: 'Invalid data structure for POST response',
          details: validationResult.error.issues,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in /api/ria-hunter/search POST:', error);
    Sentry.captureException(error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = {
    location: searchParams.get('location') || undefined,
    privateInvestment: searchParams.get('privateInvestment') || undefined,
  };

  const validation = getSearchParamsSchema.safeParse(params);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid query parameters', issues: validation.error.issues }, { status: 400 });
  }

  // Validated parameters
  const { location, privateInvestment } = validation.data;

  console.log('Search API called with (validated):', { location, privateInvestment });

  try {
    const supabase = getServerSupabaseClient();

    // Build query using real database schema with joins
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

    if (location) {
      // Search in city, state, or ZIP code
      queryBuilder = queryBuilder.or(
        `main_addr_city.ilike.%${location}%,main_addr_state.ilike.%${location}%,main_addr_zip.like.${location}%`
      );
    }

    if (privateInvestment === 'true') {
      // Filter for advisers that manage private funds
      queryBuilder = queryBuilder.eq('filings.manages_private_funds_flag', true);
    } else if (privateInvestment === 'false') {
      queryBuilder = queryBuilder.eq('filings.manages_private_funds_flag', false);
    }

    // Order by most recent filing date and limit results
    queryBuilder = queryBuilder
      .order('filing_date', { referencedTable: 'filings', ascending: false })
      .limit(50);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Supabase error in GET /api/ria-hunter/search:', error);
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Error fetching data from Supabase', details: error.message }, { status: 500 });
    }

    // Transform the data to match our schema (get latest filing per adviser)
    const transformedData = data?.map(adviser => ({
      ...adviser,
      latest_filing: adviser.filings && adviser.filings.length > 0 ? adviser.filings[0] : null,
      filings: undefined, // Remove the filings array from response
    })) || [];

    // Validate the structure of the data from Supabase before sending it in the response
    const validationResult = riaSearchResponseDataSchema.safeParse(transformedData);
    if (!validationResult.success) {
      console.error('Supabase response data validation error:', validationResult.error);
      Sentry.captureException(new Error('GET response data validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: transformedData },
      });
      return NextResponse.json(
        {
          error: 'Invalid data structure from database',
          details: validationResult.error.issues
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Search results for RIA Hunter',
      receivedParams: {
        location,
        privateInvestment,
      },
      data: validationResult.data,
    });

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/search:', error);
    Sentry.captureException(error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
