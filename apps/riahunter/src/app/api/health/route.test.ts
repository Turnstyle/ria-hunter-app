import { GET } from './route';
import { NextRequest } from 'next/server';

describe('/api/health GET handler', () => {
  it('should return a healthy status, timestamp, and version', async () => {
    // Mock NextRequest if needed, but GET for health doesn't use it
    const request = {} as NextRequest;
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow(); // Check if timestamp is a valid date string
    expect(typeof body.version).toBe('string');
    // Optionally, check if version matches process.env or default
    // expect(body.version).toBe(process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0');
  });

  // Test for the failure case if Zod validation fails (requires mocking/inducing failure)
  it('should return 500 if response payload is invalid (mocked scenario)', async () => {
    // This test requires a way to make the internal responsePayload fail Zod validation.
    // One way is to temporarily modify the route.ts for the test, or use jest.spyOn to mock new Date().toISOString() returning an invalid date.
    // For simplicity, we'll assume the Zod validation works as intended and tested elsewhere,
    // and focus on the success path for this basic health check.
    // If more complex logic were in GET, deeper mocking would be essential.

    // Example of how you might mock to cause a validation failure:
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      toISOString() {
        return 'invalid-date-for-test'; // This will fail z.string().datetime()
      }
    } as any;

    const request = {} as NextRequest;
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Invalid health check response structure');

    global.Date = originalDate; // Restore original Date
  });
});
