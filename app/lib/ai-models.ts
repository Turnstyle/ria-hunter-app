import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Ensure your API keys are set in .env.local
// For OpenAI: OPENAI_API_KEY is usually automatically picked up by the SDK.
// For Google: GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY

// OpenAI client - typically doesn't need explicit instantiation if API key is in env
export { openai };

// Infer the type of the Google client from the return type of createGoogleGenerativeAI
type GoogleClientType = ReturnType<typeof createGoogleGenerativeAI>;

const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

let googleClient: GoogleClientType | undefined;

if (googleApiKey) {
  googleClient = createGoogleGenerativeAI({
    apiKey: googleApiKey,
  });
} else {
  console.warn('Google API key not found. Google AI features will be disabled.');
}

// Export the Google client (may be undefined if no API key)
export const google = googleClient;
