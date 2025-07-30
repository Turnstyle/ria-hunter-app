import supertest, { SuperTest, Test } from 'supertest';
import http from 'http';
import { Readable } from 'stream';
// Attempt to import internal handlers, assuming they are exported in test environment
import { GET as routeGET, POST as routePOST } from './route';
import { CreateListingPayload, CreateListingSchema } from '@appfoundation/schemas';
import { NextRequest, NextResponse } from 'next/server';
import { AxiomRequest } from 'next-axiom';
import { z } from 'zod';

// Define Zod schema for a single listing item in the response (mirror from route.ts for test data generation)
const TestListingResponseItemSchema = CreateListingSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
// For GET response, data can have optional created_at/updated_at from DB if not all records have it
// but for mock generation, it's easier to make them required and then strip if needed.
// The route's Zod schema makes them optional, which is correct.

// Define the expected shape of the handlers from route.ts
// These handlers (handleGet, handlePost) take an optional second context argument.
interface HandlerContext { params?: Record<string, string | string[]>; [key: string]: any; }
type AppRouteHandler = (
  req: NextRequest | AxiomRequest,
  context?: HandlerContext // context is optional in the actual handlers
) => Promise<NextResponse>;

// Mock Supabase
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseInsert = jest.fn();
const mockSupabaseSingle = jest.fn(); // For .single()

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

// Setup mock implementations
mockSupabaseFrom.mockImplementation(() => ({
  select: mockSupabaseSelect,
  insert: mockSupabaseInsert,
}));

mockSupabaseInsert.mockImplementation(() => ({ // insert(...).select().single()
  select: jest.fn(() => ({ // This select is after insert
    single: mockSupabaseSingle,
  })),
}));
// mockSupabaseSelect is for the GET case: from(...).select()

// Helper to convert Node.js IncomingMessage to a Web API Request object
// Returns a plain NextRequest. Inside route handlers, this will cause
// (request as AxiomRequest).log to be undefined, falling back to console for tests.
async function toWebRequest(nodeReq: http.IncomingMessage): Promise<NextRequest> {
  const { method, url, headers } = nodeReq;
  const controller = new AbortController();
  nodeReq.on('close', () => controller.abort());

  let body: ReadableStream<Uint8Array> | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    body = Readable.toWeb(nodeReq) as ReadableStream<Uint8Array>;
  }

  const fullUrl = new URL(url || '/', 'http://localhost');

  const nextReqInstance = new NextRequest(fullUrl.toString(), {
    method: method || 'GET',
    headers: new Headers(headers as HeadersInit),
    body,
    signal: controller.signal,
  });

  return nextReqInstance;
}

// Helper to send a NextResponse via http.ServerResponse
async function sendNextResponse(res: http.ServerResponse, nextRes: Response): Promise<void> {
  res.statusCode = nextRes.status;
  nextRes.headers.forEach((val, key) => {
    res.setHeader(key, val);
  });
  if (nextRes.body) {
    try {
      const reader = nextRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch (e) {
      console.error('[sendNextResponse] Error reading/writing body (should not happen in passing tests):', e);
    }
  }
  if (!res.writableEnded) {
    res.end();
  }
}

describe('API - /api/listings (supertest)', () => {
  let agent: any; // Using any to bypass persistent type issue
  let server: http.Server;

  beforeAll((done) => {
    server = http.createServer(async (req, res) => {
      const webReq: NextRequest = await toWebRequest(req);
      try {
        if (req.url === '/api/listings' && req.method === 'GET') {
          // @ts-expect-error Type inference challenge with conditional exports
          const nextRes = await (routeGET as AppRouteHandler)(webReq);
          await sendNextResponse(res, nextRes);
        } else if (req.url === '/api/listings' && req.method === 'POST') {
          // @ts-expect-error Type inference challenge with conditional exports
          const nextRes = await (routePOST as AppRouteHandler)(webReq);
          await sendNextResponse(res, nextRes);
        } else {
          res.statusCode = 404;
          res.end('Not Found in Test Harness');
        }
      } catch (err) {
        console.error('Error in test server request handling:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Test harness server error', error: (err as Error).message }));
        } else {
          if (!res.writableEnded) res.end();
        }
      }
    });
    server.listen(() => {
      const port = (server.address() as import('net').AddressInfo).port;
      agent = supertest(server); // Assign to agent
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Reset all mock implementations and calls before each test
    mockSupabaseFrom.mockClear().mockImplementation(() => ({
        select: mockSupabaseSelect,
        insert: mockSupabaseInsert,
    }));
    mockSupabaseSelect.mockClear();
    mockSupabaseInsert.mockClear().mockImplementation(() => ({
        select: jest.fn(() => ({
            single: mockSupabaseSingle,
        })),
    }));
    mockSupabaseSingle.mockClear();
  });

  describe('GET /api/listings', () => {
    it('should return all listings with a 200 status and correct structure', async () => {
      const now = new Date().toISOString();
      const mockListingsData = [
        { id: '11111111-1111-1111-1111-111111111111', title: 'Test Listing 1', description: 'Desc 1', price: 100, email: 'test1@example.com', created_at: now, updated_at: now },
        { id: '22222222-2222-2222-2222-222222222222', title: 'Test Listing 2', description: 'Desc 2', price: 200, email: 'test2@example.com', created_at: now, updated_at: now },
      ];
      // Ensure Zod schema for response items is satisfied by mock data
      mockListingsData.forEach(item => TestListingResponseItemSchema.parse(item));


      // Mock for from('listings').select('*', { count: 'exact' })
      mockSupabaseSelect.mockResolvedValueOnce({ data: mockListingsData, error: null, count: mockListingsData.length });

      const res = await agent.get('/api/listings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toEqual(mockListingsData);
      expect(res.body.total).toBe(mockListingsData.length);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('listings');
      // Check select arguments: first is '*', second is { count: 'exact' }
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*', { count: 'exact' });
    });

    it('should return 500 if supabase select fails', async () => {
      mockSupabaseSelect.mockResolvedValueOnce({ data: null, error: { message: 'Supabase select error' }, count: 0 });
      const res = await agent.get('/api/listings');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error fetching listings');
    });

    it('should return 500 if response data is not as expected by Zod (mocked validation failure)', async () => {
      const malformedListing = { id: '123', title: 'Bad ID' }; // id is not UUID
      mockSupabaseSelect.mockResolvedValueOnce({ data: [malformedListing], error: null, count: 1 });

      const res = await agent.get('/api/listings');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Internal server error: Invalid response structure');
    });
  });

  describe('POST /api/listings', () => {
    const now = new Date().toISOString();
    const newListingPayload: CreateListingPayload = {
      title: 'Supertest New Item',
      description: 'This is a test item created by Supertest!',
      price: 199.99,
      email: 'supertest@example.com',
    };

    const expectedCreatedListing = {
      ...newListingPayload,
      id: '33333333-3333-3333-3333-333333333333', // Example UUID
      created_at: now,
      updated_at: now,
    };
    // Ensure Zod schema for response item is satisfied
    TestListingResponseItemSchema.parse(expectedCreatedListing);


    it('should create a new listing with valid data and return 201 status with correct structure', async () => {
      // Mock for from('listings').insert(...).select().single()
      mockSupabaseSingle.mockResolvedValueOnce({ data: expectedCreatedListing, error: null });

      const res = await agent
        .post('/api/listings')
        .send(newListingPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toEqual(expectedCreatedListing);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('listings');
      expect(mockSupabaseInsert).toHaveBeenCalledWith([newListingPayload]);
      expect(mockSupabaseSingle).toHaveBeenCalled();
    });

    it('should return 400 status for invalid data (e.g., missing title)', async () => {
      const invalidData = { // Missing title, price not positive, email invalid
        description: 'This item is missing a title',
        price: -10.00,
        email: 'invalid-email',
      };
      const res = await agent
        .post('/api/listings')
        .send(invalidData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid request data');
      expect(res.body).toHaveProperty('errors');
      expect(res.body.errors).toHaveProperty('title');
      expect(res.body.errors).toHaveProperty('price');
      expect(res.body.errors).toHaveProperty('email');
    });

    it('should return 400 status for invalid JSON payload', async () => {
      const res = await agent
        .post('/api/listings')
        .send('{\"title\": \"Unfinished JSON') // Sending malformed JSON string
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid JSON payload');
    });

    it('should return 500 if supabase insert fails', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { message: 'Supabase insert error' } });

      const res = await agent
        .post('/api/listings')
        .send(newListingPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error creating listing');
    });

    it('should return 500 if created listing data from Supabase is not as expected by Zod', async () => {
      const malformedCreatedListing = {
        ...newListingPayload,
        id: 'not-a-uuid', // Invalid ID
        created_at: now,
        updated_at: now,
      };
      mockSupabaseSingle.mockResolvedValueOnce({ data: malformedCreatedListing, error: null });

      const res = await agent
        .post('/api/listings')
        .send(newListingPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Internal server error: Invalid response structure for created listing');
    });
  });
});
