// Force Node.js runtime for full database access (fixes Edge runtime limitations)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    
    // Simple count query to test connection
    const { data: countData, error: countError } = await supabase
      .from('advisers')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ 
        error: 'Count query failed', 
        details: countError,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
      }, { status: 500 });
    }

    // Try to get first advisor
    const { data: adviser, error: adviserError } = await supabase
      .from('advisers')
      .select('*')
      .limit(1)
      .single();

    if (adviserError) {
      return NextResponse.json({ 
        error: 'Adviser query failed', 
        details: adviserError,
        count: countData
      }, { status: 500 });
    }

    // Try specific CIK query
    const { data: specificAdviser, error: specificError } = await supabase
      .from('advisers')
      .select('*')
      .eq('cik', '0000001234')
      .single();

    return NextResponse.json({
      success: true,
      advisersCount: countData,
      firstAdviser: adviser,
      specificAdviser: specificAdviser,
      specificError: specificError
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Unexpected error',
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace'
    }, { status: 500 });
  }
}
