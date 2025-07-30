import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';
// TODO: Update to use proper Auth0 session handling for Next.js 15
// import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Temporary mock session for build compatibility
const getSession = async () => {
  return { user: { sub: 'mock-user-id' } };
};

// Zod schema for POST request body
const postBodySchema = z.object({
  ria_id: z.union([z.string(), z.number()]).transform(val => String(val)), // Convert to string for consistency
  tag_text: z.string().min(1, { message: "Tag text cannot be empty" }).max(50, { message: "Tag text too long" }),
});

// Zod schema for individual tag
const tagSchema = z.object({
  id: z.string(),
  ria_id: z.string(),
  tag_text: z.string(),
  created_at: z.string(),
});

// Zod schema for GET response
const getResponseSchema = z.array(tagSchema);

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

    // Fetch user's tags for this RIA
    const { data: tags, error: tagsError } = await supabase
      .from('user_tags')
      .select('*')
      .eq('user_id', session.user.sub)
      .eq('ria_id', riaId)
      .order('created_at', { ascending: false });

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      Sentry.captureException(tagsError);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    // Validate response
    const validationResult = getResponseSchema.safeParse(tags || []);
    if (!validationResult.success) {
      console.error('Tags response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Tags response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: tags },
      });
      return NextResponse.json({ error: 'Invalid tags data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/tags:', error);
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

    const { ria_id, tag_text } = validation.data;

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

    // Check if tag already exists for this user and RIA (prevent duplicates)
    const { data: existingTag, error: existingError } = await supabase
      .from('user_tags')
      .select('id')
      .eq('user_id', session.user.sub)
      .eq('ria_id', ria_id)
      .eq('tag_text', tag_text)
      .single();

    if (existingTag) {
      return NextResponse.json({ error: 'Tag already exists for this RIA' }, { status: 409 });
    }

    // Create the tag
    const { data: newTag, error: insertError } = await supabase
      .from('user_tags')
      .insert({
        user_id: session.user.sub,
        ria_id: ria_id,
        tag_text: tag_text,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tag:', insertError);
      Sentry.captureException(insertError);
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }

    // Validate response
    const validationResult = tagSchema.safeParse(newTag);
    if (!validationResult.success) {
      console.error('Tag creation response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Tag creation response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: newTag },
      });
      return NextResponse.json({ error: 'Invalid tag data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/tags:', error);
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
    const tagId = searchParams.get('tag_id');

    if (!tagId) {
      return NextResponse.json({ error: 'tag_id parameter is required' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Delete the tag (with user ownership check)
    const { error: deleteError } = await supabase
      .from('user_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', session.user.sub);

    if (deleteError) {
      console.error('Error deleting tag:', deleteError);
      Sentry.captureException(deleteError);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tag deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/ria-hunter/profile/tags:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
