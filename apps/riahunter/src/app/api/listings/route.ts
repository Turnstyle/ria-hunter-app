import { NextResponse } from 'next/server';
import { CreateListingSchema } from '@appfoundation/schemas';
import { AxiomRequest, withAxiom, log as axiomLog } from 'next-axiom';
import { v4 as uuidv4 } from 'uuid';

// Mock database - replace with actual database logic later
// Consolidate with [id]/route.ts store later if possible
let listingsStore: Record<string, any> = {
  '2d44393c-45e3-492c-8292-0d4bb42651b1': {
    id: '2d44393c-45e3-492c-8292-0d4bb42651b1',
    title: 'Historic Anvil',
    description: 'A very old anvil, perfect for collectors.',
    price: 150.75,
    email: 'seller@example.com',
    createdAt: new Date().toISOString()
  },
  'a81b5b8e-7cbe-4f89-8915-2b592969c6b2': {
    id: 'a81b5b8e-7cbe-4f89-8915-2b592969c6b2',
    title: 'Vintage Typewriter',
    description: 'A beautifully preserved typewriter from the 1940s.',
    price: 220.00,
    email: 'another.seller@example.com',
    createdAt: new Date().toISOString()
  }
};

// Define logger based on environment
const routeLog = process.env.NODE_ENV === 'test' ? console : axiomLog;

async function handleGet(request: Request | AxiomRequest) {
  const currentLog = (request as AxiomRequest).log || routeLog;
  currentLog.info('Received GET request for /api/listings');
  try {
    // TODO: Implement pagination and filtering later
    const allListings = Object.values(listingsStore);
    currentLog.info('Returning all listings', { count: allListings.length });
    return NextResponse.json({ data: allListings, total: allListings.length });
  } catch (error) {
    currentLog.error('Error fetching listings', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePost(request: Request | AxiomRequest) {
  const currentLog = (request as AxiomRequest).log || routeLog;
  currentLog.info('Received POST request for /api/listings');

  let body;
  try {
    body = await request.json();
    currentLog.debug('POST request body', { body });
  } catch (error: any) {
    if (error && error.name === 'SyntaxError') {
      currentLog.error('SyntaxError parsing JSON body for POST /api/listings', { errorMessage: error.message });
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    currentLog.error('Error parsing JSON body for POST /api/listings (non-SyntaxError)', { errorName: error.name, errorMessage: error.message, errorObj: error });
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

    const newListing = {
      id: uuidv4(),
      ...validationResult.data,
      createdAt: new Date().toISOString(),
    };
    listingsStore[newListing.id] = newListing;
    currentLog.info('New listing created successfully', { newListing });
    return NextResponse.json(newListing, { status: 201 });
  } catch (error: any) {
    currentLog.error('Internal server error during POST /api/listings processing', { errorMessage: error.message, errorObj: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Conditionally wrap for non-test environments
const getHandler = process.env.NODE_ENV === 'test' ? handleGet : withAxiom(handleGet as any);
const postHandler = process.env.NODE_ENV === 'test' ? handlePost : withAxiom(handlePost as any);

export { getHandler as GET, postHandler as POST };
