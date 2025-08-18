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

    // Query the backend for this specific CRD
    const base = backendBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/ria/query`;
    
    const queryPayload = {
      query: `Get comprehensive profile for RIA with identifier ${id} including contact information, executives, address, phone, website, and recent filings`,
      crd_number: id, // Backend expects this field name but will handle both CIK and CRD
      includeExecutives: true,
      includeContact: true,
      limit: 1
    };
    
    let resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-request-id': `profile-${id}-${Date.now()}`,
      },
      body: JSON.stringify(queryPayload),
      cache: 'no-store',
    });

    // If primary query fails, try fuzzy search fallback
    if (!resp.ok) {
      const fallbackPayload = {
        query: `Find any RIA firm with identifier ${id} or similar identifier`,
        crd_number: id, // Backend expects this field name but will handle both CIK and CRD
        fuzzy: true,
        limit: 1
      };
      
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          'x-request-id': `profile-fallback-${id}-${Date.now()}`,
        },
        body: JSON.stringify(fallbackPayload),
        cache: 'no-store',
      });
    }

    if (!resp.ok) {
      return NextResponse.json({ error: 'Backend service error' }, { status: resp.status, headers: CORS_HEADERS });
    }

    const data = await resp.json();
    const results = data.results || [];
    
    // Find the specific profile in the results (by CIK or CRD)
    let profile = null;
    for (const result of results) {
      if (result.crd_number === id || result.cik === id || result.crd_numbers?.includes(id)) {
        profile = result;
        break;
      }
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: CORS_HEADERS })
    }

    // Validate that we have the required legal_name
    if (!profile.legal_name && !profile.firm_name) {
      return NextResponse.json({ error: 'Profile data incomplete: missing legal_name' }, { status: 404, headers: CORS_HEADERS })
    }

    // Format the data to match the expected interface
    const result = {
      cik: Number(profile.cik || profile.crd_number),
      crd_number: Number(profile.crd_number),
      legal_name: profile.legal_name || profile.firm_name,
      main_addr_street1: profile.main_addr_street1 || profile.address || profile.street1 || null,
      main_addr_street2: profile.main_addr_street2 || profile.street2 || null,
      main_addr_city: profile.main_addr_city || profile.city || null,
      main_addr_state: profile.main_addr_state || profile.state || null,
      main_addr_zip: profile.main_addr_zip || profile.zip || profile.postal_code || null,
      main_addr_country: profile.main_addr_country || profile.country || 'United States',
      phone_number: profile.phone_number || profile.phone || profile.contact_phone || null,
      fax_number: profile.fax_number || profile.fax || null,
      website: profile.website || profile.website_url || profile.web_address || null,
      executives: profile.executives || profile.principals || profile.management || [],
      filings: profile.filing_date ? [{
        filing_id: profile.crd_number + '_' + profile.filing_date,
        filing_date: profile.filing_date,
        total_aum: profile.total_aum || profile.aum || profile.assets_under_management,
        manages_private_funds_flag: profile.private_fund_count > 0 || profile.manages_private_funds
      }] : [],
      private_funds: profile.private_funds || [] // Enhanced to support backend private fund details
    }

    return NextResponse.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS })
  }
}
