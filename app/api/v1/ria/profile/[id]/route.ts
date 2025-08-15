import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers as nextHeaders } from 'next/headers'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const crd = params.id
    if (!crd) {
      return NextResponse.json({ error: 'Missing CRD number' }, { status: 400, headers: CORS_HEADERS })
    }

    // Get backend URL - same as query endpoint
    const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500, headers: CORS_HEADERS });
    }

    // Get auth header - same logic as query endpoint  
    const reqHeaders = await nextHeaders();
    let authHeader = req.headers.get('authorization') || undefined;
    
    if (!authHeader) {
      try {
        const cookieStore = await cookies();
        const directToken = (cookieStore as any)?.get?.('sb-access-token')?.value;
        if (directToken) {
          authHeader = `Bearer ${directToken}`;
        } else {
          const all = ((cookieStore as any)?.getAll?.() ?? []) as Array<{ name: string; value: string }>;
          const sbCookie = all.find(c => c.name.includes('sb-') && c.name.includes('auth')) || all.find(c => c.name.startsWith('sb-'));
          if (sbCookie?.value) {
            try {
              const parsed: any = JSON.parse(sbCookie.value);
              if (parsed?.access_token) {
                authHeader = `Bearer ${parsed.access_token}`;
              }
            } catch {
              authHeader = `Bearer ${sbCookie.value}`;
            }
          }
        }
      } catch {}
    }

    // Query the backend for this specific CRD
    const base = backendBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/ria/query`;
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-request-id': `profile-${crd}-${Date.now()}`,
      },
      body: JSON.stringify({ 
        query: `Get detailed profile for RIA with CRD number ${crd}`,
        crd_number: crd 
      }),
      cache: 'no-store',
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Backend service error' }, { status: resp.status, headers: CORS_HEADERS });
    }

    const data = await resp.json();
    const results = data.results || [];
    
    // Find the specific CRD in the results
    let profile = null;
    for (const result of results) {
      if (result.crd_number === crd || result.crd_numbers?.includes(crd)) {
        profile = result;
        break;
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Format the data to match the expected interface
    const result = {
      cik: Number(profile.cik || profile.crd_number),
      crd_number: Number(profile.crd_number),
      legal_name: profile.legal_name || 'Unknown',
      main_addr_street1: null, // Not available in backend data
      main_addr_street2: null, // Not available in backend data  
      main_addr_city: profile.main_addr_city || profile.city,
      main_addr_state: profile.main_addr_state || profile.state,
      main_addr_zip: null, // Not available in backend data
      main_addr_country: null, // Not available in backend data
      phone_number: null, // Not available in backend data
      fax_number: null, // Not available in backend data
      website: null, // Not available in backend data
      executives: [], // Not available in backend data
      filings: profile.filing_date ? [{
        filing_id: profile.crd_number + '_' + profile.filing_date,
        filing_date: profile.filing_date,
        total_aum: profile.total_aum || profile.aum,
        manages_private_funds_flag: profile.private_fund_count > 0
      }] : [],
      private_funds: [] // Backend has private_fund_count but not individual fund details
    }

    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
