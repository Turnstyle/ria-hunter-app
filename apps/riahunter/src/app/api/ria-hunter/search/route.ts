import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server'; // Import the server-side Supabase client
// import { someAIServiceFunction } from 'ai-services'; // Adjusted placeholder for AI services
import { z } from 'zod';
import { google } from 'ai-services'; // Corrected import path
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

// Zod schema for a single item in the search results array from Supabase
const riaSearchResultItemSchema = z.object({
  // Define based on the actual columns you select and expect
  // Example using fields from the POST handler's select:
  id: z.any(), // org_pk can be number or string, using z.any() for flexibility here
  managesprivatefunds: z.boolean().nullable().optional(),
  is_private_fund_related: z.boolean().nullable().optional(),
  // If using select('*'), you'd list all expected columns and their types
  // For now, keeping it minimal or more generic if columns are unknown for GET's select('*')
  // If select('*') is used, it's safer to make the object more open or define all fields
});

// Zod schema for the array of search results
const riaSearchResponseDataSchema = z.array(z.record(z.any())); // More generic for select('*')
// For a more strictly typed response based on known selected columns:
// const riaSearchResponseDataSchema = z.array(riaSearchResultItemSchema);

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
        // The AI is instructed to return ONLY JSON, but good to be safe.
        let parsedAiResponse: ExtractedSearchParams | null = null;
        try {
            // Clean the response to ensure it's valid JSON before parsing
            const cleanedResponse = aiResponse.replace(/```json\n|```/g, '').trim();
            parsedAiResponse = JSON.parse(cleanedResponse) as ExtractedSearchParams;
        } catch (e) {
            console.error("Failed to parse AI response as JSON:", e, "Raw response:", aiResponse);
            // Potentially fall back to simpler keyword extraction or return an error/clarification request
        }

        if (parsedAiResponse) {
          extractedParams = parsedAiResponse;
        }
        console.log('Extracted Search Parameters by AI:', extractedParams);

      } catch (aiError) {
        console.error('Error processing query with AI:', aiError);
        // Fallback or error handling if AI processing fails
        // For now, we can try a very basic keyword extraction if AI fails
        extractedParams.keywords = naturalLanguageQuery.split(' ').filter(k => k.length > 2); // Simple fallback
      }
    } else {
      console.warn('Google AI client not available. Using basic keyword extraction.');
      // Fallback to basic keyword extraction if Google client is not initialized
      extractedParams.keywords = naturalLanguageQuery.split(' ').filter(k => k.length > 2);
    }

    // TODO: Use extractedParams (location, privateInvestmentInterest, keywords)
    // to build a Supabase query.

    // For now, just return the extracted params and the original query
    // Replace with actual Supabase query and results later

    const supabase = getServerSupabaseClient();
    let queryBuilder = supabase
      .from('sec_advisers_test')
      .select('org_pk:id, managesprivatefunds, is_private_fund_related');

    // Example: Basic filtering based on AI extracted params (NEEDS REFINEMENT AND ACTUAL COLUMN NAMES)
    if (extractedParams.location) {
      // This is a placeholder. Actual location filtering will be more complex (e.g., ZIPs in MSA)
      // queryBuilder = queryBuilder.ilike('address_city', `%${extractedParams.location}%`);
      console.log("AI suggested location for query (not yet used):", extractedParams.location);
    }
    if (extractedParams.privateInvestmentInterest === true) {
      // queryBuilder = queryBuilder.is('managesprivatefunds', true); // Example, use actual column
      console.log("AI suggested private investment interest for query (not yet used).");
    }
    // You might also use extractedParams.keywords for .textSearch() or .ilike() on relevant columns

    // Fallback: if AI didn't provide specific params, try using the original query for basic search
    // This is a placeholder for the old direct org_pk search if no AI params are useful
    if (Object.keys(extractedParams).length === 0 || (extractedParams.keywords && extractedParams.keywords.includes(naturalLanguageQuery))) {
        console.log("Attempting direct org_pk lookup as fallback or if query matches keyword list exactly")
        queryBuilder = queryBuilder.eq('org_pk', naturalLanguageQuery); // Original logic if query is an org_pk
    }

    const { data: supabaseResults, error: supabaseError } = await queryBuilder.limit(10); // Example limit

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      return NextResponse.json({ error: 'Error fetching data from Supabase', details: supabaseError.message }, { status: 500 });
    }

    const responsePayload = {
      naturalLanguageQuery,
      aiExtractedParams: extractedParams,
      results: supabaseResults || [], // Ensure results is always an array
    };

    // Validate the response payload
    const validationResult = postResponseDataSchema.safeParse(responsePayload);

    if (!validationResult.success) {
      console.error('POST response data validation error:', validationResult.error.issues);
      // Potentially return a generic error or the data as is, depending on policy
      // For now, returning an error to prevent sending malformed data
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
    // Assuming 'sec_advisers_test' is the table name and it has relevant columns.
    // Adjust table and column names as per the actual schema.
    let queryBuilder = supabase
      .from('sec_advisers_test') // Replace with your actual table name
      .select('*'); // Select all columns for now, adjust as needed

    if (location) {
      // Placeholder for location filtering. This needs to be more robust.
      // Example: searching in a city column. Adjust 'address_city' to your actual column name.
      queryBuilder = queryBuilder.ilike('address_city', `%${location}%`);
    }

    if (privateInvestment === 'true') {
      // Example: filtering for advisers that manage private funds.
      // Adjust 'managesprivatefunds' to your actual boolean column name.
      queryBuilder = queryBuilder.eq('managesprivatefunds', true);
    } else if (privateInvestment === 'false') {
      queryBuilder = queryBuilder.eq('managesprivatefunds', false);
    }

    // Add a limit to prevent accidentally fetching too much data
    queryBuilder = queryBuilder.limit(50);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Supabase error in GET /api/ria-hunter/search:', error);
      return NextResponse.json({ error: 'Error fetching data from Supabase', details: error.message }, { status: 500 });
    }

    // Validate the structure of the data from Supabase before sending it in the response
    const validationResult = riaSearchResponseDataSchema.safeParse(data);
    if (!validationResult.success) {
      console.error('Supabase response data validation error:', validationResult.error);
      // Decide if to send potentially malformed data, an error, or an empty array
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
      data: validationResult.data, // Send the validated data
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
