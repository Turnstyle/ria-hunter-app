import { NextRequest } from 'next/server';
import { POST, GET } from './route'; // Adjust if your file structure is different

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(), // For POST response
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock Sentry
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

// Mock the getAuthenticatedUserId function (if it's in the same file or importable)
// If it's internally defined and not exported, this approach needs adjustment
// For this example, assuming it might be refactored to be importable or we mock the module containing it.
// Since it's simple and in the route file, direct mocking is harder without changing source or complex jest.mock setups.
// Let's assume for testing, the route file is structured to allow mocking or uses an import.
// As a simple approach for now: the function in route.ts returns a fixed 'mock-user-id-123'. We'll rely on that for these tests.

const mockNote = {
  id: 'test-note-uuid-123',
  ria_id: 'test-ria-id-456',
  user_id: 'mock-user-id-123',
  note_content: 'This is a test note.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/notes POST handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.single.mockResolvedValue({ data: mockNote, error: null });
  });

  it('should create a new note and return 201 with the note data', async () => {
    const mockRequest = {
      json: async () => ({ ria_id: 'test-ria-id-456', note_content: 'This is a test note.' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/profile/notes',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(mockNote);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_notes');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      ria_id: 'test-ria-id-456',
      user_id: 'mock-user-id-123', // Relies on the hardcoded mock user ID in route
      note_content: 'This is a test note.',
    });
    expect(mockSupabaseClient.select).toHaveBeenCalled();
    expect(mockSupabaseClient.single).toHaveBeenCalled();
  });

  it('should return 400 for invalid request body (e.g., missing note_content)', async () => {
    const mockRequest = {
      json: async () => ({ ria_id: 'test-ria-id-456' }), // Missing note_content
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/profile/notes',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
    expect(body.issues[0].message).toBe('Note content cannot be empty');
  });

  it('should handle Supabase errors during note creation', async () => {
    const supabaseError = { message: 'Supabase insert error', details: 'DB constraint violation', hint: '', code: '23505' };
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: supabaseError });

    const mockRequest = {
      json: async () => ({ ria_id: 'test-ria-id-789', note_content: 'Note that will fail' }),
      method: 'POST',
      url: 'http://localhost/api/ria-hunter/profile/notes',
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create note');
    expect(body.details).toBe(supabaseError.message);
  });
});

describe('/api/ria-hunter/profile/notes GET handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for a successful GET returning a list of notes
    mockSupabaseClient.order.mockResolvedValue({ data: [mockNote, { ...mockNote, id: 'test-note-uuid-789' }], error: null });
  });

  it('should fetch and return notes for a given ria_id for the authenticated user', async () => {
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/profile/notes?ria_id=test-ria-id-456',
      method: 'GET',
    } as unknown as NextRequest;

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.length).toBe(2);
    expect(body[0]).toEqual(mockNote);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_notes');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('*');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('ria_id', 'test-ria-id-456');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'mock-user-id-123'); // Relies on hardcoded mock user
    expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('should return 400 if ria_id query parameter is missing', async () => {
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/profile/notes', // Missing ria_id
      method: 'GET',
    } as unknown as NextRequest;

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
    expect(body.issues[0].message).toBe('RIA ID is required as a query parameter');
  });

  it('should handle Supabase errors during note fetching', async () => {
    const supabaseError = { message: 'Supabase select error', details: 'DB connection timed out', hint: '', code: '50000' };
    mockSupabaseClient.order.mockResolvedValueOnce({ data: null, error: supabaseError });

    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/profile/notes?ria_id=test-ria-id-error',
      method: 'GET',
    } as unknown as NextRequest;

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch notes');
    expect(body.details).toBe(supabaseError.message);
  });

  it('should return an empty array if no notes are found for the user/ria_id', async () => {
    mockSupabaseClient.order.mockResolvedValueOnce({ data: [], error: null });
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/profile/notes?ria_id=test-ria-id-empty',
      method: 'GET',
    } as unknown as NextRequest;

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
