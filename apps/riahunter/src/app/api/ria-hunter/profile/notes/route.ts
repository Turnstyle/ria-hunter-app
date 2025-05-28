import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Mocking user authentication for now
// In a real app, you'd get the user from the session
const getAuthenticatedUserId = async (): Promise<string | null> => {
  // Replace with actual user session logic
  // For testing, we can return a mock user ID or make it configurable
  return 'mock-user-id-123';
};

const noteSchema = z.object({
  id: z.string().uuid(), // Assuming UUID for note ID from DB
  ria_id: z.string(), // Or z.number() if ria_id is an integer. Assuming string based on CIK example.
  user_id: z.string().uuid(),
  note_content: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const createNoteBodySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required" }),
  note_content: z.string().min(1, { message: "Note content cannot be empty" }),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createNoteBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { ria_id, note_content } = validation.data;

    const supabase = getServerSupabaseClient();

    // Assuming 'user_ria_notes' is the table name
    const { data, error } = await supabase
      .from('user_ria_notes')
      .insert({
        ria_id: ria_id,
        user_id: userId,
        note_content: note_content,
      })
      .select()
      .single(); // Assuming insert returns the created row and we want it

    if (error) {
      console.error('Supabase error creating note:', error);
      Sentry.captureException(error, { extra: { ria_id, userId } });
      return NextResponse.json({ error: 'Failed to create note', details: error.message }, { status: 500 });
    }

    // Validate response data before sending
    const responseValidation = noteSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Note POST response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Note POST response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            {
                error: 'Invalid data structure for created note response',
                details: responseValidation.error.issues,
            },
            { status: 500 }
        );
    }

    return NextResponse.json(responseValidation.data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/notes:', error);
    Sentry.captureException(error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

// GET handler will be added later to fetch notes for an RIA
const getNotesQuerySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required as a query parameter" }),
});

const notesListResponseSchema = z.array(noteSchema);

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParamsValidation = getNotesQuerySchema.safeParse({
      ria_id: searchParams.get('ria_id'),
    });

    if (!queryParamsValidation.success) {
      return NextResponse.json({ error: 'Invalid query parameters', issues: queryParamsValidation.error.issues }, { status: 400 });
    }

    const { ria_id } = queryParamsValidation.data;
    const supabase = getServerSupabaseClient();

    // Fetch notes for the given ria_id AND the authenticated user_id
    const { data, error } = await supabase
      .from('user_ria_notes')
      .select('*')
      .eq('ria_id', ria_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching notes:', error);
      Sentry.captureException(error, { extra: { ria_id, userId } });
      return NextResponse.json({ error: 'Failed to fetch notes', details: error.message }, { status: 500 });
    }

    const responseValidation = notesListResponseSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Notes GET response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Notes GET response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            {
                error: 'Invalid data structure for notes list response',
                details: responseValidation.error.issues,
            },
            { status: 500 }
        );
    }

    return NextResponse.json(responseValidation.data);

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/notes:', error);
    Sentry.captureException(error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
