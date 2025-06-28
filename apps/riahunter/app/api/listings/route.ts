import { NextResponse } from 'next/server';
import { CreateListingSchema } from '@/lib/schemas';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AxiomRequest, withAxiom, log as axiomLog } from 'next-axiom';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

// Define Zod schema for a single listing item in the response
const ListingResponseItemSchema = CreateListingSchema.extend({
  id: z.string().uuid(), // Assuming ID is a UUID, adjust if it's a number or other string format
  created_at: z.string().datetime().optional(), // Supabase typically adds these
  updated_at: z.string().datetime().optional(), // Supabase typically adds these
});

// Define Zod schema for the GET /api/listings response
const GetListingsResponseSchema = z.object({
  data: z.array(ListingResponseItemSchema),
  total: z.number().int().nonnegative(),
});

// Helper to get the correct logger based on environment and request type
function getLoggerForRequest(request: Request | AxiomRequest) {
  // In test environment, always use console to avoid needing a full Axiom logger mock.
  // Outside of tests, use the Axiom logger from the request if available, or the global axiomLog.
  if (process.env.NODE_ENV === 'test') {
    return console;
  }
  // The `log` property is specific to AxiomRequest.
  // We need to check if it exists and is an AxiomRequest before accessing .log
  // A simple check could be if 'log' in request, but this is not type-safe for Request objects.
  // For now, rely on withAxiom to provide it or fallback if it's not a full AxiomRequest.
  return (request as AxiomRequest).log || axiomLog;
}

// Define a simple context type for handlers, even if params are not used in these specific routes
interface HandlerContext { params?: Record<string, string | string[]>; [key: string]: any; }

async function handleGet(request: Request | AxiomRequest, context?: HandlerContext) {
  const currentLog = getLoggerForRequest(request);
  currentLog.info('Received GET request for /api/listings', { params: context?.params });
  const supabase = getServerSupabaseClient();

  try {
    const { data: listings, error, count } = await supabase
      .from('listings')
      .select('*', { count: 'exact' }); // Request count for pagination

    if (error) {
      currentLog.error('Supabase error fetching listings', { error: error.message });
      return NextResponse.json({ error: 'Error fetching listings', details: error.message }, { status: 500 });
    }

    const responsePayload = {
      data: listings || [],
      total: count ?? listings?.length ?? 0, // Use Supabase count if available
    };

    const validationResult = GetListingsResponseSchema.safeParse(responsePayload);
    if (!validationResult.success) {
      currentLog.error('GET /api/listings response validation error', { error: validationResult.error.flatten() });
      return NextResponse.json(
        { error: 'Internal server error: Invalid response structure', details: validationResult.error.issues },
        { status: 500 }
      );
    }

    currentLog.info('Returning all listings from database', { count: validationResult.data.total });
    return NextResponse.json(validationResult.data);
  } catch (error: any) {
    currentLog.error('Error fetching listings (catch block)', { errorMessage: error.message, errorObj: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request | AxiomRequest, context?: HandlerContext) {
  const currentLog = getLoggerForRequest(request);
  currentLog.info('Received POST request for /api/listings', { params: context?.params });
  const supabase = getServerSupabaseClient();

  let body;
  try {
    body = await request.json();
    currentLog.debug('POST request body', { body });
  } catch (error: any) {
    if (error?.name === 'SyntaxError') {
      currentLog.error('SyntaxError parsing JSON body for POST /api/listings', { errorMessage: error.message });
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    currentLog.error('Error parsing JSON body for POST /api/listings', { errorName: error?.name, errorMessage: error.message, errorObj: error });
    return NextResponse.json({ message: "Failed to parse JSON payload" }, { status: 400 });
  }

  try {
    const validationResult = CreateListingSchema.safeParse(body);
    if (!validationResult.success) {
      currentLog.warn('Invalid request data for POST /api/listings', { errors: validationResult.error.flatten().fieldErrors });
      return NextResponse.json(
        { message: 'Invalid request data', errors: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Create new listing object from validated data
    const newListingData = validationResult.data;

    const { data: createdListings, error: insertError } = await supabase
      .from('listings')
      .insert([newListingData]) // Supabase insert expects an array of objects
      .select() // Return the inserted record(s)
      .single(); // Expecting a single record back after insert

    if (insertError) {
      currentLog.error('Supabase error creating listing', { error: insertError.message, details: insertError.details });
      return NextResponse.json({ error: 'Error creating listing', details: insertError.message }, { status: 500 });
    }

    // const createdListing = createdListings?.[0]; // No longer an array due to .single()
    const createdListing = createdListings;
    if (!createdListing) {
      currentLog.error('Supabase created listing but returned no data');
      return NextResponse.json({ error: 'Failed to retrieve created listing data' }, { status: 500 });
    }

    const responseValidationResult = ListingResponseItemSchema.safeParse(createdListing);
    if (!responseValidationResult.success) {
      currentLog.error('POST /api/listings response validation error', { error: responseValidationResult.error.flatten(), data: createdListing });
      return NextResponse.json(
        { error: 'Internal server error: Invalid response structure for created listing', details: responseValidationResult.error.issues },
        { status: 500 }
      );
    }

    currentLog.info('New listing created successfully in database', { newListing: responseValidationResult.data });
    return NextResponse.json(responseValidationResult.data, { status: 201 });
  } catch (error: any) {
    currentLog.error('Internal server error during POST /api/listings processing (catch block)', { errorMessage: error.message, errorObj: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

let GET, POST;

if (process.env.NODE_ENV === 'test') {
  GET = handleGet;
  POST = handlePost;
} else {
  GET = withAxiom(handleGet as any);
  POST = withAxiom(handlePost as any);
}

export { GET, POST };
