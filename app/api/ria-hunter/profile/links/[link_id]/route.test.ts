import { NextRequest } from 'next/server';
import { PUT, DELETE } from './route';

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(), // For checking duplicate URL on update excluding self
  single: jest.fn(),
  maybeSingle: jest.fn(), // For duplicate URL check on update
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

const MOCK_USER_ID = 'mock-user-id-123';
const MOCK_RIA_ID_FOR_LINK_DETAIL = 'ria-for-link-detail';

const mockExistingLink = {
  id: 'existing-link-uuid-777',
  ria_id: MOCK_RIA_ID_FOR_LINK_DETAIL,
  user_id: MOCK_USER_ID,
  link_url: 'https://example.com/original-link',
  link_description: 'Original link description',
  created_at: new Date(Date.now() - 200000).toISOString(),
  updated_at: new Date(Date.now() - 200000).toISOString(),
};

const mockUpdatedLink = {
  ...mockExistingLink,
  link_url: 'https://example.com/updated-link',
  link_description: 'Updated link description',
  updated_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/links/[link_id] PUT handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default for successful fetch of existing link, then no duplicate for new URL, then successful update
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingLink, error: null }); // Fetch existing
    mockSupabaseClient.maybeSingle.mockResolvedValueOnce({ data: null, error: null });      // No duplicate URL
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockUpdatedLink, error: null });  // Successful update result
  });

  it('should update an existing link and return 200 with updated data', async () => {
    const mockRequest = {
      json: async () => ({
        link_url: 'https://example.com/updated-link',
        link_description: 'Updated link description'
      }),
      method: 'PUT',
    } as NextRequest;

    const response = await PUT(mockRequest, { params: { link_id: mockExistingLink.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.link_url).toBe('https://example.com/updated-link');
    expect(body.link_description).toBe('Updated link description');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_links');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, user_id, link_url, ria_id'); // Initial fetch
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(expect.objectContaining({
      link_url: 'https://example.com/updated-link',
      link_description: 'Updated link description'
    }));
  });

  it('should return 409 if updated link_url conflicts with another existing link', async () => {
    mockSupabaseClient.single.mockReset(); // Reset beforeEach mocks
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingLink, error: null }); // Fetch existing ok
    mockSupabaseClient.maybeSingle.mockResolvedValueOnce({ data: {id: 'other-link-id'}, error: null }); // New URL is a duplicate

    const mockRequest = {
      json: async () => ({ link_url: 'https://example.com/conflicting-url' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('This URL is already in use');
  });

   it('should allow updating only description without URL conflict check', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingLink, error: null }); // Fetch existing ok
    // maybeSingle (duplicate check) should NOT be called if URL isn't changing or isn't provided
    mockSupabaseClient.single.mockResolvedValueOnce({ data: {...mockExistingLink, link_description: "Only desc updated"}, error: null }); // Update success

    const mockRequest = {
      json: async () => ({ link_description: 'Only desc updated' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.link_description).toBe('Only desc updated');
    expect(mockSupabaseClient.maybeSingle).not.toHaveBeenCalled(); // Crucial: no duplicate check for URL
  });

  it('should return 400 if neither link_url nor link_description is provided for update', async () => {
    const mockRequest = {
      json: async () => ({}), // Empty body
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues[0].message).toContain('At least link_url or link_description must be provided');
  });
});

describe('/api/ria-hunter/profile/links/[link_id] DELETE handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.single.mockResolvedValue({ data: mockExistingLink, error: null });
    mockSupabaseClient.delete.mockResolvedValue({ error: null });
  });

  it('should delete an existing link and return 204 No Content', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(204);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_links');
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingLink.id);
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
  });
  // Add other DELETE tests: invalid link_id, not found, not owner, Supabase error (similar to notes/tags)

  it('should return 400 for invalid link_id format on DELETE', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { link_id: 'invalid-link-id' } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid link ID format');
  });

  it('should return 404 if the link to delete is not found', async () => {
    mockSupabaseClient.single.mockReset(); // Clear beforeEach mock for this specific case
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Link not found', code: 'PGRST116'} });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { link_id: 'non-existent-link-uuid' } });
    expect(response.status).toBe(404);
  });

  it('should return 403 if the user does not own the link they attempt to delete', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { ...mockExistingLink, user_id: 'another-user-id' }, error: null });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(403);
  });

  it('should handle Supabase errors during link deletion', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingLink, error: null }); // Successful fetch
    const supabaseDeleteError = { message: 'Supabase delete link failed', code: '50000' };
    mockSupabaseClient.delete.mockResolvedValueOnce({ error: supabaseDeleteError }); // Failed delete

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { link_id: mockExistingLink.id } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to delete link');
  });
});
