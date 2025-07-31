import { NextRequest } from 'next/server';
import { POST, GET } from './route';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(), // For checking existing link URL
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

const MOCK_USER_ID = 'mock-user-id-123';
const MOCK_RIA_ID_FOR_LINKS = 'test-ria-id-for-links';

const mockLink = {
  id: 'test-link-uuid-123',
  ria_id: MOCK_RIA_ID_FOR_LINKS,
  user_id: MOCK_USER_ID,
  link_url: 'https://example.com/some-link',
  link_description: 'A sample link description',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/links POST handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null, error: null }); // Default: link doesn't exist
    mockSupabaseClient.single.mockResolvedValue({ data: mockLink, error: null }); // Default: insert successful
  });

  it('should create a new link and return 201 with link data', async () => {
    const mockRequest = {
      json: async () => ({
        ria_id: MOCK_RIA_ID_FOR_LINKS,
        link_url: 'https://example.com/some-link',
        link_description: 'A sample link description',
      }),
      method: 'POST',
    } as NextRequest;

    const response = await POST(mockRequest);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(mockLink);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_links');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('link_url', 'https://example.com/some-link'); // Duplicate check
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
      ria_id: MOCK_RIA_ID_FOR_LINKS,
      user_id: MOCK_USER_ID,
      link_url: 'https://example.com/some-link',
      link_description: 'A sample link description',
    });
  });

  it('should return 409 if the link URL already exists for this user/RIA', async () => {
    mockSupabaseClient.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-link-uuid' }, error: null });
    const mockRequest = {
      json: async () => ({
        ria_id: MOCK_RIA_ID_FOR_LINKS,
        link_url: 'https://example.com/some-link',
        link_description: 'Another desc'
      }),
      method: 'POST',
    } as NextRequest;
    const response = await POST(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toBe('This URL has already been added for this RIA by you.');
  });

  it('should return 400 for invalid request body (e.g., invalid URL)', async () => {
    const mockRequest = {
      json: async () => ({ ria_id: MOCK_RIA_ID_FOR_LINKS, link_url: 'not-a-url' }),
      method: 'POST',
    } as NextRequest;
    const response = await POST(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
    expect(body.issues[0].message).toBe('Valid URL is required');
  });
});

describe('/api/ria-hunter/profile/links GET handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.order.mockResolvedValue({
      data: [mockLink, { ...mockLink, id: 'link-uuid-456', link_url: 'https://example.com/another' }],
      error: null
    });
  });

  it('should fetch and return links for a given ria_id for the authenticated user', async () => {
    const mockRequest = {
      url: `http://localhost/api/ria-hunter/profile/links?ria_id=${MOCK_RIA_ID_FOR_LINKS}`,
      method: 'GET',
    } as NextRequest;
    const response = await GET(mockRequest);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.length).toBe(2);
    expect(body[0]).toEqual(mockLink);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_links');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('ria_id', MOCK_RIA_ID_FOR_LINKS);
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
  });
});
