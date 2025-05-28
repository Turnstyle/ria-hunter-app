import { NextRequest } from 'next/server';
import { DELETE } from './route'; // Assuming DELETE is exported from [tag_id]/route.ts

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

const MOCK_USER_ID = 'mock-user-id-123';
const MOCK_RIA_ID_FOR_TAG = 'ria-for-tag-delete';

const mockExistingTag = {
  id: 'existing-tag-uuid-to-delete',
  ria_id: MOCK_RIA_ID_FOR_TAG,
  user_id: MOCK_USER_ID,
  tag_text: 'TagToDelete',
  created_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/tags/[tag_id] DELETE handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default for successful fetch of existing tag
    mockSupabaseClient.single.mockResolvedValue({ data: mockExistingTag, error: null });
    // Default for successful delete operation
    mockSupabaseClient.delete.mockResolvedValue({ error: null });
  });

  it('should delete an existing tag and return 204 No Content', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { tag_id: mockExistingTag.id } });

    expect(response.status).toBe(204);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_tags');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, user_id'); // For fetch to check ownership
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingTag.id); // For fetch
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingTag.id); // For delete
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID); // For delete security
  });

  it('should return 400 for invalid tag_id format', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { tag_id: 'invalid-tag-uuid' } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid tag ID format');
  });

  it('should return 404 if the tag to delete is not found', async () => {
    mockSupabaseClient.single.mockReset(); // Clear beforeEach mock for this specific case
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Tag not found', code: 'PGRST116'} });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { tag_id: 'non-existent-tag-uuid' } });
    expect(response.status).toBe(404);
  });

  it('should return 403 if the user does not own the tag they attempt to delete', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { ...mockExistingTag, user_id: 'another-user-id' }, error: null });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { tag_id: mockExistingTag.id } });
    expect(response.status).toBe(403);
  });

  it('should handle Supabase errors during tag deletion', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingTag, error: null }); // Successful fetch
    const supabaseDeleteError = { message: 'Supabase delete tag failed', code: '50000' };
    mockSupabaseClient.delete.mockResolvedValueOnce({ error: supabaseDeleteError }); // Failed delete

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { tag_id: mockExistingTag.id } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to delete tag');
  });
});
