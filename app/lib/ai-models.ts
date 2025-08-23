import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Ensure your API keys are set in .env.local
// For OpenAI: OPENAI_API_KEY is usually automatically picked up by the SDK.
// For Google: GOOGLE_AI_STUDIO_API_KEY (preferred, from Google AI Studio) or GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY

// OpenAI client - typically doesn't need explicit instantiation if API key is in env
export { openai };

// Infer the type of the Google client from the return type of createGoogleGenerativeAI
type GoogleClientType = ReturnType<typeof createGoogleGenerativeAI>;

let googleClient: GoogleClientType | undefined = undefined;
let googleClientChecked = false;

// Lazy initialization function for Google client
export function getGoogleClient(): GoogleClientType | undefined {
  if (googleClientChecked) {
    return googleClient;
  }

  const googleApiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (googleApiKey) {
    googleClient = createGoogleGenerativeAI({
      apiKey: googleApiKey,
    });
  } else {
    // Only warn at runtime, not during build
    if (typeof window !== 'undefined' || process.env.NODE_ENV === 'production') {
      console.warn('Google API key not found. Google AI features will be disabled.');
    }
    googleClient = undefined;
  }
  
  googleClientChecked = true;
  return googleClient;
}

// Export a getter function instead of the client directly
export const google = getGoogleClient;
