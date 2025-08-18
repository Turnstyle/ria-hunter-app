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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400, headers: CORS_HEADERS })
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

    // Call the backend's direct profile endpoint (much simpler and proven to work!)
    const base = backendBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/ria/profile/${id}`;
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-request-id': `profile-${id}-${Date.now()}`,
      },
      cache: 'no-store',
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const profile = await resp.json();

    // Validate that we have the required legal_name
    if (!profile.legal_name && !profile.firm_name) {
      return NextResponse.json({ error: 'Profile data incomplete: missing legal_name' }, { status: 404, headers: CORS_HEADERS })
    }

    // The direct profile endpoint already returns data in the correct format,
    // but we'll ensure consistent structure for the frontend
    const result = {
      cik: profile.cik || profile.crd_number,
      crd_number: profile.crd_number,
      legal_name: profile.legal_name || profile.firm_name,
      main_addr_street1: profile.main_addr_street1 || null,
      main_addr_street2: profile.main_addr_street2 || null,
      main_addr_city: profile.main_addr_city || null,
      main_addr_state: profile.main_addr_state || null,
      main_addr_zip: profile.main_addr_zip || null,
      main_addr_country: profile.main_addr_country || 'United States',
      phone_number: profile.phone_number || null,
      fax_number: profile.fax_number || null,
      website: profile.website || null,
      executives: profile.executives || [],
      filings: profile.filings || [],
      private_funds: profile.private_funds || [],
      // Pass through any additional fields from the backend
      ...profile
    }

    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
