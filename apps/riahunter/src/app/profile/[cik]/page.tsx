'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserProvider, useUser } from '@auth0/nextjs-auth0/client';
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

interface UserNote {
  id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

interface UserTag {
  id: string;
  tag_text: string;
  created_at: string;
}

interface UserLink {
  id: string;
  link_url: string;
  link_description: string | null;
  created_at: string;
}

function RIAProfileContent() {
  const params = useParams();
  const { user, isLoading: userLoading } = useUser();
  const cik = params?.cik as string;

  const [profile, setProfile] = useState<RIAProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Living Profile data
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [tags, setTags] = useState<UserTag[]>([]);
  const [links, setLinks] = useState<UserLink[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');

  useEffect(() => {
    if (cik) {
      fetchProfile();
      if (user) {
        fetchLivingProfileData();
      }
    }
  }, [cik, user]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      // For now, we'll create a profile API endpoint
      const response = await fetch(`/api/ria-hunter/profile/${cik}`);
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLivingProfileData = async () => {
    if (!user) return;

    try {
      // Fetch notes, tags, and links
      const [notesRes, tagsRes, linksRes] = await Promise.all([
        fetch(`/api/ria-hunter/profile/notes?ria_id=${cik}`),
        fetch(`/api/ria-hunter/profile/tags?ria_id=${cik}`),
        fetch(`/api/ria-hunter/profile/links?ria_id=${cik}`)
      ]);

      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData);
      }
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setTags(tagsData);
      }
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinks(linksData);
      }
    } catch (err) {
      console.error('Failed to fetch living profile data:', err);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !user) return;

    try {
      const response = await fetch('/api/ria-hunter/profile/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ria_id: cik,
          note_text: newNote.trim()
        })
      });

      if (response.ok) {
        const newNoteData = await response.json();
        setNotes([newNoteData, ...notes]);
        setNewNote('');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const addTag = async () => {
    if (!newTag.trim() || !user) return;

    try {
      const response = await fetch('/api/ria-hunter/profile/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ria_id: cik,
          tag_text: newTag.trim()
        })
      });

      if (response.ok) {
        const newTagData = await response.json();
        setTags([...tags, newTagData]);
        setNewTag('');
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const addLink = async () => {
    if (!newLinkUrl.trim() || !user) return;

    try {
      const response = await fetch('/api/ria-hunter/profile/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ria_id: cik,
          link_url: newLinkUrl.trim(),
          link_description: newLinkDesc.trim() || null
        })
      });

      if (response.ok) {
        const newLinkData = await response.json();
        setLinks([newLinkData, ...links]);
        setNewLinkUrl('');
        setNewLinkDesc('');
      }
    } catch (err) {
      console.error('Failed to add link:', err);
    }
  };

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
                Logged in as {user.name}
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
                    {profile.phone_number && <div>Phone: {profile.phone_number}</div>}
                    {profile.fax_number && <div>Fax: {profile.fax_number}</div>}
                    {profile.website && (
                      <div>
                        <a href={profile.website} target="_blank" rel="noopener noreferrer"
                           className="text-indigo-600 hover:text-indigo-500">
                          {profile.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
            </div>

            {/* Placeholder for filings - will be populated once we create the profile API */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Filings</h3>
              <p className="text-gray-500">Filing data will be displayed here once the profile API is implemented.</p>
            </div>
          </div>

          {/* Living Profile Sidebar */}
          <div className="space-y-6">
            {user ? (
              <>
                {/* Notes */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">My Notes</h3>

                  <div className="mb-4">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                    />
                    <button
                      onClick={addNote}
                      className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                      Add Note
                    </button>
                  </div>

                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="border-l-4 border-yellow-400 pl-3">
                        <div className="text-sm text-gray-900">{note.note_text}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(note.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">My Tags</h3>

                  <div className="mb-4">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={addTag}
                      className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                      Add Tag
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag.tag_text}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Links */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">My Links</h3>

                  <div className="mb-4 space-y-2">
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="URL..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={newLinkDesc}
                      onChange={(e) => setNewLinkDesc(e.target.value)}
                      placeholder="Description (optional)..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={addLink}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                      Add Link
                    </button>
                  </div>

                  <div className="space-y-3">
                    {links.map((link) => (
                      <div key={link.id} className="border border-gray-200 rounded p-3">
                        <a
                          href={link.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                        >
                          {link.link_description || link.link_url}
                        </a>
                        <div className="text-xs text-gray-500 mt-1">
                          Added {formatDate(link.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Living Profile</h3>
                <p className="text-gray-600 mb-4">
                  Sign in to add personal notes, tags, and links to this RIA profile.
                </p>
                <a
                  href="/api/auth/login"
                  className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-center block"
                >
                  Sign In
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RIAProfilePage() {
  return (
    <UserProvider>
      <RIAProfileContent />
    </UserProvider>
  );
}
