import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// Placeholder for user authentication
const getAuthenticatedUserId = async (): Promise<string | null> => {
  return 'mock-user-id-123';
};

interface RouteContext {
  params: Promise<{ tag_id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { tag_id } = await params;
    if (!tag_id || !z.string().uuid().safeParse(tag_id).success) {
        return NextResponse.json({ error: 'Invalid tag ID format' }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Verify the tag exists and belongs to the user before deleting
    const { data: existingTag, error: fetchError } = await supabase
      .from('user_ria_tags')
      .select('id, user_id')
      .eq('id', tag_id)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (existingTag.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this tag' }, { status: 403 });
    }

    const { error } = await supabase
      .from('user_ria_tags')
      .delete()
      .eq('id', tag_id)
      .eq('user_id', userId); // Ensure user owns the tag

    if (error) {
      console.error('Supabase error deleting tag:', error);
      Sentry.captureException(error, { extra: { tag_id, userId } });
      return NextResponse.json({ error: 'Failed to delete tag', details: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error in DELETE /api/ria-hunter/profile/tags/[tag_id]:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
