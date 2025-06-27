import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { getSession } from '@auth0/nextjs-auth0';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Zod schema for POST request body
const postBodySchema = z.object({
  ria_id: z.union([z.string(), z.number()]).transform(val => String(val)), // Convert to string for consistency
  link_url: z.string().url({ message: "Must be a valid URL" }),
  link_description: z.string().optional().nullable(),
});

// Zod schema for individual link
const linkSchema = z.object({
  id: z.string(),
  ria_id: z.string(),
  link_url: z.string(),
  link_description: z.string().nullable(),
  created_at: z.string(),
});

// Zod schema for GET response
const getResponseSchema = z.array(linkSchema);

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

    // Fetch user's links for this RIA
    const { data: links, error: linksError } = await supabase
      .from('user_links')
      .select('*')
      .eq('user_id', session.user.sub)
      .eq('ria_id', riaId)
      .order('created_at', { ascending: false });

    if (linksError) {
      console.error('Error fetching links:', linksError);
      Sentry.captureException(linksError);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    // Validate response
    const validationResult = getResponseSchema.safeParse(links || []);
    if (!validationResult.success) {
      console.error('Links response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Links response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: links },
      });
      return NextResponse.json({ error: 'Invalid links data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in GET /api/ria-hunter/profile/links:', error);
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

    const { ria_id, link_url, link_description } = validation.data;

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

    // Check if link already exists for this user and RIA (prevent duplicates)
    const { data: existingLink, error: existingError } = await supabase
      .from('user_links')
      .select('id')
      .eq('user_id', session.user.sub)
      .eq('ria_id', ria_id)
      .eq('link_url', link_url)
      .single();

    if (existingLink) {
      return NextResponse.json({ error: 'Link already exists for this RIA' }, { status: 409 });
    }

    // Create the link
    const { data: newLink, error: insertError } = await supabase
      .from('user_links')
      .insert({
        user_id: session.user.sub,
        ria_id: ria_id,
        link_url: link_url,
        link_description: link_description,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating link:', insertError);
      Sentry.captureException(insertError);
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }

    // Validate response
    const validationResult = linkSchema.safeParse(newLink);
    if (!validationResult.success) {
      console.error('Link creation response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Link creation response validation failed'), {
        extra: { issues: validationResult.error.issues, originalData: newLink },
      });
      return NextResponse.json({ error: 'Invalid link data structure' }, { status: 500 });
    }

    return NextResponse.json(validationResult.data, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ria-hunter/profile/links:', error);
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
    const linkId = searchParams.get('link_id');

    if (!linkId) {
      return NextResponse.json({ error: 'link_id parameter is required' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Delete the link (with user ownership check)
    const { error: deleteError } = await supabase
      .from('user_links')
      .delete()
      .eq('id', linkId)
      .eq('user_id', session.user.sub);

    if (deleteError) {
      console.error('Error deleting link:', deleteError);
      Sentry.captureException(deleteError);
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Link deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/ria-hunter/profile/links:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
