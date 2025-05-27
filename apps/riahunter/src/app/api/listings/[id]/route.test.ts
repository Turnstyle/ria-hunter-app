import supertest, { SuperTest, Test } from 'supertest';
import http from 'http';
import { Readable } from 'stream';
import { GET as actualGET, PUT as actualPUT, DELETE as actualDELETE } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AxiomRequest, withAxiom } from 'next-axiom';
import { Logger } from 'next-axiom';
import { IdSchema, UpdateListingSchema } from '@appfoundation/schemas';

// Define a type for the handlers
type AppRouteHandler = (req: NextRequest | AxiomRequest, context: { params: { id: string } }) => Promise<NextResponse>;

// Cast the imported handlers
const GET: AppRouteHandler = actualGET as unknown as AppRouteHandler;
const PUT: AppRouteHandler = actualPUT as unknown as AppRouteHandler;
const DELETE: AppRouteHandler = actualDELETE as unknown as AppRouteHandler;

// Mock Supabase
const mockSupabaseFrom = jest.fn().mockReturnThis();
const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn().mockReturnThis();
const mockSupabaseDelete = jest.fn().mockReturnThis();
const mockSupabaseEq = jest.fn().mockReturnThis(); // For .eq()
const mockSupabaseSingle = jest.fn(); // For .single()

jest.mock('@appfoundation/supabase/server', () => ({
  getServerSupabaseClient: () => ({
    from: mockSupabaseFrom,
    select: mockSupabaseSelect,
    update: mockSupabaseUpdate,
    delete: mockSupabaseDelete,
    eq: mockSupabaseEq,
    single: mockSupabaseSingle,
  }),
}));

// Existing mock IDs from the route file
const MOCK_EXISTING_ID = '2d44393c-45e3-492c-8292-0d4bb42651b1';
const MOCK_EXISTING_ID_2 = 'a81b5b8e-7cbe-4f89-8915-2b592969c6b2';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const INVALID_ID_FORMAT = 'not-a-uuid';

// Helper to convert Node.js IncomingMessage to a Web API Request object
async function toWebRequest(nodeReq: http.IncomingMessage): Promise<NextRequest> {
  const { method, url, headers } = nodeReq;
  const controller = new AbortController();
  nodeReq.on('close', () => controller.abort());

  let body: ReadableStream<Uint8Array> | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    body = Readable.toWeb(nodeReq) as ReadableStream<Uint8Array>;
  }
  const fullUrl = new URL(url || '/', 'http://localhost');
  return new NextRequest(fullUrl.toString(), {
    method: method || 'GET',
    headers: new Headers(headers as HeadersInit),
    body,
    signal: controller.signal,
    // @ts-ignore
    log: console,
  });
}

// Helper to send a NextResponse via http.ServerResponse
async function sendNextResponse(res: http.ServerResponse, nextRes: Response): Promise<void> {
  res.statusCode = nextRes.status;
  nextRes.headers.forEach((val, key) => {
    res.setHeader(key, val);
  });
  if (nextRes.body) {
    const reader = nextRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

const API_BASE_PATH = '/api/listings';

describe('API - /api/listings/[id] (supertest)', () => {
  let agent: any; // Using any to bypass persistent type issue
  let server: http.Server;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockSupabaseFrom.mockReturnThis();
    mockSupabaseSelect.mockReturnThis(); // from().select() itself returns the chainable object
    mockSupabaseUpdate.mockReturnThis();
    mockSupabaseDelete.mockReturnThis();
    mockSupabaseEq.mockReturnThis();
    mockSupabaseSingle.mockReset(); // This is often the one returning the final data/error
  });

  beforeAll((done) => {
    server = http.createServer(async (req, res) => {
      const webReq = await toWebRequest(req);
      const idMatch = req.url?.match(/\/api\/listings\/(.+)/);
      const id = idMatch ? idMatch[1] : null;
      try {
        if (id) {
          if (req.method === 'GET') {
            await sendNextResponse(res, await GET(webReq, { params: { id } }));
          } else if (req.method === 'PUT') {
            await sendNextResponse(res, await PUT(webReq, { params: { id } }));
          } else if (req.method === 'DELETE') {
            await sendNextResponse(res, await DELETE(webReq, { params: { id } }));
          } else {
            res.statusCode = 405; res.end('Method Not Allowed');
          }
        } else {
          res.statusCode = 404; res.end('Not Found - No ID in Test Harness');
        }
      } catch (err) {
        console.error('Error in test server request handling:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Test harness server error' }));
        } else if (!res.writableEnded) {
          res.end();
        }
      }
    });
    server.listen(() => {
      agent = supertest(server);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/listings/[id]', () => {
    it('should return the listing for a valid ID with 200 status', async () => {
      const mockListing = { id: MOCK_EXISTING_ID, title: 'Test Anvil', price: 99.99 };
      mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
      mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
      mockSupabaseSingle.mockResolvedValue({ data: mockListing, error: null });

      const res = await agent.get(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockListing);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('listings');
      expect(mockSupabaseEq).toHaveBeenCalledWith('id', MOCK_EXISTING_ID);
      expect(mockSupabaseSingle).toHaveBeenCalled();
    });

    it('should return 404 for a non-existent ID', async () => {
      mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
      mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
      mockSupabaseSingle.mockResolvedValue({ data: null, error: null }); // Simulate not found

      const res = await agent.get(`${API_BASE_PATH}/${NON_EXISTENT_ID}`);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Listing not found');
    });

    it('should return 400 for an invalid ID format (not UUID)', async () => {
      const res = await agent.get(`${API_BASE_PATH}/not-a-uuid`);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid ID format');
      expect(res.body.errors).toHaveProperty('id');
    });

    it('should return 500 if supabase select fails', async () => {
      mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
      mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
      mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
      mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: 'Supabase error' } });

      const res = await agent.get(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`);
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Error fetching listing');
    });
  });

  describe('PUT /api/listings/[id]', () => {
    const updateData = { title: 'Updated Supertest Anvil Title', price: 199.99 };

    it('should update the listing for a valid ID and data, returning 200 status', async () => {
      const updatedListing = { id: MOCK_EXISTING_ID, ...updateData };
      mockSupabaseFrom.mockReturnValue({ update: mockSupabaseUpdate });
      mockSupabaseUpdate.mockReturnValue({ eq: mockSupabaseEq });
      mockSupabaseEq.mockReturnValue({ select: mockSupabaseSelect }); // .update().eq().select()
      // select() after update returns an array of updated records
      mockSupabaseSelect.mockResolvedValue({ data: [updatedListing], error: null });

      const res = await agent.put(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`).send(updateData);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(updatedListing);
    });

    it('should return 400 for invalid update data (e.g., negative price)', async () => {
      const res = await agent.put(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`).send({ price: -50 });
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('price');
    });

    it('should return 404 when trying to update a non-existent ID', async () => {
      mockSupabaseFrom.mockReturnValue({ update: mockSupabaseUpdate });
      mockSupabaseUpdate.mockReturnValue({ eq: mockSupabaseEq });
      mockSupabaseEq.mockReturnValue({ select: mockSupabaseSelect });
      // Simulate not found for update target - select returns empty array
      mockSupabaseSelect.mockResolvedValue({ data: [], error: null });

      const res = await agent.put(`${API_BASE_PATH}/${NON_EXISTENT_ID}`).send(updateData);
      expect(res.status).toBe(404);
    });

     it('should return 500 if supabase update fails', async () => {
      mockSupabaseFrom.mockReturnValue({ update: mockSupabaseUpdate });
      mockSupabaseUpdate.mockReturnValue({ eq: mockSupabaseEq });
      // The select() part of the chain is where the error would manifest from Supabase
      mockSupabaseEq.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Supabase update error' } })
      });

      const res = await agent.put(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`).send(updateData);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/listings/[id]', () => {
    it('should delete the listing for a valid ID and return 200 status', async () => {
      mockSupabaseFrom.mockReturnValue({ delete: mockSupabaseDelete });
      mockSupabaseDelete.mockReturnValue({ eq: mockSupabaseEq });
      // Successful delete returns count: 1 (or more if multiple matched, though ID is unique)
      mockSupabaseEq.mockResolvedValue({ error: null, count: 1 });

      const res = await agent.delete(`${API_BASE_PATH}/${MOCK_EXISTING_ID_2}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Listing deleted successfully');
    });

    it('should return 404 when trying to delete a non-existent ID', async () => {
      mockSupabaseFrom.mockReturnValue({ delete: mockSupabaseDelete });
      mockSupabaseDelete.mockReturnValue({ eq: mockSupabaseEq });
      // Non-existent ID means delete operation affects 0 rows, no error.
      mockSupabaseEq.mockResolvedValue({ error: null, count: 0 });

      const res = await agent.delete(`${API_BASE_PATH}/${NON_EXISTENT_ID}`);
      expect(res.status).toBe(404);
    });

    it('should return 500 if supabase delete fails generically', async () => {
      mockSupabaseFrom.mockReturnValue({ delete: mockSupabaseDelete });
      mockSupabaseDelete.mockReturnValue({ eq: mockSupabaseEq });
      // Simulate a generic Supabase error during delete
      mockSupabaseEq.mockResolvedValue({ error: { message: 'Generic Supabase delete error' }, count: null });

      const res = await agent.delete(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`);
      expect(res.status).toBe(500);
    });

  });
});
