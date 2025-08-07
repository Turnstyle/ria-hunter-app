import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { google } from '@/lib/ai-models'; // Corrected import path
import { getServerSupabaseClient } from '@/lib/supabase-server';
import * as Sentry from "@sentry/nextjs";

// Define Zod schema for the POST request body
const postBodySchema = z.object({
  query: z.string().min(1, { message: "Query cannot be empty" }),
});

// Define the structure of the search filters/parameters that we can extract from the query
interface ExtractedSearchParams {
  location?: string; // City, state, ZIP, etc.
  privateInvestmentInterest?: boolean; // Whether the user is looking for advisors that handle private investments
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

    const googleClient = google();
    if (googleClient) {
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
          model: googleClient('gemini-pro'), // Specifying a Gemini model
          prompt: prompt,
        });

        console.log('AI Raw Response:', aiResponse);

        // Attempt to parse the AI response as JSON
        let parsedAiResponse: ExtractedSearchParams | null = null;
        try {
          parsedAiResponse = JSON.parse(aiResponse.trim());
          console.log('Parsed AI Response:', parsedAiResponse);

          // Validate and clean the parsed response
          if (typeof parsedAiResponse === 'object' && parsedAiResponse !== null) {
            if (parsedAiResponse.location && typeof parsedAiResponse.location === 'string') {
              extractedParams.location = parsedAiResponse.location;
            }
            if (typeof parsedAiResponse.privateInvestmentInterest === 'boolean') {
              extractedParams.privateInvestmentInterest = parsedAiResponse.privateInvestmentInterest;
            }
            if (Array.isArray(parsedAiResponse.keywords)) {
              extractedParams.keywords = parsedAiResponse.keywords.filter(k => typeof k === 'string');
            }
          }
        } catch (jsonParseError) {
          console.warn('Failed to parse AI response as JSON:', jsonParseError);
        }

      } catch (aiError) {
        console.warn('AI processing failed, proceeding with simple keyword extraction:', aiError);
        // Fall back to simple keyword extraction if AI fails
        const words = naturalLanguageQuery.toLowerCase().match(/\b\w+\b/g) || [];
        extractedParams.keywords = words.filter(word => word.length > 2);
      }
    } else {
      console.log('Google AI not available, using simple keyword extraction');
      // Fall back to simple keyword extraction
      const words = naturalLanguageQuery.toLowerCase().match(/\b\w+\b/g) || [];
      extractedParams.keywords = words.filter(word => word.length > 2);
    }

    console.log('Extracted parameters:', extractedParams);

    // --- Build the Supabase query ---
    const supabase = getServerSupabaseClient();

    let query = supabase
      .from('advisers')
      .select(`
        cik,
        legal_name,
        main_addr_city,
        main_addr_state,
        main_addr_zip,
        has_private_funds,
        adv_id,
        sec_number
      `);

    // Apply location filter if extracted
    if (extractedParams.location) {
      const locationLower = extractedParams.location.toLowerCase();
      query = query.or(`main_addr_city.ilike.%${locationLower}%,main_addr_state.ilike.%${locationLower}%,main_addr_zip.ilike.%${locationLower}%`);
    }

    // Apply private investment interest filter if extracted
    if (extractedParams.privateInvestmentInterest === true) {
      query = query.eq('has_private_funds', true);
    }

    // Apply a general text search on legal_name if we have keywords
    if (extractedParams.keywords && extractedParams.keywords.length > 0) {
      const keywordConditions = extractedParams.keywords
        .map(keyword => `legal_name.ilike.%${keyword}%`)
        .join(',');
      query = query.or(keywordConditions);
    }

    // Limit results
    query = query.limit(50);

    const { data: advisers, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Database query failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      query: naturalLanguageQuery,
      extractedParams,
      results: advisers || [],
      count: advisers?.length || 0,
    });

  } catch (error) {
    console.error('Error in RIA Hunter search:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
