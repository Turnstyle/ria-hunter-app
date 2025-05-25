import supertest from 'supertest';
import http from 'http';
import { Readable } from 'stream';
import * as listingsApi from './route';
import { CreateListingPayload } from '@appfoundation/schemas';
import { NextRequest, NextResponse } from 'next/server';

// Helper to convert Node.js IncomingMessage to a Web API Request object
async function toWebRequest(nodeReq: http.IncomingMessage): Promise<Request> {
  const { method, url, headers } = nodeReq;
  const controller = new AbortController();
  nodeReq.on('close', () => controller.abort());

  let body: ReadableStream<Uint8Array> | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    body = Readable.toWeb(nodeReq) as ReadableStream<Uint8Array>;
  }

  const fullUrl = new URL(url || '/', 'http://localhost');

  return new NextRequest(fullUrl.toString(), {
    method: method || 'GET', // Provide default for method
    headers: new Headers(headers as HeadersInit),
    body,
    signal: controller.signal,
    // @ts-ignore // Axiom specific, might not be needed for basic NextRequest
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
  let server: http.Server;
  let request: supertest.SuperAgentTest;

  beforeAll((done) => {
    server = http.createServer(async (req, res) => {
      const webReq = await toWebRequest(req);
      try {
        if (req.url === '/api/listings' && req.method === 'GET') {
          const nextRes = await listingsApi.GET(webReq as any, { params: {} } as any);
          await sendNextResponse(res, nextRes);
        } else if (req.url === '/api/listings' && req.method === 'POST') {
          const nextRes = await listingsApi.POST(webReq as any, { params: {} } as any);
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
          if (!res.writableEnded) res.end(); // Attempt to end if headers sent but not ended
        }
      }
    });
    server.listen(() => {
      const port = (server.address() as import('net').AddressInfo).port;
      request = supertest(server);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/listings', () => {
    it('should return all listings with a 200 status', async () => {
      const res = await request.get('/api/listings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/listings', () => {
    it('should create a new listing with valid data and return 201 status', async () => {
      const newListingData: CreateListingPayload = {
        title: 'Supertest New Item',
        description: 'This is a test item created by Supertest!',
        price: 199.99,
        email: 'supertest@example.com',
      };

      const res = await request
        .post('/api/listings')
        .send(newListingData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(newListingData.title);
      expect(res.body.price).toBe(newListingData.price);
      expect(res.body.email).toBe(newListingData.email);
    });

    it('should return 400 status for invalid data (e.g., missing title)', async () => {
      const invalidData = {
        description: 'This item is missing a title',
        price: 10.00,
        email: 'invalid@supertest.com',
      };
      const res = await request
        .post('/api/listings')
        .send(invalidData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid request data');
      expect(res.body).toHaveProperty('errors');
      expect(res.body.errors).toHaveProperty('title');
    });

    it('should return 400 status for invalid JSON payload', async () => {
      const res = await request
        .post('/api/listings')
        .send('{\"title\": \"Unfinished JSON') // Sending malformed JSON string
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid JSON payload');
    });
  });
});
