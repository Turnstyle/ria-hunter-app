import { NextResponse } from 'next/server';
import { CreateListingSchema } from '@appfoundation/schemas';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AxiomRequest, withAxiom, log as axiomLog } from 'next-axiom';
import { getServerSupabaseClient } from '@appfoundation/supabase/server';

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
    const { data: listings, error } = await supabase.from('listings').select('*');

    if (error) {
      currentLog.error('Supabase error fetching listings', { error: error.message });
      return NextResponse.json({ error: 'Error fetching listings', details: error.message }, { status: 500 });
    }

    currentLog.info('Returning all listings from database', { count: listings?.length || 0 });
    return NextResponse.json({ data: listings || [], total: listings?.length || 0 });
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
      .select(); // Return the inserted record(s)

    if (insertError) {
      currentLog.error('Supabase error creating listing', { error: insertError.message, details: insertError.details });
      return NextResponse.json({ error: 'Error creating listing', details: insertError.message }, { status: 500 });
    }

    const createdListing = createdListings?.[0];
    if (!createdListing) {
      currentLog.error('Supabase created listing but returned no data');
      return NextResponse.json({ error: 'Failed to retrieve created listing data' }, { status: 500 });
    }

    currentLog.info('New listing created successfully in database', { newListing: createdListing });
    return NextResponse.json(createdListing, { status: 201 });
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
