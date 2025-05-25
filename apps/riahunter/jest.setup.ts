console.log(`jest.setup.ts: NODE_ENV is ${process.env.NODE_ENV}`);

// Mock environment variables
process.env.RIA_HUNTER_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0-test';
process.env.NEXT_PUBLIC_AXIOM_TOKEN = 'test-axiom-token';
process.env.NEXT_PUBLIC_AXIOM_DATASET = 'riahunter-test';
process.env.NEXT_PUBLIC_SENTRY_DSN = 'test-sentry-dsn';
process.env.NEXT_PUBLIC_VERCEL_ENV = 'test';

// Mock crypto for UUID generation
import { randomUUID } from 'crypto';

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => randomUUID(),
  },
});

jest.mock('next-axiom', () => {
  const actualNextAxiom = jest.requireActual('next-axiom');
  return {
    ...actualNextAxiom,
    withAxiom: <T extends (...args: any[]) => any>(handler: T): T => handler,
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      flush: jest.fn(),
    },
  };
});
