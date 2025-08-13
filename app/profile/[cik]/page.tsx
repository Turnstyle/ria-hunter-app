'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';

interface RIAProfile {
  cik: number;
  crd_number: number | null;
  legal_name: string;
  main_addr_street1: string | null;
  main_addr_street2: string | null;
  main_addr_city: string | null;
  main_addr_state: string | null;
  main_addr_zip: string | null;
  main_addr_country: string | null;
  phone_number: string | null;
  fax_number: string | null;
  website: string | null;
  is_st_louis_msa: boolean | null;
  executives?: Array<{ name: string; title?: string | null }>;
  filings: Array<{
    filing_id: string;
    filing_date: string;
    total_aum: number | null;
    manages_private_funds_flag: boolean | null;
    report_period_end_date: string | null;
  }>;
  private_funds: Array<{
    fund_id: string;
    fund_name: string;
    fund_type: string | null;
    gross_asset_value: number | null;
    min_investment: number | null;
  }>;
}

// Removed deprecated Living Profile (notes/tags/links)

type FundSummaryItem = { type: string; type_short: string; count: number };
type PrivateFund = {
  crd_number: number;
  filing_id: number | null;
  reference_id: number | null;
  fund_name: string | null;
  fund_id: string | null;
  fund_type: string | null;
  fund_type_other: string | null;
  gross_asset_value: number | null;
  min_investment: number | null;
  is_3c1: boolean | null;
  is_3c7: boolean | null;
  is_master: boolean | null;
  is_feeder: boolean | null;
  master_fund_name: string | null;
  master_fund_id: string | null;
  is_fund_of_funds: boolean | null;
  invested_self_related: boolean | null;
  invested_securities: boolean | null;
  prime_brokers: string | null;
  custodians: string | null;
  administrator: string | null;
  percent_assets_valued: number | null;
  marketing: boolean | null;
  annual_audit: boolean | null;
  gaap: boolean | null;
  fs_distributed: boolean | null;
  unqualified_opinion: boolean | null;
  owners: number | null;
};
type FundMarketer = {
  crd_number: number;
  filing_id: number | null;
  fund_reference_id: number | null;
  related_person: boolean;
  marketer_name: string | null;
  marketer_sec_number: string | null;
  marketer_crd_number: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
};

function RIAProfileContent() {
  const params = useParams();
  const { user, loading: userLoading } = useAuth();
  const cik = params?.cik as string;

  const [profile, setProfile] = useState<RIAProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Living Profile removed

  // Funds data
  const [fundSummary, setFundSummary] = useState<FundSummaryItem[] | null>(null);
  const [funds, setFunds] = useState<PrivateFund[] | null>(null);
  const [marketers, setMarketers] = useState<FundMarketer[] | null>(null);
  const [fundsError, setFundsError] = useState<string | null>(null);

  useEffect(() => {
    if (cik) {
      fetchProfile();
      // Living Profile removed
      fetchFundsData();
    }
  }, [cik, user]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
      if (!apiBase) throw new Error('Profile service not configured');

      // Prefer explicit profile endpoint if available
      let resp = await fetch(`${apiBase}/api/v1/ria/profile/${cik}`);
      if (!resp.ok) {
        // Fallback: query by CIK
        resp = await fetch(`${apiBase}/api/v1/ria/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `Show profile for RIA with CIK ${cik}` })
        });
      }
      if (!resp.ok) throw new Error('Failed to fetch profile');
      const raw = await resp.json();
      const item = Array.isArray(raw?.results) ? raw.results[0] : (Array.isArray(raw?.data) ? raw.data[0] : raw);

      const normalized: RIAProfile = {
        cik: Number(item?.cik || cik),
        crd_number: item?.crd_number ?? null,
        legal_name: item?.legal_name || item?.firm_name || 'Unknown',
        main_addr_street1: item?.main_addr_street1 || item?.main_office_location?.street || null,
        main_addr_street2: item?.main_addr_street2 || null,
        main_addr_city: item?.main_addr_city || item?.main_office_location?.city || null,
        main_addr_state: item?.main_addr_state || item?.main_office_location?.state || null,
        main_addr_zip: item?.main_addr_zip || item?.main_office_location?.zipcode || null,
        main_addr_country: item?.main_addr_country || item?.main_office_location?.country || null,
        phone_number: item?.phone_number || null,
        fax_number: item?.fax_number || null,
        website: item?.website || null,
        is_st_louis_msa: item?.is_st_louis_msa ?? null,
        executives: Array.isArray(item?.executives)
          ? item.executives.map((e: any) => ({
              name: e?.name || e?.person_name || '',
              title: e?.title ?? null,
            })).filter((e: { name: string }) => e.name)
          : [],
        filings: (item?.filings || []).map((f: any) => ({
          filing_id: String(f.id ?? f.filing_id ?? ''),
          filing_date: f.filing_date,
          total_aum: f.total_aum ?? null,
          manages_private_funds_flag: f.manages_private_funds_flag ?? (f.private_fund_count ? f.private_fund_count > 0 : null),
          report_period_end_date: f.report_period_end_date ?? null,
        })),
        private_funds: (item?.private_funds || []).map((pf: any) => ({
          fund_id: String(pf.id ?? pf.fund_id ?? ''),
          fund_name: pf.fund_name,
          fund_type: pf.fund_type ?? null,
          gross_asset_value: pf.gross_asset_value ?? null,
          min_investment: pf.min_investment ?? null,
        })),
      };
      setProfile(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFundsData = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
      if (!apiBase) return;
      const resp = await fetch(`${apiBase.replace(/\/$/, '')}/api/v1/ria/funds/${cik}`, { cache: 'no-store' });
      if (!resp.ok) {
        // Try summary-only if combined endpoint not present
        const sum = await fetch(`${apiBase.replace(/\/$/, '')}/api/v1/ria/funds/summary/${cik}`, { cache: 'no-store' });
        if (sum.ok) {
          const d = await sum.json();
          setFundSummary(Array.isArray(d?.summary) ? d.summary : []);
        }
        return;
      }
      const data = await resp.json();
      if (Array.isArray(data?.summary)) setFundSummary(data.summary);
      if (Array.isArray(data?.funds)) setFunds(data.funds);
      if (Array.isArray(data?.marketers)) setMarketers(data.marketers);
    } catch (e) {
      setFundsError('Failed to load funds data');
    }
  };

  // Removed Living Profile actions

  const formatAUM = (aum: number | null): string => {
    if (!aum) return 'N/A';

    if (aum >= 1_000_000_000) {
      return `$${(aum / 1_000_000_000).toFixed(1)}B`;
    } else if (aum >= 1_000_000) {
      return `$${(aum / 1_000_000).toFixed(1)}M`;
    } else if (aum >= 1_000) {
      return `$${(aum / 1_000).toFixed(1)}K`;
    }
    return `$${aum.toLocaleString()}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The requested RIA profile could not be found.'}</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <Link href="/" className="text-indigo-600 hover:text-indigo-500 mr-4">
                ← Back to Search
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">RIA Profile</h1>
            </div>
            {!userLoading && user && (
              <div className="text-sm text-gray-500">
                Logged in as {(user as any)?.name || (user as any)?.email || 'User'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{profile.legal_name}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Address</h3>
                  <div className="mt-1 text-sm text-gray-900">
                    {profile.main_addr_street1 && <div>{profile.main_addr_street1}</div>}
                    {profile.main_addr_street2 && <div>{profile.main_addr_street2}</div>}
                    <div>
                      {[profile.main_addr_city, profile.main_addr_state, profile.main_addr_zip]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact</h3>
                  <div className="mt-1 text-sm text-gray-900 space-y-1">
                    {profile.phone_number && (
                      <div>
                        Phone{' '}
                        <a
                          href={`tel:${profile.phone_number.replace(/[^\\d+]/g, '')}`}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          {profile.phone_number}
                        </a>
                      </div>
                    )}
                    {profile.fax_number && (
                      <div>
                        Fax{' '}
                        <a
                          href={`fax:${profile.fax_number.replace(/[^\d+]/g, '')}`}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          {profile.fax_number}
                        </a>
                      </div>
                    )}
                    {profile.website && (
                      <div>
                        {(() => {
                          let display = profile.website
                          try { display = new URL(profile.website).hostname } catch {}
                          return (
                            <a
                              href={profile.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-500"
                            >
                              {display}
                            </a>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fund type chips */}
              {fundSummary && fundSummary.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Private Fund Types</div>
                  <div className="flex flex-wrap gap-2">
                    {fundSummary.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {s.type_short} <span className="ml-1 text-indigo-700">{s.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Identifiers</h3>
                  <div className="mt-1 text-sm text-gray-900">
                    <div>CIK: {profile.cik}</div>
                    <div>CRD: {profile.crd_number || 'N/A'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Location</h3>
                  <div className="mt-1">
                    {profile.is_st_louis_msa && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        St. Louis MSA
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {profile.executives && profile.executives.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500">Key Executives</h3>
                  <ul className="mt-2 text-sm text-gray-900 list-disc list-inside space-y-1">
                    {profile.executives.map((exec, idx) => (
                      <li key={idx}>
                        {exec.title ? (
                          <span>
                            {exec.name} – {exec.title}
                          </span>
                        ) : (
                          <span>{exec.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Filings */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Filings</h3>
              {profile.filings && profile.filings.length > 0 ? (
                <div className="space-y-3">
                  {profile.filings.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{formatDate(f.filing_date)}</div>
                        <div className="text-gray-600 text-xs">
                          AUM: {formatAUM(f.total_aum)}
                          {typeof f.manages_private_funds_flag === 'boolean' && (
                            <span className="ml-2">{f.manages_private_funds_flag ? '• Private funds' : '• No private funds'}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">ID: {f.filing_id}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No filings available.</p>
              )}
            </div>

            {/* Private Funds */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Private Funds</h3>
                {/* Future tab toggle could switch to Marketers */}
              </div>
              {(funds && funds.length > 0) || (profile.private_funds && profile.private_funds.length > 0) ? (
                <ul className="space-y-2 text-sm text-gray-900">
                  {(funds && funds.length > 0 ? funds : profile.private_funds).map((pf: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {pf.fund_name || pf.fund_id || 'Fund'}
                          {(pf.fund_type || pf.fund_type_other) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-800">
                              {pf.fund_type || pf.fund_type_other}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 text-xs">Min Inv: {pf.min_investment ? `$${pf.min_investment.toLocaleString()}` : 'N/A'}</div>
                        {pf.is_feeder && pf.master_fund_name && (
                          <div className="text-gray-600 text-xs">Feeder to: {pf.master_fund_name}</div>
                        )}
                        {(pf.prime_brokers || pf.custodians || pf.administrator) && (
                          <div className="text-gray-500 text-[11px] mt-1">
                            Providers: {[pf.prime_brokers, pf.custodians, pf.administrator].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-600 text-xs">GAV: {pf.gross_asset_value ? formatAUM(pf.gross_asset_value) : 'N/A'}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No private funds reported.</p>
              )}
              {fundsError && (
                <p className="text-xs text-red-600 mt-2">{fundsError}</p>
              )}
            </div>

            {/* Marketers */}
            {marketers && marketers.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Placement / Marketers</h3>
                <ul className="space-y-2 text-sm text-gray-900">
                  {marketers.map((m, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {m.website ? (
                            <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">{m.marketer_name}</a>
                          ) : (
                            <span>{m.marketer_name}</span>
                          )}
                        </div>
                        <div className="text-gray-600 text-xs">
                          {[m.city, m.state, m.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <div className="text-gray-600 text-xs">
                        {m.marketer_crd_number ? `CRD ${m.marketer_crd_number}` : (m.marketer_sec_number ? `SEC ${m.marketer_sec_number}` : '')}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Living Profile Sidebar removed */}
        </div>
      </div>
    </div>
  );
}

export default function RIAProfilePage() {
  return (
    <RIAProfileContent />
  );
}
