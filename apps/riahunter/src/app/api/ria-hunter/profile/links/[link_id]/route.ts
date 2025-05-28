import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Placeholder for user authentication
const getAuthenticatedUserId = async (): Promise<string | null> => {
  return 'mock-user-id-123';
};

// Schema for the link data (can be imported if refactored)
const linkSchema = z.object({
  id: z.string().uuid(),
  ria_id: z.string(),
  user_id: z.string().uuid(),
  link_url: z.string().url(),
  link_description: z.string().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const updateLinkBodySchema = z.object({
  link_url: z.string().url({ message: "Valid URL is required" }).optional(),
  link_description: z.string().max(255, { message: "Description cannot exceed 255 characters" }).optional().nullable(),
}).refine(data => data.link_url || data.link_description !== undefined, {
  message: "At least link_url or link_description must be provided for update",
});

interface RouteContext {
  params: {
    link_id: string;
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { link_id } = params;
    if (!link_id || !z.string().uuid().safeParse(link_id).success) {
        return NextResponse.json({ error: 'Invalid link ID format' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateLinkBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { link_url, link_description } = validation.data;
    const supabase = getServerSupabaseClient();

    const { data: existingLink, error: fetchError } = await supabase
      .from('user_ria_links')
      .select('id, user_id, link_url, ria_id')
      .eq('id', link_id)
      .single();

    if (fetchError || !existingLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    if (existingLink.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this link' }, { status: 403 });
    }

    // If link_url is being updated, check if the new URL already exists for this user & RIA (excluding the current link itself)
    if (link_url && link_url !== existingLink.link_url) {
        const { data: duplicateLink, error: duplicateError } = await supabase
            .from('user_ria_links')
            .select('id')
            .eq('user_id', userId)
            .eq('ria_id', existingLink.ria_id) // Assuming ria_id is part of existingLink or fetched
            .eq('link_url', link_url)
            .neq('id', link_id) // Exclude the current link from duplicate check
            .maybeSingle();

        if (duplicateError && duplicateError.code !== 'PGRST116') {
            console.error('Supabase error checking for duplicate URL on update:', duplicateError);
            return NextResponse.json({ error: 'Failed to verify URL uniqueness' }, { status: 500 });
        }
        if (duplicateLink) {
            return NextResponse.json({ error: 'This URL is already in use for another link by you for this RIA.' }, { status: 409 });
        }
    }

    const updatePayload: { link_url?: string; link_description?: string | null; updated_at: string } = {
        updated_at: new Date().toISOString(),
    };
    if (link_url) updatePayload.link_url = link_url;
    if (link_description !== undefined) updatePayload.link_description = link_description;

    const { data, error } = await supabase
      .from('user_ria_links')
      .update(updatePayload)
      .eq('id', link_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating link:', error);
      Sentry.captureException(error, { extra: { link_id, userId } });
      return NextResponse.json({ error: 'Failed to update link', details: error.message }, { status: 500 });
    }

    const responseValidation = linkSchema.safeParse(data);
    if (!responseValidation.success) {
        console.error('Link PUT response data validation error:', responseValidation.error.issues);
        Sentry.captureException(new Error('Link PUT response data validation failed'));
        return NextResponse.json({ error: 'Invalid data structure for updated link' }, { status: 500 });
    }
    return NextResponse.json(responseValidation.data);

  } catch (error) {
    console.error(`Error in PUT /api/ria-hunter/profile/links/[link_id]:`, error);
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

    const { link_id } = params;
     if (!link_id || !z.string().uuid().safeParse(link_id).success) {
        return NextResponse.json({ error: 'Invalid link ID format' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const { data: existingLink, error: fetchError } = await supabase
      .from('user_ria_links')
      .select('id, user_id')
      .eq('id', link_id)
      .single();

    if (fetchError || !existingLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    if (existingLink.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this link' }, { status: 403 });
    }

    const { error } = await supabase
      .from('user_ria_links')
      .delete()
      .eq('id', link_id)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error deleting link:', error);
      Sentry.captureException(error, { extra: { link_id, userId } });
      return NextResponse.json({ error: 'Failed to delete link', details: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Error in DELETE /api/ria-hunter/profile/links/[link_id]:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
