'use client';

import * as Sentry from '@sentry/nextjs';
import Error from 'next/error';

export default function GlobalError({ error }) {
  Sentry.captureException(error);
  return (
    <html>
      <body>
        <Error statusCode={500} />
      </body>
    </html>
  );
}
