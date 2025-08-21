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
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      console.error('Authentication error:', authError);
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User error:', userError);
      return NextResponse.json({ error: 'Unable to get user data' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      query = '',
      fundType = '',
      aumRange = '',
      state = '',
      location = '',
      vcActivity = '',
      sortBy = 'aum',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      crd_number = null,
      exact_match = false
    } = body;
    
    // In a real implementation, we'd call the database with the filters
    // For now, generate mock results
    
    // Parse AUM range
    let minAum = 0;
    let maxAum = Number.MAX_SAFE_INTEGER;
    
    if (aumRange === '0-100m') {
      minAum = 0;
      maxAum = 100000000;
    } else if (aumRange === '100m-1b') {
      minAum = 100000000;
      maxAum = 1000000000;
    } else if (aumRange === '1b-10b') {
      minAum = 1000000000;
      maxAum = 10000000000;
    } else if (aumRange === '10b+') {
      minAum = 10000000000;
      maxAum = Number.MAX_SAFE_INTEGER;
    }
    
    // If exact match by CRD/CIK is requested, return a single result
    if (exact_match && crd_number) {
      const exactResult = {
        id: `ria-${crd_number}`,
        name: `RIA Firm ${crd_number}`,
        state: 'MO',
        city: 'St. Louis',
        aum: 1250000000,
        employee_count: 45,
        fundTypes: ['vc', 'pe'],
        vcActivity: 8,
        crd_number: crd_number,
        cik: crd_number
      };
      
      return NextResponse.json({
        results: [exactResult],
        totalCount: 1
      });
    }
    
    // Generate mock results based on filters
    const totalCount = 100;
    const startIdx = (page - 1) * limit;
    const endIdx = Math.min(startIdx + limit, totalCount);
    
    const mockResults = Array.from({ length: endIdx - startIdx }, (_, i) => {
      const idx = startIdx + i;
      
      // Apply state filter if specified
      if (state && state !== ['MO', 'NY', 'CA', 'TX', 'IL', 'FL'][idx % 6]) {
        return null;
      }
      
      // Apply location filter if specified
      if (location && !['St. Louis', 'Kansas City', 'New York', 'San Francisco', 'Chicago'][idx % 5].toLowerCase().includes(location.toLowerCase())) {
        return null;
      }
      
      // Generate AUM within range
      const aumMultiplier = (idx % 20) + 1;
      const aum = aumMultiplier * 50000000;
      
      // Apply AUM filter
      if (aum < minAum || aum > maxAum) {
        return null;
      }
      
      // Generate VC activity level
      const vcActivityLevel = idx % 10;
      
      // Apply VC activity filter
      if (vcActivity === 'high' && vcActivityLevel < 7) return null;
      if (vcActivity === 'medium' && (vcActivityLevel < 4 || vcActivityLevel > 6)) return null;
      if (vcActivity === 'low' && (vcActivityLevel < 1 || vcActivityLevel > 3)) return null;
      if (vcActivity === 'none' && vcActivityLevel > 0) return null;
      
      // Generate fund types based on index
      const fundTypes = [];
      if (idx % 2 === 0) fundTypes.push('vc');
      if (idx % 3 === 0) fundTypes.push('pe');
      if (idx % 5 === 0) fundTypes.push('hedge');
      if (idx % 7 === 0) fundTypes.push('cre');
      
      // Apply fund type filter
      if (fundType && !fundTypes.includes(fundType)) {
        return null;
      }
      
      return {
        id: `ria-${idx}`,
        name: `RIA Firm ${idx + 1}${idx % 3 === 0 ? ' Capital Partners' : idx % 3 === 1 ? ' Advisors' : ' Management'}`,
        state: ['MO', 'NY', 'CA', 'TX', 'IL', 'FL'][idx % 6],
        city: ['St. Louis', 'Kansas City', 'New York', 'San Francisco', 'Chicago'][idx % 5],
        aum: aum,
        employee_count: (idx % 10 + 1) * 5,
        fundTypes: fundTypes,
        vcActivity: vcActivityLevel
      };
    }).filter(Boolean);
    
    return NextResponse.json({
      results: mockResults,
      totalCount: mockResults.length,
      isSubscriber: true,
      page,
      limit
    });
    
  } catch (error) {
    console.error('RIA query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}