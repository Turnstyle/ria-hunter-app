import { NextResponse } from 'next/server'

// Proxy that fetches backend combined funds info first, then falls back to summary-only.
// Swallows 404s from the backend and returns 200 with an empty summary to avoid noisy browser logs.

export async function GET(_req: Request, context: any) {
  const params = context?.params as { id?: string }
  // Backend is on same domain at /_backend/api/*
  const backendBase = 'https://ria-hunter.app/_backend'
  const id = params?.id as string | undefined
  
  if (!id) {
    return NextResponse.json({ summary: [] }, { status: 200 })
  }
  const base = backendBase.replace(/\/$/, '')
  try {
    // Try combined endpoint
    let resp = await fetch(`${base}/api/v1/ria/funds/${id}`, { cache: 'no-store' })
    if (!resp.ok) {
      // Fallback to summary-only
      resp = await fetch(`${base}/api/v1/ria/funds/summary/${id}`, { cache: 'no-store' })
    }
    if (resp.status === 404) {
      return NextResponse.json({ summary: [] }, { status: 200 })
    }
    const text = await resp.text()
    try {
      const data = text ? JSON.parse(text) : { summary: [] }
      // Normalize to always include summary array
      const summary = Array.isArray(data?.summary) ? data.summary : []
      return NextResponse.json({ summary }, { status: 200 })
    } catch {
      return NextResponse.json({ summary: [] }, { status: 200 })
    }
  } catch {
    return NextResponse.json({ summary: [] }, { status: 200 })
  }
}


