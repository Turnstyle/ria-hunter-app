import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Zod schema for POST request body
const postBodySchema = z.object({
  ria_id: z.union([z.string(), z.number()]).transform(val => String(val)), // Convert to string for consistency
  note_text: z.string().min(1, { message: "Note text cannot be empty" }),
});

// Zod schema for individual note
const noteSchema = z.object({
  id: z.string(),
  ria_id: z.string(),
  note_text: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Zod schema for GET response
const getResponseSchema = z.array(noteSchema);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const riaId = searchParams.get('ria_id');

    if (!riaId) {
      return NextResponse.json({ error: 'ria_id parameter is required' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Verify the RIA exists
    const { data: riaExists, error: riaError } = await supabase
      .from('advisers')
      .select('cik')
      .eq('cik', parseInt(riaId))
      .single();

    if (riaError || !riaExists) {
      return NextResponse.json({ error: 'RIA not found' }, { status: 404 });
    }

    // Fetch user's notes for this RIA
    const { data: notes, error: notesError } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', session.user.sub)
      .eq('ria_id', riaId)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      Sentry.captureException(notesError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    // Validate response
    const validationResult = getResponseSchema.safeParse(notes || []);
    if (!validationResult.success) {
      console.error('Notes response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Notes response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: notes },
      });
      return NextResponse.json({ error: 'Invalid notes data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/notes:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = postBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { ria_id, note_text } = validation.data;

    const supabase = getServerSupabaseClient();

    // Verify the RIA exists
    const { data: riaExists, error: riaError } = await supabase
      .from('advisers')
      .select('cik')
      .eq('cik', parseInt(ria_id))
      .single();

    if (riaError || !riaExists) {
      return NextResponse.json({ error: 'RIA not found' }, { status: 404 });
    }

    // Create the note
    const { data: newNote, error: insertError } = await supabase
      .from('user_notes')
      .insert({
        user_id: session.user.sub,
        ria_id: ria_id,
        note_text: note_text,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating note:', insertError);
      Sentry.captureException(insertError);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // Validate response
    const validationResult = noteSchema.safeParse(newNote);
    if (!validationResult.success) {
      console.error('Note creation response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Note creation response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: newNote },
      });
      return NextResponse.json({ error: 'Invalid note data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/notes:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('note_id');

    if (!noteId) {
      return NextResponse.json({ error: 'note_id parameter is required' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Delete the note (with user ownership check)
    const { error: deleteError } = await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', session.user.sub);

    if (deleteError) {
      console.error('Error deleting note:', deleteError);
      Sentry.captureException(deleteError);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Note deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/ria-hunter/profile/notes:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
