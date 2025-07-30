import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Placeholder for user authentication - replace with actual session logic
const getAuthenticatedUserId = async (): Promise<string | null> => {
  return 'mock-user-id-123';
};

// Schema for the note data (can be imported from the other notes route if refactored)
const noteSchema = z.object({
  id: z.string().uuid(),
  ria_id: z.string(),
  user_id: z.string().uuid(),
  note_content: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const updateNoteBodySchema = z.object({
  note_content: z.string().min(1, { message: "Note content cannot be empty" }),
});

interface RouteContext {
  params: Promise<{ note_id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { note_id } = await params;
    if (!note_id || !z.string().uuid().safeParse(note_id).success) {
        return NextResponse.json({ error: 'Invalid note ID format' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateNoteBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { note_content } = validation.data;
    const supabase = getServerSupabaseClient();

    // First, verify the note exists and belongs to the user
    const { data: existingNote, error: fetchError } = await supabase
      .from('user_ria_notes')
      .select('id, user_id')
      .eq('id', note_id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existingNote.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this note' }, { status: 403 });
    }

    // Update the note
    const { data, error } = await supabase
      .from('user_ria_notes')
      .update({ note_content: note_content, updated_at: new Date().toISOString() })
      .eq('id', note_id)
      .eq('user_id', userId) // Double check ownership on update
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating note:', error);
      Sentry.captureException(error, { extra: { note_id, userId } });
      return NextResponse.json({ error: 'Failed to update note', details: error.message }, { status: 500 });
    }

    const responseValidation = noteSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Note PUT response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Note PUT response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            { error: 'Invalid data structure for updated note response' },
            { status: 500 }
        );
    }

    return NextResponse.json(responseValidation.data);

  } catch (error) {
    console.error(`Error in PUT /api/ria-hunter/profile/notes/[note_id]:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { note_id } = await params;
    if (!note_id || !z.string().uuid().safeParse(note_id).success) {
        return NextResponse.json({ error: 'Invalid note ID format' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // First, verify the note exists and belongs to the user before deleting
    const { data: existingNote, error: fetchError } = await supabase
      .from('user_ria_notes')
      .select('id, user_id')
      .eq('id', note_id)
      .single();

    if (fetchError || !existingNote) {
      // If it doesn't exist, arguably a 204 is fine too, or a 404 if we want to be strict.
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existingNote.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this note' }, { status: 403 });
    }

    const { error } = await supabase
      .from('user_ria_notes')
      .delete()
      .eq('id', note_id)
      .eq('user_id', userId); // Ensure user owns the note they are deleting

    if (error) {
      console.error('Supabase error deleting note:', error);
      Sentry.captureException(error, { extra: { note_id, userId } });
      return NextResponse.json({ error: 'Failed to delete note', details: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error in DELETE /api/ria-hunter/profile/notes/[note_id]:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
