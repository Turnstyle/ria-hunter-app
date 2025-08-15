'use client';

export default function GlobalError({ error, reset }) {
  // Keep this minimal to avoid bundler issues in dev
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong</h2>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#6b7280', fontSize: 12 }}>
          {error?.message || 'Unknown error'}
        </pre>
        <button onClick={() => reset?.()} style={{ marginTop: 12, padding: '8px 12px', background: '#2563eb', color: '#fff', borderRadius: 6 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
