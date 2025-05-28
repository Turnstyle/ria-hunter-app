import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Placeholder for user authentication
const getAuthenticatedUserId = async (): Promise<string | null> => {
  return 'mock-user-id-123';
};

const tagSchema = z.object({
  id: z.string().uuid(), // Assuming UUID for tag ID from DB
  ria_id: z.string(),
  user_id: z.string().uuid(),
  tag_text: z.string(),
  created_at: z.string().datetime(),
});

const createTagBodySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required" }),
  tag_text: z.string().min(1, { message: "Tag text cannot be empty" }).max(50, { message: "Tag text cannot exceed 50 characters" }),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createTagBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { ria_id, tag_text } = validation.data;
    const supabase = getServerSupabaseClient();

    // Optional: Check if the exact same tag already exists for this user and RIA to prevent duplicates
    const { data: existingTag, error: existingTagError } = await supabase
        .from('user_ria_tags')
        .select('id')
        .eq('user_id', userId)
        .eq('ria_id', ria_id)
        .ilike('tag_text', tag_text) // Case-insensitive check for tag text
        .maybeSingle();

    if (existingTagError && existingTagError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine here
        console.error('Supabase error checking for existing tag:', existingTagError);
        Sentry.captureException(existingTagError, { extra: { ria_id, userId, tag_text } });
        return NextResponse.json({ error: 'Failed to check for existing tag', details: existingTagError.message }, { status: 500 });
    }

    if (existingTag) {
        return NextResponse.json({ error: 'Tag already exists for this RIA by this user.', tag_id: existingTag.id }, { status: 409 }); // Conflict
    }

    const { data, error } = await supabase
      .from('user_ria_tags')
      .insert({
        ria_id: ria_id,
        user_id: userId,
        tag_text: tag_text, // Store the original case, or normalize (e.g., toLowerCase())
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating tag:', error);
      Sentry.captureException(error, { extra: { ria_id, userId, tag_text } });
      return NextResponse.json({ error: 'Failed to create tag', details: error.message }, { status: 500 });
    }

    const responseValidation = tagSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Tag POST response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Tag POST response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            { error: 'Invalid data structure for created tag response' },
            { status: 500 }
        );
    }
    return NextResponse.json(responseValidation.data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/tags:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const getTagsQuerySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required as a query parameter" }),
});

const tagsListResponseSchema = z.array(tagSchema);

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParamsValidation = getTagsQuerySchema.safeParse({
      ria_id: searchParams.get('ria_id'),
    });

    if (!queryParamsValidation.success) {
      return NextResponse.json({ error: 'Invalid query parameters', issues: queryParamsValidation.error.issues }, { status: 400 });
    }

    const { ria_id } = queryParamsValidation.data;
    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from('user_ria_tags')
      .select('*')
      .eq('ria_id', ria_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }); // Or order by tag_text

    if (error) {
      console.error('Supabase error fetching tags:', error);
      Sentry.captureException(error, { extra: { ria_id, userId } });
      return NextResponse.json({ error: 'Failed to fetch tags', details: error.message }, { status: 500 });
    }

    const responseValidation = tagsListResponseSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Tags GET response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Tags GET response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            { error: 'Invalid data structure for tags list response' },
            { status: 500 }
        );
    }
    return NextResponse.json(responseValidation.data);
  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/tags:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
