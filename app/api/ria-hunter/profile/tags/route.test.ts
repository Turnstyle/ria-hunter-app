import { NextRequest } from 'next/server';
import { POST, GET } from './route';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(), // For checking existing tag
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

const MOCK_USER_ID = 'mock-user-id-123';
const MOCK_RIA_ID = 'test-ria-id-for-tags';

const mockTag = {
  id: 'test-tag-uuid-123',
  ria_id: MOCK_RIA_ID,
  user_id: MOCK_USER_ID,
  tag_text: 'Sample Tag',
  created_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/tags POST handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: tag doesn't exist, then insert is successful
    mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabaseClient.single.mockResolvedValue({ data: mockTag, error: null });
  });

  it('should create a new tag and return 201 with the tag data', async () => {
    const mockRequest = {
      json: async () => ({ ria_id: MOCK_RIA_ID, tag_text: 'Sample Tag' }),
      method: 'POST',
    } as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(mockTag);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_tags');
    expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('tag_text', 'Sample Tag'); // Duplicate check
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      ria_id: MOCK_RIA_ID,
      user_id: MOCK_USER_ID,
      tag_text: 'Sample Tag',
    });
  });

  it('should return 409 if the tag already exists (case-insensitive)', async () => {
    mockSupabaseClient.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-tag-uuid' }, error: null }); // Tag exists
    const mockRequest = {
      json: async () => ({ ria_id: MOCK_RIA_ID, tag_text: 'sample tag' }), // different case
      method: 'POST',
    } as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Tag already exists for this RIA by this user.');
    expect(body.tag_id).toBe('existing-tag-uuid');
  });

  it('should return 400 for invalid request body (e.g., missing tag_text)', async () => {
    const mockRequest = {
      json: async () => ({ ria_id: MOCK_RIA_ID }),
      method: 'POST',
    } as NextRequest;
    const response = await POST(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
    expect(body.issues[0].path).toContain('tag_text');
  });

  it('should handle Supabase errors during tag creation', async () => {
    mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null, error: null }); // Does not exist
    const supabaseError = { message: 'Supabase insert error for tag', code: '23505' };
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: supabaseError });
    const mockRequest = {
      json: async () => ({ ria_id: MOCK_RIA_ID, tag_text: 'Tag Fail' }),
      method: 'POST',
    } as NextRequest;
    const response = await POST(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create tag');
  });
});

describe('/api/ria-hunter/profile/tags GET handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.order.mockResolvedValue({ data: [mockTag, { ...mockTag, id: 'tag-uuid-456', tag_text: 'Another Tag' }], error: null });
  });

  it('should fetch and return tags for a given ria_id for the authenticated user', async () => {
    const mockRequest = {
      url: `http://localhost/api/ria-hunter/profile/tags?ria_id=${MOCK_RIA_ID}`,
      method: 'GET',
    } as NextRequest;

    const response = await GET(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.length).toBe(2);
    expect(body[0]).toEqual(mockTag);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_tags');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('ria_id', MOCK_RIA_ID);
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
    expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('should return 400 if ria_id query parameter is missing', async () => {
    const mockRequest = {
      url: 'http://localhost/api/ria-hunter/profile/tags',
      method: 'GET',
    } as NextRequest;
    const response = await GET(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
  });

  it('should handle Supabase errors during tag fetching', async () => {
    const supabaseError = { message: 'Supabase select error for tags', code: '50000' };
    mockSupabaseClient.order.mockResolvedValueOnce({ data: null, error: supabaseError });
    const mockRequest = {
      url: `http://localhost/api/ria-hunter/profile/tags?ria_id=ria-id-error`,
      method: 'GET',
    } as NextRequest;
    const response = await GET(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch tags');
  });
});
