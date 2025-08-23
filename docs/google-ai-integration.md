# Google AI Integration Guide

This document explains how RIA Hunter App integrates with Google AI using Google AI Studio.

## Configuration

The application uses Google's Generative AI models through the Google AI Studio API. The main model used is **Gemini 1.5 Flash** for optimal performance and throughput.

### Environment Variables

The following environment variables must be configured:

```
AI_PROVIDER=vertex
GOOGLE_AI_STUDIO_API_KEY=your_api_key_from_google_ai_studio
GOOGLE_PROJECT_ID=ria-hunter-backend
```

- `AI_PROVIDER`: Must be set to `vertex` to use Google AI models instead of OpenAI
- `GOOGLE_AI_STUDIO_API_KEY`: API key generated from Google AI Studio
- `GOOGLE_PROJECT_ID`: The Google Cloud project ID

### How the Integration Works

1. The application uses the `@ai-sdk/google` package to interact with Google AI models
2. The client is initialized in `app/lib/ai-models.ts` which prioritizes using the `GOOGLE_AI_STUDIO_API_KEY`
3. The model `gemini-1.5-flash` is used for all AI requests to optimize for throughput and performance
4. A test endpoint is available at `/api/test-ai` to verify the integration is working correctly

## Testing the Integration

You can test the integration by:

1. Making a GET request to `/api/test-ai?query=Your test query here`
2. Making a POST request to `/api/test-ai` with a JSON body: `{"query": "Your test query here"}`

The response will include:
- The model used (`gemini-1.5-flash`)
- The AI-generated response
- Token usage information

## Troubleshooting

If you encounter issues:

1. Verify the `GOOGLE_AI_STUDIO_API_KEY` is correctly set in your environment
2. Check that `AI_PROVIDER` is set to `vertex`
3. Review the browser console or server logs for specific error messages
4. Ensure the Gemini API is enabled in your Google Cloud project

## Resources

- [Google AI Studio Documentation](https://cloud.google.com/ai-studio/docs)
- [Gemini API Reference](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Google AI SDK for JavaScript](https://www.npmjs.com/package/@ai-sdk/google)