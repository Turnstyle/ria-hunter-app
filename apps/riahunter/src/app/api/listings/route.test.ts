import supertest, { SuperTest, Test } from 'supertest';
import http from 'http';
import { Readable } from 'stream';
// Attempt to import internal handlers, assuming they are exported in test environment
import { GET as actualGET_ANY, POST as actualPOST_ANY } from './route';
import { CreateListingPayload } from '@appfoundation/schemas';
import { NextRequest, NextResponse } from 'next/server';
import { AxiomRequest } from 'next-axiom';

// Define the expected shape of the raw handlers (handleGet, handlePost)
type RawHandler = (req: NextRequest | AxiomRequest) => Promise<NextResponse>;

// Cast the imported handlers to the defined type
const actualGET: RawHandler = actualGET_ANY as RawHandler;
const actualPOST: RawHandler = actualPOST_ANY as RawHandler;

// Cast for usage in tests if needed, or use actualGET/actualPOST directly if their signature is suitable
const GET: RawHandler = actualGET;
const POST: RawHandler = actualPOST;

// Mock Supabase
const mockSupabaseFrom = jest.fn().mockReturnThis(); // Ensure 'from' is chainable
const mockSupabaseSelect = jest.fn();
const mockSupabaseInsert = jest.fn().mockReturnThis(); // Ensure 'insert' is chainable for .select()

jest.mock('@appfoundation/supabase/server', () => ({
  getServerSupabaseClient: () => ({
    from: mockSupabaseFrom,
    select: mockSupabaseSelect, // Used after from('...').select('...')
    insert: mockSupabaseInsert, // Used after from('...').insert('...').select()
  }),
}));

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
    // Reset mocks before each test suite run (though beforeAll runs once per describe block)
    mockSupabaseFrom.mockReturnThis(); // Ensure chaining for .select/.insert
    mockSupabaseSelect.mockReset();
    mockSupabaseInsert.mockReturnThis(); // Ensure chaining for .select on insert

    server = http.createServer(async (req, res) => {
      const webReq: NextRequest = await toWebRequest(req);
      try {
        if (req.url === '/api/listings' && req.method === 'GET') {
          const nextRes = await GET(webReq);
          await sendNextResponse(res, nextRes);
        } else if (req.url === '/api/listings' && req.method === 'POST') {
          const nextRes = await POST(webReq);
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

  describe('GET /api/listings', () => {
    it('should return all listings with a 200 status', async () => {
      const mockListings = [
        { id: '1', title: 'Test Listing 1', price: 100 },
        { id: '2', title: 'Test Listing 2', price: 200 },
      ];
      // Ensure from().select() is mocked for this test case
      mockSupabaseFrom.mockReturnValueOnce({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockResolvedValueOnce({ data: mockListings, error: null });

      const res = await agent.get('/api/listings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toEqual(mockListings);
      expect(res.body.total).toBe(mockListings.length);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('listings');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
    });

    it('should return 500 if supabase select fails', async () => {
      mockSupabaseFrom.mockReturnValueOnce({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockResolvedValueOnce({ data: null, error: { message: 'Supabase select error' } });
      const res = await agent.get('/api/listings');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error fetching listings');
    });
  });

  describe('POST /api/listings', () => {
    const newListingData: CreateListingPayload = {
      title: 'Supertest New Item',
      description: 'This is a test item created by Supertest!',
      price: 199.99,
      email: 'supertest@example.com',
    };

    it('should create a new listing with valid data and return 201 status', async () => {
      const createdListing = { ...newListingData, id: 'mock-id-123' };
      // Mock for from('...').insert('...').select()
      mockSupabaseFrom.mockReturnValueOnce({ insert: mockSupabaseInsert });
      mockSupabaseInsert.mockReturnValueOnce({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockResolvedValueOnce({ data: [createdListing], error: null });

      const res = await agent
        .post('/api/listings')
        .send(newListingData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdListing);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('listings');
      expect(mockSupabaseInsert).toHaveBeenCalledWith([newListingData]);
      expect(mockSupabaseSelect).toHaveBeenCalled();
    });

    it('should return 400 status for invalid data (e.g., missing title)', async () => {
      const invalidData = {
        description: 'This item is missing a title',
        price: 10.00,
        email: 'invalid@supertest.com',
      };
      const res = await agent
        .post('/api/listings')
        .send(invalidData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid request data');
      expect(res.body).toHaveProperty('errors');
      expect(res.body.errors).toHaveProperty('title');
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
      mockSupabaseFrom.mockReturnValueOnce({ insert: mockSupabaseInsert });
      mockSupabaseInsert.mockReturnValueOnce({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockResolvedValueOnce({ data: null, error: { message: 'Supabase insert error' } });

      const res = await agent
        .post('/api/listings')
        .send(newListingData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error creating listing');
    });
  });
});
