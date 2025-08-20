import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers as nextHeaders } from 'next/headers';
import { createClient } from '@/app/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await nextHeaders();
    const requestId = reqHeaders?.get?.('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Extract user credentials from cookies
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      fundType = '',
      aumRange = '',
      state = '',
      location = '',
      vcActivity = '',
      sortBy = 'aum',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = body;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Start building the query
    let query = supabase
      .from('ria_profiles')
      .select('id, name, city, state, aum, employee_count, services, client_types', { count: 'exact' });
    
    // Apply filters
    if (state) {
      query = query.eq('state', state.toUpperCase());
    }
    
    if (location) {
      query = query.ilike('city', `%${location}%`);
    }
    
    if (aumRange) {
      switch (aumRange) {
        case '0-100m':
          query = query.lt('aum', 100000000);
          break;
        case '100m-1b':
          query = query.gte('aum', 100000000).lt('aum', 1000000000);
          break;
        case '1b-10b':
          query = query.gte('aum', 1000000000).lt('aum', 10000000000);
          break;
        case '10b+':
          query = query.gte('aum', 10000000000);
          break;
      }
    }
    
    // For VC activity, we would ideally query from a computed column or separate table
    // This is a placeholder implementation
    if (vcActivity) {
      switch (vcActivity) {
        case 'high':
          query = query.gte('vc_activity_score', 7);
          break;
        case 'medium':
          query = query.gte('vc_activity_score', 4).lt('vc_activity_score', 7);
          break;
        case 'low':
          query = query.gt('vc_activity_score', 0).lt('vc_activity_score', 4);
          break;
        case 'none':
          query = query.eq('vc_activity_score', 0);
          break;
      }
    }
    
    // Fund type filter would require joining with the ria_private_funds table
    // This is a placeholder implementation
    if (fundType) {
      query = query.contains('fund_types', [fundType]);
    }
    
    // Add sorting
    if (sortBy && ['aum', 'employee_count', 'vc_activity_score', 'name'].includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      // Default sort by AUM descending
      query = query.order('aum', { ascending: false });
    }
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute the query
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }
    
    // Transform the results to match the expected format
    const results = data.map(ria => ({
      id: ria.id,
      name: ria.name,
      city: ria.city || '',
      state: ria.state || '',
      aum: ria.aum || 0,
      employee_count: ria.employee_count || 0,
      // Mock fund types based on services
      fundTypes: Array.isArray(ria.services) 
        ? ria.services.filter(s => ['vc', 'pe', 'hedge', 'real estate'].includes(s.toLowerCase()))
        : [],
      // Mock VC activity score
      vcActivity: Math.floor(Math.random() * 10)
    }));
    
    return NextResponse.json({
      results,
      totalCount: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    });
    
  } catch (error) {
    console.error('RIA query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
