import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Placeholder for user authentication
const getAuthenticatedUserId = async (): Promise<string | null> => {
  return 'mock-user-id-123';
};

const linkSchema = z.object({
  id: z.string().uuid(),
  ria_id: z.string(),
  user_id: z.string().uuid(),
  link_url: z.string().url({ message: "Invalid URL format" }),
  link_description: z.string().optional().nullable(), // Optional description
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const createLinkBodySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required" }),
  link_url: z.string().url({ message: "Valid URL is required" }),
  link_description: z.string().max(255, { message: "Description cannot exceed 255 characters" }).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createLinkBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { ria_id, link_url, link_description } = validation.data;
    const supabase = getServerSupabaseClient();

    // Optional: Check for duplicate link URL for the same user and RIA
    const { data: existingLink, error: existingLinkError } = await supabase
        .from('user_ria_links')
        .select('id')
        .eq('user_id', userId)
        .eq('ria_id', ria_id)
        .eq('link_url', link_url)
        .maybeSingle();

    if (existingLinkError && existingLinkError.code !== 'PGRST116') {
        console.error('Supabase error checking for existing link:', existingLinkError);
        Sentry.captureException(existingLinkError, { extra: { ria_id, userId, link_url } });
        return NextResponse.json({ error: 'Failed to check for existing link'}, { status: 500 });
    }
    if (existingLink) {
        return NextResponse.json({ error: 'This URL has already been added for this RIA by you.', link_id: existingLink.id }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('user_ria_links')
      .insert({
        ria_id: ria_id,
        user_id: userId,
        link_url: link_url,
        link_description: link_description,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating link:', error);
      Sentry.captureException(error, { extra: { ria_id, userId, link_url } });
      return NextResponse.json({ error: 'Failed to create link', details: error.message }, { status: 500 });
    }

    const responseValidation = linkSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Link POST response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Link POST response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            { error: 'Invalid data structure for created link response' },
            { status: 500 }
        );
    }
    return NextResponse.json(responseValidation.data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/links:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const getLinksQuerySchema = z.object({
  ria_id: z.string({ required_error: "RIA ID is required as a query parameter" }),
});

const linksListResponseSchema = z.array(linkSchema);

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParamsValidation = getLinksQuerySchema.safeParse({
      ria_id: searchParams.get('ria_id'),
    });

    if (!queryParamsValidation.success) {
      return NextResponse.json({ error: 'Invalid query parameters', issues: queryParamsValidation.error.issues }, { status: 400 });
    }

    const { ria_id } = queryParamsValidation.data;
    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from('user_ria_links')
      .select('*')
      .eq('ria_id', ria_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching links:', error);
      Sentry.captureException(error, { extra: { ria_id, userId } });
      return NextResponse.json({ error: 'Failed to fetch links', details: error.message }, { status: 500 });
    }

    const responseValidation = linksListResponseSchema.safeParse(data);
     if (!responseValidation.success) {
        console.error('Links GET response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Links GET response data validation failed'), {
            extra: { issues: responseValidation.error.issues, originalData: data },
        });
        return NextResponse.json(
            { error: 'Invalid data structure for links list response'},
            { status: 500 }
        );
    }
    return NextResponse.json(responseValidation.data);

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/links:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
