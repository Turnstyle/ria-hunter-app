// app/lib/api/client.ts
// CRITICAL: This file replaces ALL direct fetch calls in the application
// Every API request MUST go through this client to ensure consistency

import { z } from 'zod';

// Schema for the response from /api/ask endpoint
// This matches the exact structure the backend returns
export const AskResponseSchema = z.object({
  // Natural language answer from the LLM - this is what we display to users
  answer: z.string().optional(),
  
  // Structured results if the query matched specific RIAs
  results: z.array(z.object({
    id: z.string(),
    firm_name: z.string(),
    crd_number: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    aum: z.number().optional(),
    similarity: z.number().optional(),
    // Additional fields the backend might return
    description: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
    services: z.array(z.string()).optional(),
    executives: z.array(z.object({
      name: z.string(),
      title: z.string(),
    })).optional(),
    private_funds: z.array(z.object({
      name: z.string(),
      type: z.string(),
      aum: z.number().optional(),
    })).optional(),
  })).optional(),
  
  // Sources used to generate the answer
  sources: z.array(z.object({
    title: z.string().optional(),
    url: z.string().optional(),
    crd: z.string().optional(),
    snippet: z.string().optional(),
  })).optional(),
  
  // CRITICAL: This metadata contains the remaining credits
  // This is what fixes the "always shows 2 credits" bug
  metadata: z.object({
    remaining: z.number().nullable().optional(),
    isSubscriber: z.boolean().nullable().optional(),
    queryType: z.string().optional(),
    searchStrategy: z.string().optional(),
    tokensUsed: z.number().optional(),
    debug: z.any().optional(),
  }).optional(),
  
  // Error information if something went wrong
  error: z.string().optional(),
  success: z.boolean().optional(),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;

// Schema for the request to /api/ask
export const AskRequestSchema = z.object({
  query: z.string().min(1).max(500),
  options: z.object({
    // CRITICAL: These must be separate fields, not concatenated
    city: z.string().optional(),
    state: z.string().optional(),
    minAum: z.number().optional(),
    minVcActivity: z.number().optional(),
    includeDetails: z.boolean().optional(),
    maxResults: z.number().min(1).max(100).optional(),
    useHybridSearch: z.boolean().optional(),
  }).optional(),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

// Profile response schema for /api/v1/ria/profile/:id
export const ProfileResponseSchema = z.object({
  id: z.string(),
  firm_name: z.string(),
  crd_number: z.string(),
  sec_number: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  aum: z.number().optional(),
  aum_range: z.string().optional(),
  employee_count: z.number().optional(),
  services: z.array(z.string()).optional(),
  client_types: z.array(z.string()).optional(),
  year_founded: z.number().optional(),
  description: z.string().optional(),
  last_updated: z.string().optional(),
});

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// Configuration object - single source of truth for API settings
const API_CONFIG = {
  // Use environment variable for backend URL
  baseUrl: process.env.NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL || 'https://ria-hunter.vercel.app',
  
  // CRITICAL: These are the ONLY endpoints we should call
  // DO NOT use /api/v1/ria/query - it returns raw data without LLM processing
  endpoints: {
    ask: '/api/ask',                    // Main RAG endpoint - USE THIS
    askStream: '/api/ask-stream',        // Streaming version of ask
    profile: '/api/v1/ria/profile',      // Individual profile details
    subscriptionStatus: '/api/subscription-status',
    health: '/api/health',
  },
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
  
  // Request timeout
  timeoutMs: 60000, // 60 seconds for streaming
};

// Debug mode flag
const DEBUG_MODE = process.env.NODE_ENV === 'development' || 
                 process.env.NEXT_PUBLIC_DEBUG === 'true';

// Main API client class
export class RIAHunterAPIClient {
  private authToken: string | null = null;
  
  constructor() {
    // Initialize with token from session if available
    if (typeof window !== 'undefined') {
      this.loadAuthToken();
    }
  }
  
  // Load auth token from session storage or context
  private loadAuthToken() {
    // Try to get from session storage first
    const stored = sessionStorage.getItem('supabase.auth.token');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.authToken = parsed.access_token;
      } catch (e) {
        console.error('Failed to parse stored auth token:', e);
      }
    }
  }
  
  // Update auth token when user logs in/out
  setAuthToken(token: string | null) {
    this.authToken = token;
  }
  
  // Main method for asking questions - THIS REPLACES queryRia
  async ask(request: AskRequest): Promise<AskResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.ask}`;
    
    // Normalize the request data
    const normalizedRequest = this.normalizeAskRequest(request);
    
    // Make the API call with retry logic
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(normalizedRequest),
    });
    
    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 402) {
        throw new Error('CREDITS_EXHAUSTED');
      }
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_REQUIRED');
      }
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      
      // Try to get error message from response
      let errorMessage = `API request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      throw new Error(errorMessage);
    }
    
    // Parse and validate the response
    const data = await response.json();
    const parsed = AskResponseSchema.safeParse(data);
    
    if (!parsed.success) {
      console.error('Invalid API response shape:', parsed.error);
      console.error('Raw response:', data);
      
      // Return a safe fallback response
      return {
        answer: 'I received an unexpected response format. Please try again.',
        metadata: {
          remaining: null,
          isSubscriber: false,
        },
      };
    }
    
    return parsed.data;
  }
  
  // Streaming version of ask for real-time responses
  async askStream(
    request: AskRequest,
    onToken: (token: string) => void,
    onComplete: (response: AskResponse) => void,
    onError: (error: Error) => void
  ): Promise<AbortController> {
    // Build absolute URL
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.askStream}`;
    const controller = new AbortController();
    
    if (DEBUG_MODE) {
      console.log('[askStream] Request URL:', url);
      console.log('[askStream] Request method: POST');
      console.log('[askStream] Request body:', { query: request.query });
    }
    
    try {
      const normalizedRequest = this.normalizeAskRequest(request);
      
      const response = await fetch(url, {
        method: 'POST', // MUST BE POST
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-Request-Id': `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
        },
        body: JSON.stringify(normalizedRequest),
        signal: controller.signal,
        credentials: 'include', // Include cookies for anonymous tracking
        mode: 'cors', // Explicit CORS mode
      });
      
      if (DEBUG_MODE) {
        console.log('[askStream] Response status:', response.status);
        console.log('[askStream] Response headers:', Object.fromEntries(response.headers.entries()));
      }
      
      if (!response.ok) {
        // Log detailed error information
        const errorText = await response.text();
        console.error('[askStream] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Parse error based on status code
        if (response.status === 405) {
          throw new Error('METHOD_NOT_ALLOWED: Backend expects POST but may be receiving GET');
        } else if (response.status === 402) {
          throw new Error('CREDITS_EXHAUSTED');
        } else if (response.status === 401) {
          throw new Error('AUTHENTICATION_REQUIRED');
        } else if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        } else {
          throw new Error(`Stream request failed: ${response.status} ${errorText}`);
        }
      }
      
      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (DEBUG_MODE) console.log('[askStream] Stream completed');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              if (DEBUG_MODE) console.log('[askStream] Received [DONE] marker');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.token) {
                onToken(parsed.token);
              }
              
              if (parsed.complete) {
                onComplete(parsed);
              }
              
              // Update credits from response metadata
              if (parsed.metadata?.remaining !== undefined) {
                if (DEBUG_MODE) console.log('[askStream] Credits remaining:', parsed.metadata.remaining);
              }
            } catch (e) {
              console.error('[askStream] Failed to parse SSE data:', e, 'Raw data:', data);
            }
          } else if (line.startsWith('event: ')) {
            const event = line.slice(7);
            if (DEBUG_MODE) console.log('[askStream] Received event:', event);
            
            if (event === 'error') {
              // Next data line should contain error details
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error('[askStream] Stream error:', error);
      
      if (error instanceof Error && error.name !== 'AbortError') {
        onError(error);
      } else if (!(error instanceof Error)) {
        onError(new Error(String(error)));
      }
    }
    
    return controller;
  }
  
  // Fetch individual RIA profile
  async getProfile(id: string): Promise<ProfileResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.profile}/${id}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('PROFILE_NOT_FOUND');
      }
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const data = await response.json();
    const parsed = ProfileResponseSchema.safeParse(data);
    
    if (!parsed.success) {
      console.error('Invalid profile response:', parsed.error);
      throw new Error('Invalid profile data received');
    }
    
    return parsed.data;
  }
  
  // Get subscription status and credit count
  async getSubscriptionStatus(): Promise<{
    credits: number;
    isSubscriber: boolean;
    subscriptionTier: string;
  }> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.subscriptionStatus}`;
    
    if (DEBUG_MODE) {
      console.log('[getSubscriptionStatus] Request URL:', url);
    }
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.buildHeaders(),
      credentials: 'include', // Include cookies for anonymous tracking
    });
    
    if (!response.ok) {
      console.error('[getSubscriptionStatus] Error:', response.status, response.statusText);
      // Return default values if status check fails
      return {
        credits: 0,
        isSubscriber: false,
        subscriptionTier: 'free',
      };
    }
    
    const data = await response.json();
    
    if (DEBUG_MODE) {
      console.log('[getSubscriptionStatus] Response:', data);
    }
    
    return {
      credits: data.credits || 0,
      isSubscriber: data.isSubscriber || false,
      subscriptionTier: data.tier || 'free',
    };
  }
  
  // Check system health
  async checkHealth(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    services: Record<string, any>;
  }> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.health}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });
      
      if (!response.ok) {
        return {
          status: 'error',
          services: {},
        };
      }
      
      return await response.json();
    } catch (error) {
      return {
        status: 'error',
        services: {},
      };
    }
  }
  
  // CRITICAL: Normalize request data before sending
  // This ensures city and state are ALWAYS separate fields
  private normalizeAskRequest(request: AskRequest): AskRequest {
    const normalized = { ...request };
    
    if (normalized.options) {
      // Normalize city name
      if (normalized.options.city) {
        normalized.options.city = this.normalizeCity(normalized.options.city);
      }
      
      // Normalize state to uppercase 2-letter code
      if (normalized.options.state) {
        normalized.options.state = this.normalizeState(normalized.options.state);
      }
      
      // Ensure minAum is reasonable
      if (normalized.options.minAum !== undefined) {
        normalized.options.minAum = Math.max(0, Math.min(normalized.options.minAum, 1000000000000));
      }
    }
    
    return normalized;
  }
  
  // Normalize city names (e.g., "st. louis" -> "Saint Louis")
  private normalizeCity(city: string): string {
    return city
      .trim()
      .replace(/\bst\.?\s+/gi, 'Saint ')
      .replace(/\bmt\.?\s+/gi, 'Mount ')
      .replace(/\bft\.?\s+/gi, 'Fort ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Normalize state to 2-letter uppercase code
  private normalizeState(state: string): string {
    const normalized = state.trim().toUpperCase();
    
    // If already 2-letter code, return it
    if (/^[A-Z]{2}$/.test(normalized)) {
      return normalized;
    }
    
    // Map full state names to codes
    const stateMap: Record<string, string> = {
      'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
      'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT',
      'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
      'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN',
      'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA',
      'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA',
      'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
      'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
      'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
      'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
      'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR',
      'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
      'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
      'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA',
      'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
      'DISTRICT OF COLUMBIA': 'DC', 'D.C.': 'DC', 'WASHINGTON DC': 'DC'
    };
    
    return stateMap[normalized] || normalized.slice(0, 2);
  }
  
  // Build headers for API requests
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }
  
  // Fetch with retry logic for transient failures
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
      });
      
      // Retry on 5xx errors or 429 (rate limit)
      if ((response.status >= 500 || response.status === 429) && 
          attempt < API_CONFIG.retry.maxAttempts) {
        const delay = Math.min(
          API_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
          API_CONFIG.retry.maxDelayMs
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      return response;
    } catch (error) {
      // Retry on network errors
      if (attempt < API_CONFIG.retry.maxAttempts) {
        const delay = Math.min(
          API_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
          API_CONFIG.retry.maxDelayMs
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new RIAHunterAPIClient();
