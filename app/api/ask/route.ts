import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 /api/ask endpoint called');
    
    const body = await request.json();
    const { query } = body;
    
    console.log('🔧 Ask request:', { query, body });
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // For now, let's do a simple text search in the database
    // This is a fallback implementation until the backend AI search is properly connected
    
    console.log('🔧 Performing database search for:', query);
    
    // Extract search terms from the query
    const searchTerms = query.toLowerCase();
    let stateFilter = null;
    let fundTypeFilter = null;
    
    // Simple pattern matching for state
    const stateMatch = searchTerms.match(/\b(missouri|mo|kansas|ks|california|ca|texas|tx|new york|ny|florida|fl)\b/i);
    if (stateMatch) {
      const stateMap: { [key: string]: string } = {
        'missouri': 'MO',
        'mo': 'MO',
        'kansas': 'KS',
        'ks': 'KS',
        'california': 'CA',
        'ca': 'CA',
        'texas': 'TX',
        'tx': 'TX',
        'new york': 'NY',
        'ny': 'NY',
        'florida': 'FL',
        'fl': 'FL'
      };
      stateFilter = stateMap[stateMatch[1].toLowerCase()];
    }
    
    // Simple pattern matching for fund types
    if (searchTerms.includes('venture capital') || searchTerms.includes('vc')) {
      fundTypeFilter = 'vc';
    } else if (searchTerms.includes('private equity') || searchTerms.includes('pe')) {
      fundTypeFilter = 'pe';
    } else if (searchTerms.includes('hedge fund')) {
      fundTypeFilter = 'hedge';
    }

    console.log('🔧 Search filters:', { stateFilter, fundTypeFilter });

    // Build the query
    let dbQuery = supabase
      .from('investment_advisor_public_reporting')
      .select(`
        crd_number,
        legal_name,
        business_name,
        city,
        state,
        zip_code,
        website,
        phone,
        aum_total,
        client_count_individual,
        client_count_institutional,
        services_offered
      `)
      .limit(20);

    // Apply filters
    if (stateFilter) {
      dbQuery = dbQuery.eq('state', stateFilter);
    }

    // Text search in firm names
    const searchWords = query.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    if (searchWords.length > 0) {
      dbQuery = dbQuery.or(
        searchWords.map(word => 
          `legal_name.ilike.%${word}%,business_name.ilike.%${word}%,services_offered.ilike.%${word}%`
        ).join(',')
      );
    }

    console.log('🔧 Executing database query...');
    const { data: results, error } = await dbQuery;

    if (error) {
      console.error('🔧 Database error:', error);
      return NextResponse.json(
        { error: 'Database query failed: ' + error.message },
        { status: 500 }
      );
    }

    console.log(`🔧 Found ${results?.length || 0} results`);

    // Transform results to match expected format
    const transformedResults = results?.map(row => ({
      id: row.crd_number || 'unknown',
      firm_name: row.business_name || row.legal_name || 'Unknown Firm',
      crd_number: row.crd_number || 'Unknown',
      city: row.city || undefined,
      state: row.state || undefined,
      aum: row.aum_total || undefined,
      website: row.website || undefined,
      phone: row.phone || undefined,
      services: row.services_offered ? [row.services_offered] : undefined,
      similarity: 0.8, // Mock similarity score
    })) || [];

    // Generate a natural language answer
    let answer = '';
    if (transformedResults.length > 0) {
      const stateText = stateFilter ? ` in ${stateFilter}` : '';
      const fundText = fundTypeFilter ? ` with ${fundTypeFilter} capabilities` : '';
      answer = `I found ${transformedResults.length} RIA firm${transformedResults.length !== 1 ? 's' : ''}${stateText}${fundText} matching your search. Here are the results:`;
    } else {
      answer = `I couldn't find any RIA firms matching your search criteria. Try adjusting your search terms or expanding your geographic area.`;
    }

    const response = {
      answer,
      results: transformedResults,
      metadata: {
        searchesRemaining: null,
        isSubscriber: false,
        searchStrategy: 'database-fallback',
        confidence: 0.7
      }
    };

    console.log('🔧 Returning response:', { 
      answerLength: answer.length, 
      resultsCount: transformedResults.length 
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('🔧 /api/ask error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
