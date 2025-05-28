import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue({ data: [], error: null }), // Default for narrative fetch
};
jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock Vercel AI SDK's embed function
const mockEmbed = jest.fn();
jest.mock('ai', () => ({
  embed: (args: any) => mockEmbed(args),
  generateText: jest.fn(), // Also mock generateText as it's a common import
}));

// Mock ai-services for the google client, similar to the search route tests
const mockGoogleEmbeddingMethod = jest.fn((specificModelName: string) => ({
  modelId: specificModelName,
  type: 'embedding' as const
}));
const mockGoogleMainFunction = jest.fn(); // This won't be called directly for embeddings in match-thesis
(mockGoogleMainFunction as any).embedding = mockGoogleEmbeddingMethod;
jest.mock('ai-services', () => ({
  google: mockGoogleMainFunction,
}));

// Mock ChromaClient
const mockChromaCollection = {
  query: jest.fn().mockResolvedValue({ ids: [[]], distances: [[]], metadatas: [[]], documents: [[]] }), // Default empty successful query
};
const mockChromaClient = {
  getCollection: jest.fn().mockResolvedValue(mockChromaCollection),
  // Add other ChromaClient methods if used directly e.g., createCollection, listCollections
};
jest.mock('vector-store', () => ({
  chromaClient: mockChromaClient,
}));

// Mock Sentry
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

describe('/api/ria-hunter/match-thesis POST handler', () => {
  // Mock console methods for this describe block
  let originalConsoleLog: any, originalConsoleWarn: any;
  beforeAll(() => {
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    console.log = jest.fn();
    console.warn = jest.fn();
  });
  afterAll(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for successful embedding
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
    // Default mock for successful narrative fetch
    mockSupabaseClient.select.mockResolvedValue({
      data: [
        { ria_id: '1', narrative_text: 'This narrative mentions investment and strategy.' },
        { ria_id: '2', narrative_text: 'Another one focusing on private equity.' },
      ],
      error: null
    });
    // Default for successful Chroma query
    mockChromaCollection.query.mockResolvedValue({
      ids: [[ 'chroma_ria_1', 'chroma_ria_2' ]],
      distances: [[0.1, 0.2]],
      // documents: [[ {text: "doc1"}, {text: "doc2"} ]],
      // metadatas: [[ {source: "s1"}, {source: "s2"} ]],
    });
    mockChromaClient.getCollection.mockResolvedValue(mockChromaCollection);
    // Restore the original mock for other tests
    jest.doMock('ai-services', () => ({
        google: mockGoogleMainFunction,
    }));
    // It's important to reset the module cache if re-importing is essential for the mock to apply
    // jest.resetModules(); // Or handle module state more carefully if this causes issues
  });

  it('should process a valid thesis, perform keyword and semantic search, and return results', async () => {
    const mockRequest = {
      json: async () => ({ thesisText: 'Looking for investment strategy in private equity' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Investment Thesis Matcher results');
    expect(body.receivedThesis).toBe('Looking for investment strategy in private equity');

    // AI Embedding mocks
    expect(mockEmbed).toHaveBeenCalled();
    expect(body.thesisEmbedding).toEqual([0.1, 0.2, 0.3]);
    expect(body.embeddingModel).toBe('google:models/text-embedding-004');

    // Keyword extraction and matching
    expect(body.extractedKeywords).toEqual(expect.arrayContaining(['looking', 'investment', 'strategy', 'private', 'equity']));
    expect(body.keywordMatches.length).toBeGreaterThanOrEqual(1);
    expect(body.keywordMatches[0].ria_id).toBeDefined();
    expect(body.keywordMatches[0].matched_keywords.length).toBeGreaterThanOrEqual(1);

    // Supabase call for narratives
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('ria_narratives');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('ria_id, narrative_text');

    // ChromaDB semantic search mocks
    expect(mockChromaClient.getCollection).toHaveBeenCalledWith({ name: 'ria_narratives_embeddings' });
    expect(mockChromaCollection.query).toHaveBeenCalled();
    expect(body.semanticMatches.length).toBe(2);
    expect(body.semanticMatches[0].ria_id).toBe('chroma_ria_1');
    expect(body.semanticMatches[0].score).toBeCloseTo(0.9); // 1 - distance

    expect(body.embeddingError).toBeUndefined();
    expect(body.semanticSearchError).toBeUndefined();
  });

  it('should return 400 if thesisText is too short', async () => {
    const mockRequest = {
      json: async () => ({ thesisText: 'short' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
    expect(body.issues[0].message).toBe('Thesis text must be at least 10 characters long');
  });

  it('should handle cases where no keywords are extracted', async () => {
    const mockRequest = {
      json: async () => ({ thesisText: 'a an the of' }), // only stop words
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200); // The route currently returns 200 with a specific message
    expect(body.message).toBe('No significant keywords extracted from thesis. Please provide a more specific thesis.');
    expect(body.keywords).toEqual([]);
  });

  it('should handle errors during thesis embedding generation', async () => {
    mockEmbed.mockRejectedValueOnce(new Error('Embedding failed'));
    const mockRequest = {
      json: async () => ({ thesisText: 'Valid thesis for embedding failure test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200); // Still 200 but with error reported in body
    expect(body.embeddingError).toBe('Embedding failed');
    expect(body.thesisEmbedding).toBeUndefined();
    // Semantic search should be skipped and an error message should reflect that
    expect(body.semanticSearchError).toContain('Semantic search skipped due to embedding error: Embedding failed');
  });

  it('should handle Supabase errors when fetching narratives', async () => {
    const supabaseError = { message: 'Supabase narrative fetch error', details: 'DB Connection issue', hint: '', code: '50000' };
    mockSupabaseClient.select.mockResolvedValueOnce({ data: null, error: supabaseError });
    const mockRequest = {
      json: async () => ({ thesisText: 'Valid thesis for Supabase error test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Error fetching narrative data from Supabase');
    expect(body.details).toBe(supabaseError.message);
  });

  it('should handle errors during ChromaDB semantic search (e.g., collection not found)', async () => {
    mockChromaClient.getCollection.mockRejectedValueOnce(new Error('CollectionNotFound: Collection ria_narratives_embeddings not found'));
    const mockRequest = {
      json: async () => ({ thesisText: 'Valid thesis for ChromaDB error test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200); // Main operation doesn't fail, error is in the body
    expect(body.semanticSearchError).toContain('Chroma collection \'ria_narratives_embeddings\' not found');
    expect(body.semanticMatches).toEqual([]);
  });

  it('should handle general errors in ChromaDB query', async () => {
    mockChromaCollection.query.mockRejectedValueOnce(new Error('Chroma query failed'));
    const mockRequest = {
      json: async () => ({ thesisText: 'Valid thesis for Chroma query error' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.semanticSearchError).toBe('Chroma query failed');
    expect(body.semanticMatches).toEqual([]);
  });

  it('should return gracefully if no keywords are extracted', async () => {
    const mockRequest = {
      json: async () => ({ thesisText: 'is an of the' }), // Only stop words
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('No significant keywords extracted from thesis. Please provide a more specific thesis.');
    expect(body.keywords).toEqual([]);
    expect(body.matches).toEqual([]);
    // Embedding should still be attempted
    expect(mockEmbed).toHaveBeenCalled();
  });

  it('should return gracefully if no narratives are found in Supabase', async () => {
    mockSupabaseClient.select.mockResolvedValueOnce({ data: [], error: null });
    const mockRequest = {
      json: async () => ({ thesisText: 'Valid thesis, but no narratives in DB' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('No narratives found in the database to match against.');
    expect(body.matches).toEqual([]);
    expect(mockEmbed).toHaveBeenCalled();
  });

  it('should perform semantic search if embedding is generated and return semantic matches', async () => {
    const mockRequest = {
      json: async () => ({ thesisText: 'Thesis for semantic search test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockEmbed).toHaveBeenCalled();
    expect(body.thesisEmbedding).toBeDefined();
    expect(mockChromaClient.getCollection).toHaveBeenCalledWith({ name: 'ria_narratives_embeddings' });
    expect(mockChromaCollection.query).toHaveBeenCalledWith({ queryEmbeddings: [body.thesisEmbedding], nResults: 10 });
    expect(body.semanticMatches).toHaveLength(2);
    expect(body.semanticMatches[0].ria_id).toBe('chroma_ria_1');
    expect(body.semanticMatches[0].score).toBeCloseTo(0.9); // 1 - 0.1
    expect(body.semanticSearchError).toBeUndefined();
  });

  it('should handle no results from Chroma query', async () => {
    mockChromaCollection.query.mockResolvedValueOnce({ ids: [[]], distances: [[]], documents: [[]], metadatas: [[]] });
    const mockRequest = {
      json: async () => ({ thesisText: 'Thesis no chroma results test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.semanticMatches).toEqual([]);
    expect(body.semanticSearchError).toBeUndefined(); // No error, just no matches
    expect(console.log).toHaveBeenCalledWith('No semantic matches found in Chroma for the given thesis.');
  });

  it('should skip semantic search if embedding generation failed', async () => {
    mockEmbed.mockRejectedValueOnce(new Error('Embedding generation failed for this test'));
    const mockRequest = {
      json: async () => ({ thesisText: 'Thesis embedding failure test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.thesisEmbedding).toBeUndefined();
    expect(body.embeddingError).toBe('Embedding generation failed for this test');
    expect(body.semanticSearchError).toContain('Semantic search skipped due to embedding error');
    expect(mockChromaClient.getCollection).not.toHaveBeenCalled();
  });

  it('should skip semantic search if Google AI client is not available (no embedding generated)', async () => {
    const tempGoogle = jest.requireActual('ai-services').google;
    jest.doMock('ai-services', () => ({
        google: undefined, // Simulate Google client being undefined
    }));

    // Need to re-import POST or reload the module for the mock to take effect if it's cached
    // For simplicity, this test might need to be in a separate file or use advanced Jest module mocking
    // Or, ensure the ai-services mock is consistently applied if `google` is checked at the start of POST.
    // Current POST checks `if (google)` then `if(thesisEmbedding)`.
    // If `google` is undefined, `thesisEmbedding` will be undefined and `embeddingError` set.

    const mockRequest = {
      json: async () => ({ thesisText: 'No Google client available for test' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/match-thesis',
    } as unknown as NextRequest;

    // We need to re-evaluate the route with the modified mock.
    // This is tricky with Jest's default module caching.
    // A simple way is to just test the outcome given `embeddingError` will be set.
    mockEmbed.mockImplementationOnce(async () => {
        // This won't be called if `google` is effectively undefined before embed call.
        // The route structure: if(google) { try { embed } } else { embeddingError = ... }
        // So if `google` is mocked as undefined, the `else` block for embeddingError will be hit.
        throw new Error('This should not be called if google client is mocked as undefined at module level for the route');
     });

    const { POST: POST_for_no_google_test } = await import('./route'); // Re-import to get fresh module with mock (if Jest setup allows)

    const response = await POST_for_no_google_test(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.thesisEmbedding).toBeUndefined();
    expect(body.embeddingError).toBe('Google AI client not available for embeddings.');
    expect(body.semanticSearchError).toBe('Semantic search skipped: No thesis embedding available.');
    expect(mockChromaClient.getCollection).not.toHaveBeenCalled();

    // Restore the original mock for other tests
    jest.doMock('ai-services', () => ({
        google: mockGoogleMainFunction,
    }));
  });

});
