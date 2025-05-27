import { NextResponse } from 'next/server';
import { AxiomRequest, withAxiom, log as axiomLog } from 'next-axiom';
import { IdSchema, UpdateListingSchema } from '@appfoundation/schemas';
import { getServerSupabaseClient } from '@appfoundation/supabase/server';

// Helper to get the correct logger
function getLoggerForRequest(request: Request | AxiomRequest) {
  if (process.env.NODE_ENV === 'test') {
    return console;
  }
  return (request as AxiomRequest).log || axiomLog;
}

interface HandlerContext { params: { id: string } }

async function handleGetId(request: Request | AxiomRequest, { params }: HandlerContext) {
  const currentLog = getLoggerForRequest(request);
  currentLog.info('Received GET request for /api/listings/[id]', { params });
  const supabase = getServerSupabaseClient();

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id } = paramsValidation.data;

  try {
    const { data: listing, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single(); // Expect a single record or null

    if (error) {
      // Check if error is due to no rows found, which should be a 404
      if (error.code === 'PGRST116') { // PostgREST error code for "Searched item was not found"
        currentLog.info('Listing not found in database', { id });
        return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
      }
      currentLog.error('Supabase error fetching listing by ID', { id, error: error.message });
      return NextResponse.json({ error: 'Error fetching listing', details: error.message }, { status: 500 });
    }

    if (!listing) { // Should be caught by PGRST116, but as a fallback
      currentLog.info('Listing not found in database (no data returned)', { id });
      return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
    }

    currentLog.info('Returning listing by ID', { listing });
    return NextResponse.json(listing);
  } catch (error: any) {
    currentLog.error('Error fetching listing by ID (catch block)', { id, errorMessage: error.message, errorObj: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePutId(request: Request | AxiomRequest, { params }: HandlerContext) {
  const currentLog = getLoggerForRequest(request);
  currentLog.info('Received PUT request for /api/listings/[id]', { params });
  const supabase = getServerSupabaseClient();

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format for PUT', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id } = paramsValidation.data;

  try {
    const requestBody = await request.json();
    currentLog.debug('PUT request body', { body: requestBody });
    const validationResult = UpdateListingSchema.safeParse(requestBody);

    if (!validationResult.success) {
      currentLog.warn('Invalid request data for PUT', { errors: validationResult.error.flatten().fieldErrors });
      return NextResponse.json(
        { message: 'Invalid request data', errors: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (Object.keys(validationResult.data).length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    const { data: updatedListings, error: updateError } = await supabase
      .from('listings')
      .update(validationResult.data)
      .eq('id', id)
      .select();

    if (updateError) {
      currentLog.error('Supabase error updating listing', { id, error: updateError.message });
      return NextResponse.json({ error: 'Error updating listing', details: updateError.message }, { status: 500 });
    }

    const updatedListing = updatedListings?.[0];
    if (!updatedListing) {
        currentLog.warn('Listing not found for PUT update, or no change', { id });
        return NextResponse.json({ message: 'Listing not found or no change made' }, { status: 404 });
    }

    currentLog.info('Listing updated successfully in database', { id, data: updatedListing });
    return NextResponse.json({ message: 'Listing updated successfully', data: updatedListing });
  } catch (error: any) {
    currentLog.error('Error processing PUT request (catch block)', { id, errorMessage: error.message, errorObj: error });
    if (error?.name === 'SyntaxError') {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleDeleteId(request: Request | AxiomRequest, { params }: HandlerContext) {
  const currentLog = getLoggerForRequest(request);
  currentLog.info('Received DELETE request for /api/listings/[id]', { params });
  const supabase = getServerSupabaseClient();

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format for DELETE', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { id } = paramsValidation.data;

  try {
    const { error: deleteError, count } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      currentLog.error('Supabase error deleting listing', { id, error: deleteError.message });
      return NextResponse.json({ error: 'Error deleting listing', details: deleteError.message }, { status: 500 });
    }

    if (count === 0) {
      currentLog.info('Listing not found for DELETE in database', { id });
      return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
    }

    currentLog.info('Listing deleted successfully from database', { id });
    return NextResponse.json({ message: 'Listing deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (error: any) {
    currentLog.error('Error deleting listing (catch block)', { id, errorMessage: error.message, errorObj: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// withAxiom wrapping remains unchanged
const getHandler = process.env.NODE_ENV === 'test' ? handleGetId : withAxiom(handleGetId as any);
const putHandler = process.env.NODE_ENV === 'test' ? handlePutId : withAxiom(handlePutId as any);
const deleteHandler = process.env.NODE_ENV === 'test' ? handleDeleteId : withAxiom(handleDeleteId as any);

export const GET = getHandler;
export const PUT = putHandler;
export const DELETE = deleteHandler;
