import supertest from 'supertest';
import http from 'http';
import { Readable } from 'stream';
import * as individualListingApi from './route';
import { UpdateListingPayload } from '@appfoundation/schemas';
import { NextRequest } from 'next/server';

// Existing mock IDs from the route file
const MOCK_EXISTING_ID = '2d44393c-45e3-492c-8292-0d4bb42651b1';
const MOCK_EXISTING_ID_2 = 'a81b5b8e-7cbe-4f89-8915-2b592969c6b2';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const INVALID_ID_FORMAT = 'not-a-uuid';

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
  let server: http.Server;
  let request: supertest.SuperAgentTest;

  beforeAll((done) => {
    server = http.createServer(async (req, res) => {
      const webReq = await toWebRequest(req);
      const url = req.url || '';
      const method = req.method;

      const idMatch = url.match(new RegExp(`^${API_BASE_PATH}/([a-zA-Z0-9-]+)$`));

      if (idMatch) {
        const id = idMatch[1];
        const context = { params: { id } };
        try {
          if (method === 'GET') {
            const nextRes = await individualListingApi.GET(webReq as any, context as any);
            await sendNextResponse(res, nextRes);
          } else if (method === 'PUT') {
            const nextRes = await individualListingApi.PUT(webReq as any, context as any);
            await sendNextResponse(res, nextRes);
          } else if (method === 'DELETE') {
            const nextRes = await individualListingApi.DELETE(webReq as any, context as any);
            await sendNextResponse(res, nextRes);
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
          }
        } catch (err) {
          console.error('Handler error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error in Test Harness');
        }
      } else {
        res.statusCode = 404;
        res.end('Not Found in Test Harness');
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

  describe('GET /api/listings/[id]', () => {
    it('should return the listing for a valid ID with 200 status', async () => {
      const res = await request.get(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', MOCK_EXISTING_ID);
      expect(res.body).toHaveProperty('title');
    });

    it('should return 404 for a non-existent ID', async () => {
      const res = await request.get(`${API_BASE_PATH}/${NON_EXISTENT_ID}`);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Listing not found');
    });

    it('should return 400 for an invalid ID format', async () => {
      const res = await request.get(`${API_BASE_PATH}/${INVALID_ID_FORMAT}`);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Invalid ID format');
      expect(res.body.errors).toHaveProperty('id');
    });
  });

  describe('PUT /api/listings/[id]', () => {
    const updateData: UpdateListingPayload = {
      title: 'Updated Supertest Anvil Title',
      price: 199.99,
    };

    it('should update the listing for a valid ID and data, returning 200 status', async () => {
      const res = await request
        .put(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`)
        .send(updateData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(MOCK_EXISTING_ID);
      expect(res.body.data.title).toBe(updateData.title);
      expect(res.body.data.price).toBe(updateData.price);
    });

    it('should return 400 for invalid update data', async () => {
      const invalidUpdateData = { price: -50 };
      const res = await request
        .put(`${API_BASE_PATH}/${MOCK_EXISTING_ID}`)
        .send(invalidUpdateData)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('price');
    });

    it('should return 404 when trying to update a non-existent ID', async () => {
      const res = await request
        .put(`${API_BASE_PATH}/${NON_EXISTENT_ID}`)
        .send(updateData)
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/listings/[id]', () => {
    it('should delete the listing for a valid ID and return 200 status', async () => {
      const res = await request.delete(`${API_BASE_PATH}/${MOCK_EXISTING_ID_2}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Listing deleted successfully');
    });

    it('should return 404 when trying to delete a non-existent ID', async () => {
      const res = await request.delete(`${API_BASE_PATH}/${NON_EXISTENT_ID}`);
      expect(res.status).toBe(404);
    });
  });
});
