import { NextResponse } from 'next/server';
import { AxiomRequest, withAxiom, log } from 'next-axiom';
import { IdSchema, UpdateListingSchema } from '@appfoundation/schemas';

// Mock database - replace with actual database logic later
let listingsStore: Record<string, any> = {
  '2d44393c-45e3-492c-8292-0d4bb42651b1': {
    id: '2d44393c-45e3-492c-8292-0d4bb42651b1',
    title: 'Historic Anvil',
    description: 'A very old anvil, perfect for collectors.',
    price: 150.75,
    email: 'seller@example.com'
  },
  'a81b5b8e-7cbe-4f89-8915-2b592969c6b2': {
    id: 'a81b5b8e-7cbe-4f89-8915-2b592969c6b2',
    title: 'Vintage Typewriter',
    description: 'A beautifully preserved typewriter from the 1940s.',
    price: 220.00,
    email: 'another.seller@example.com'
  }
};

// Define logger based on environment
const routeLog = process.env.NODE_ENV === 'test' ? console : log;

async function handleGetId(request: Request | AxiomRequest, { params }: { params: { id: string } }) {
  const currentLog = (request as AxiomRequest).log || routeLog;
  currentLog.info('Received GET request for /api/listings/[id]', { params });

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const listing = listingsStore[paramsValidation.data.id];

  if (!listing) {
    currentLog.info('Listing not found', { id: paramsValidation.data.id });
    return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
  }

  currentLog.info('Returning listing', { listing });
  return NextResponse.json(listing);
}

async function handlePutId(request: Request | AxiomRequest, { params }: { params: { id: string } }) {
  const currentLog = (request as AxiomRequest).log || routeLog;
  currentLog.info('Received PUT request for /api/listings/[id]', { params });

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format for PUT', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (!listingsStore[paramsValidation.data.id]) {
    currentLog.info('Listing not found for PUT', { id: paramsValidation.data.id });
    return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
  }

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

    listingsStore[paramsValidation.data.id] = {
      ...listingsStore[paramsValidation.data.id],
      ...validationResult.data,
    };

    currentLog.info('Listing updated successfully', { id: paramsValidation.data.id, data: validationResult.data });
    return NextResponse.json({ message: 'Listing updated successfully', data: listingsStore[paramsValidation.data.id] });
  } catch (error) {
    currentLog.error('Error processing PUT request', { error });
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleDeleteId(request: Request | AxiomRequest, { params }: { params: { id: string } }) {
  const currentLog = (request as AxiomRequest).log || routeLog;
  currentLog.info('Received DELETE request for /api/listings/[id]', { params });

  const paramsValidation = IdSchema.safeParse(params);
  if (!paramsValidation.success) {
    currentLog.warn('Invalid ID format for DELETE', { errors: paramsValidation.error.flatten().fieldErrors });
    return NextResponse.json(
      { message: 'Invalid ID format', errors: paramsValidation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (!listingsStore[paramsValidation.data.id]) {
    currentLog.info('Listing not found for DELETE', { id: paramsValidation.data.id });
    return NextResponse.json({ message: 'Listing not found' }, { status: 404 });
  }

  delete listingsStore[paramsValidation.data.id];
  currentLog.info('Listing deleted successfully', { id: paramsValidation.data.id });
  return NextResponse.json({ message: 'Listing deleted successfully' }, { status: 200 });
}

// Conditionally wrap for non-test environments
const getHandler = process.env.NODE_ENV === 'test' ? handleGetId : withAxiom(handleGetId as any);
const putHandler = process.env.NODE_ENV === 'test' ? handlePutId : withAxiom(handlePutId as any);
const deleteHandler = process.env.NODE_ENV === 'test' ? handleDeleteId : withAxiom(handleDeleteId as any);

export { getHandler as GET, putHandler as PUT, deleteHandler as DELETE };
