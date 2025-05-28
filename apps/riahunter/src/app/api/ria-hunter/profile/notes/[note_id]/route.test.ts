import { NextRequest } from 'next/server';
import { PUT, DELETE } from './route';

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('supabase/server', () => ({
  getServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock Sentry
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

// Mock user ID from the route file's getAuthenticatedUserId
const MOCK_USER_ID = 'mock-user-id-123';
const MOCK_RIA_ID = 'mock-ria-id-789';

const mockExistingNote = {
  id: 'existing-note-uuid-111',
  ria_id: MOCK_RIA_ID,
  user_id: MOCK_USER_ID,
  note_content: 'Original note content.',
  created_at: new Date(Date.now() - 100000).toISOString(),
  updated_at: new Date(Date.now() - 100000).toISOString(),
};

const mockUpdatedNote = {
  ...mockExistingNote,
  note_content: 'Updated note content.',
  updated_at: new Date().toISOString(),
};

describe('/api/ria-hunter/profile/notes/[note_id] PUT handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default for successful fetch of existing note
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingNote, error: null });
    // Default for successful update
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockUpdatedNote, error: null });
  });

  it('should update an existing note and return 200 with the updated data', async () => {
    const mockRequest = {
      json: async () => ({ note_content: 'Updated note content.' }),
      method: 'PUT',
    } as NextRequest; // Cast to NextRequest, not unknown

    const response = await PUT(mockRequest, { params: { note_id: mockExistingNote.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.note_content).toBe('Updated note content.');
    expect(body.id).toBe(mockExistingNote.id);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_notes');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, user_id');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingNote.id); // For fetch
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(expect.objectContaining({ note_content: 'Updated note content.' }));
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingNote.id); // For update
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID); // For update security
    expect(mockSupabaseClient.select).toHaveBeenCalledTimes(2); // Once for fetch, once for update result
  });

  it('should return 400 for invalid note_id format', async () => {
    const mockRequest = {
      json: async () => ({ note_content: 'Valid content' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { note_id: 'invalid-uuid' } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid note ID format');
  });

  it('should return 400 for invalid request body (e.g., empty note_content)', async () => {
    mockSupabaseClient.single.mockReset(); // Reset because the fetch won't happen if body is invalid earlier
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingNote, error: null }); // Mock for potential fetch if it were to happen

    const mockRequest = {
      json: async () => ({ note_content: '' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { note_id: mockExistingNote.id } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('should return 404 if the note to update is not found', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found', code: 'PGRST116'} }); // Simulate not found

    const mockRequest = {
      json: async () => ({ note_content: 'Content for non-existent note' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { note_id: 'non-existent-uuid' } });
    expect(response.status).toBe(404);
  });

  it('should return 403 if the user does not own the note', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { ...mockExistingNote, user_id: 'other-user-id' }, error: null });

    const mockRequest = {
      json: async () => ({ note_content: 'Attempt to update others note' }),
      method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { note_id: mockExistingNote.id } });
    expect(response.status).toBe(403);
  });

  it('should handle Supabase errors during note update', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingNote, error: null }); // Successful fetch
    const supabaseUpdateError = { message: 'Supabase update failed', code: '50000' };
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: supabaseUpdateError }); // Failed update

    const mockRequest = {
      json: async () => ({ note_content: 'Content that fails on update' }),
       method: 'PUT',
    } as NextRequest;
    const response = await PUT(mockRequest, { params: { note_id: mockExistingNote.id } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to update note');
  });
});

describe('/api/ria-hunter/profile/notes/[note_id] DELETE handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default for successful fetch of existing note
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingNote, error: null });
    // Default for successful delete (delete itself doesn't return data, just error or null)
    mockSupabaseClient.delete.mockResolvedValue({ error: null });
  });

  it('should delete an existing note and return 204 No Content', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { note_id: mockExistingNote.id } });

    expect(response.status).toBe(204);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_ria_notes');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, user_id'); // For fetch
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingNote.id); // For fetch
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockExistingNote.id); // For delete
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID); // For delete security
  });

  it('should return 400 for invalid note_id format on DELETE', async () => {
    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { note_id: 'invalid-uuid' } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid note ID format');
  });

  it('should return 404 if the note to delete is not found', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found', code: 'PGRST116'} });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { note_id: 'non-existent-uuid' } });
    expect(response.status).toBe(404);
  });

  it('should return 403 if the user does not own the note they attempt to delete', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: { ...mockExistingNote, user_id: 'other-user-id' }, error: null });

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { note_id: mockExistingNote.id } });
    expect(response.status).toBe(403);
  });

  it('should handle Supabase errors during note deletion', async () => {
    mockSupabaseClient.single.mockReset();
    mockSupabaseClient.single.mockResolvedValueOnce({ data: mockExistingNote, error: null }); // Successful fetch
    const supabaseDeleteError = { message: 'Supabase delete failed', code: '50000' };
    mockSupabaseClient.delete.mockResolvedValueOnce({ error: supabaseDeleteError }); // Failed delete

    const mockRequest = { method: 'DELETE' } as NextRequest;
    const response = await DELETE(mockRequest, { params: { note_id: mockExistingNote.id } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to delete note');
  });
});
