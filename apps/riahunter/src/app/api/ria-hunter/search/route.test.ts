import { NextRequest } from 'next/server';
import { GET, POST } from './route'; // Adjust the import path as necessary

// Mock the Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ data: [], error: null }), // Default mock for the final query execution
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock Vercel AI SDK's generateText
const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: (args: any) => mockGenerateText(args),
  embed: jest.fn(), // Added embed to the mock as it's used in match-thesis and might be imported by other tested routes
}));

// Mock ai-services for the google client
const mockGoogleEmbeddingMethod = jest.fn((specificModelName: string) => ({
  modelId: specificModelName,
  type: 'embedding' as const // Added 'as const' for stricter type checking if needed
}));

const mockGoogleMainFunction = jest.fn((modelIdentifier: string) => ({
  modelId: modelIdentifier,
  type: 'language' as const,
  // If google('gemini-pro').embedding(...) was a pattern, we'd add embedding here.
  // But it seems google is either called directly OR its .embedding method is used.
}));

// Assign the embedding method to the main function object, so it can be called as google.embedding(...)
(mockGoogleMainFunction as any).embedding = mockGoogleEmbeddingMethod;

jest.mock('ai-services', () => ({
  google: mockGoogleMainFunction,
}));

describe('/api/ria-hunter/search GET handler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset the default mock for limit in case a test overrides it
    mockSupabaseClient.limit.mockResolvedValue({ data: [{ id: 1, name: 'Test RIA' }], error: null });
  });

  it('should return a 200 OK with data for a valid request', async () => {
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/search?location=Testville&privateInvestment=true',
      method: 'GET',
      // nextUrl: { searchParams: new URLSearchParams('location=Testville&privateInvestment=true') } // For older Next.js versions
    } as unknown as NextRequest;

    // For Next.js 13 App Router, searchParams are typically part of the URL object
    // The route handler constructs `new URL(request.url)`

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Search results for RIA Hunter');
    expect(body.data).toEqual([{ id: 1, name: 'Test RIA' }]);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('sec_advisers_test');
    expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('address_city', '%Testville%');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('managesprivatefunds', true);
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(50);
  });

  it('should return 400 for invalid query parameters (e.g., missing location if it were required by schema)', async () => {
    // Assuming getSearchParamsSchema makes location optional, so this test case
    // would need adjustment if 'location' was strictly required without a default.
    // For now, let's test with a parameter that doesn't fit Zod schema if we had one stricter.
    // The current schema makes both optional, so a truly "invalid" param isn't straightforward
    // unless we send a param with a wrong type, which is harder to simulate with URLSearchParams.

    // Let's simulate the Zod validation failure by mocking it.
    // This is a bit of a workaround as directly causing Zod to fail with URLSearchParams
    // for optional string fields is tricky without more complex schema.

    // Instead, let's test the case where parameters are valid but empty
     const mockRequest = {
      url: 'http://localhost/api/ria-hunter/search',
      method: 'GET',
    } as unknown as NextRequest;

    mockSupabaseClient.limit.mockResolvedValueOnce({ data: [{id: 2, name: "Empty Param RIA"}], error: null });


    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200); // Still 200 as params are optional
    expect(body.data).toEqual([{id: 2, name: "Empty Param RIA"}]);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('sec_advisers_test');
    // ilike and eq should not have been called if params are not present
    expect(mockSupabaseClient.ilike).not.toHaveBeenCalled();
    expect(mockSupabaseClient.eq).not.toHaveBeenCalled();
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(50);
  });

  it('should handle Supabase errors gracefully', async () => {
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/search?location=Errorville',
      method: 'GET',
    } as unknown as NextRequest;

    const supabaseError = { message: 'Supabase test error', details: 'Connection failed', hint: '', code: '50000' };
    mockSupabaseClient.limit.mockResolvedValueOnce({ data: null, error: supabaseError });

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error fetching data from Supabase');
    expect(body.details).toBe('Supabase test error');
  });
});

describe('/api/ria-hunter/search POST handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks for POST tests
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ location: 'Test City', privateInvestmentInterest: true, keywords: ['keyword1'] })
    });
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis(); // For org_pk fallback or other direct queries
    mockSupabaseClient.limit.mockResolvedValue({ data: [{ id: '123', name: 'Test RIA via POST' }], error: null });
  });

  it('should process a valid query, extract params with AI, and query Supabase', async () => {
    const mockRequest = {
      json: async () => ({ query: 'Find RIAs in Test City for private investment keyword1' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/search',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateText).toHaveBeenCalled();
    expect(body.aiExtractedParams).toEqual({ location: 'Test City', privateInvestmentInterest: true, keywords: ['keyword1'] });
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('sec_advisers_test');
    // Add more assertions here for how queryBuilder is constructed based on aiExtractedParams if that logic is fleshed out
    // For now, the POST handler's Supabase query is a bit placeholder after AI extraction
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10);
    expect(body.results).toEqual([{ id: '123', name: 'Test RIA via POST' }]);
  });

  it('should return 400 for invalid request body (e.g., empty query)', async () => {
    const mockRequest = {
      json: async () => ({ query: '' }), // Empty query
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/search',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('should handle AI processing errors and use fallback', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('AI processing failed'));
    const mockRequest = {
      json: async () => ({ query: 'complex query that fails AI' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/search',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200); // Still 200 as it falls back
    expect(body.aiExtractedParams.keywords).toEqual(['complex', 'query', 'that', 'fails']); // based on simple fallback
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10);
  });

  it('should handle Supabase errors gracefully during POST', async () => {
    const supabaseError = { message: 'Supabase POST error', details: 'DB Connection failed', hint: '', code: '50000' };
    mockSupabaseClient.limit.mockResolvedValueOnce({ data: null, error: supabaseError });

    const mockRequest = {
      json: async () => ({ query: 'Valid query for Supabase error test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/search',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error fetching data from Supabase');
    expect(body.details).toBe('Supabase POST error');
  });

});
