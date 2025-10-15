# RIA Hunter Frontend - Comprehensive Fix Plan

## Overview
This document provides step-by-step prompts for fixing the RIA Hunter frontend repository. Each section contains actionable tasks that an AI agent in Cursor IDE can execute.

**Repository:** `Turnstyle/ria-hunter-app`

---

## 🎯 Primary Objectives

1. **Remove OpenAI dependency** - Backend uses only VertexAI
2. **Replace Google OAuth with Magic Link** - Simpler Supabase auth
3. **Fix Stripe integration** - Properly proxy to backend
4. **Remove API fallback** - Always use backend proxy
5. **Ensure proper session tracking**

---

## Section 1: Remove OpenAI Dependencies

### 1.1 Update Package Dependencies

**File:** `package.json`

**Task:** Remove OpenAI SDK dependency since backend only uses Vertex.

**Steps:**
1. Find and remove: `"@ai-sdk/openai": "^1.3.22"`
2. Run: `npm install` to update lock file
3. Run: `npm run build` to verify app still builds

### 1.2 Update Documentation

**File:** `README.md`

**Task:** Remove references to OpenAI configuration.

**Steps:**
1. Find the environment variables section
2. Remove any lines mentioning:
   - `AI_PROVIDER` with `openai` option
   - OpenAI API keys
3. Update to clarify backend handles all AI processing with Vertex AI

---

## Section 2: Replace Google OAuth with Magic Link Auth

### 2.1 Update Supabase Client

**File:** `app/lib/supabase-client.ts`

**Task:** Replace Google OAuth with Magic Link authentication.

**Steps:**

1. Replace the `signInWithGoogle` function with `signInWithMagicLink`:
   ```typescript
   // Helper function to sign in with Magic Link (passwordless)
   export const signInWithMagicLink = async (email: string, redirectTo?: string) => {
     // Redirect users back to the app root by default
     const defaultRedirectTo = typeof window !== 'undefined'
       ? `${window.location.origin}/`
       : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`;
       
     return supabase.auth.signInWithOtp({
       email,
       options: {
         emailRedirectTo: redirectTo || defaultRedirectTo
       }
     });
   };
   ```

2. Remove the old `signInWithGoogle` function (lines 36-49)

3. Export the new function:
   ```typescript
   export { supabase, getSession, getUser, signOut, signInWithMagicLink };
   ```

### 2.2 Update Auth Context

**File:** `app/contexts/AuthContext.tsx`

**Task:** Update context to use Magic Link instead of Google OAuth.

**Steps:**

1. Update the import:
   ```typescript
   import { supabase, signInWithMagicLink, signOut } from '@/app/lib/supabase-client';
   ```

2. Update the interface:
   ```typescript
   interface AuthContextType {
     user: User | null;
     session: Session | null;
     loading: boolean;
     signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: AuthError | null }>;
     signOut: () => Promise<{ error: AuthError | null }>;
   }
   ```

3. Update the context value:
   ```typescript
   const contextValue: AuthContextType = {
     user,
     session,
     loading,
     signInWithMagicLink: async (email: string, redirectTo?: string) => {
       try {
         return await signInWithMagicLink(email, redirectTo);
       } catch (error) {
         console.error('Sign in error:', error);
         return { error: error as AuthError };
       }
     },
     signOut: async () => {
       try {
         const result = await signOut();
         if (!result.error) {
           setUser(null);
           setSession(null);
         }
         return result;
       } catch (error) {
         console.error('Sign out error:', error);
         return { error: error as AuthError };
       }
     }
   };
   ```

### 2.3 Update Login Button Component

**File:** `app/components/auth/LoginButton.tsx`

**Task:** Replace Google sign-in button with email input form for Magic Link.

**Steps:**

1. Replace the entire component with this new implementation:
   ```typescript
   'use client';

   import { useState } from 'react';
   import { useAuth } from '@/app/contexts/AuthContext';

   interface LoginButtonProps {
     className?: string;
     redirectTo?: string;
   }

   export default function LoginButton({ className = '', redirectTo }: LoginButtonProps) {
     const { signInWithMagicLink, loading: authLoading } = useAuth();
     const [email, setEmail] = useState('');
     const [isSubmitting, setIsSubmitting] = useState(false);
     const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
     const [showForm, setShowForm] = useState(false);

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       
       if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
         setMessage({ type: 'error', text: 'Please enter a valid email address' });
         return;
       }

       setIsSubmitting(true);
       setMessage(null);

       try {
         const { error } = await signInWithMagicLink(email, redirectTo);
         
         if (error) {
           setMessage({ type: 'error', text: error.message || 'Failed to send magic link' });
         } else {
           setMessage({ 
             type: 'success', 
             text: 'Check your email! We sent you a sign-in link.' 
           });
           setEmail('');
           setTimeout(() => setShowForm(false), 3000);
         }
       } catch (error) {
         setMessage({ 
           type: 'error', 
           text: 'An unexpected error occurred. Please try again.' 
         });
       } finally {
         setIsSubmitting(false);
       }
     };

     if (!showForm) {
       return (
         <button
           onClick={() => setShowForm(true)}
           className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${className}`}
           disabled={authLoading}
         >
           Sign In
         </button>
       );
     }

     return (
       <div className={`relative ${className}`}>
         <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white rounded-lg shadow-lg min-w-[300px]">
           <div className="flex justify-between items-center mb-2">
             <h3 className="font-semibold text-gray-900">Sign In</h3>
             <button
               type="button"
               onClick={() => {
                 setShowForm(false);
                 setMessage(null);
                 setEmail('');
               }}
               className="text-gray-400 hover:text-gray-600"
             >
               ✕
             </button>
           </div>
           
           <input
             type="email"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             placeholder="Enter your email"
             className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
             disabled={isSubmitting}
             required
           />
           
           <button
             type="submit"
             disabled={isSubmitting}
             className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isSubmitting ? 'Sending...' : 'Send Magic Link'}
           </button>

           {message && (
             <div className={`text-sm p-2 rounded ${
               message.type === 'success' 
                 ? 'bg-green-50 text-green-800' 
                 : 'bg-red-50 text-red-800'
             }`}>
               {message.text}
             </div>
           )}

           <p className="text-xs text-gray-500 text-center">
             We'll email you a link to sign in. No password needed!
           </p>
         </form>
       </div>
     );
   }
   ```

### 2.4 Update User Menu Component (if exists)

**File:** `app/components/auth/UserMenu.tsx`

**Task:** Verify sign-out still works correctly.

**Steps:**
1. Check if this file exists
2. If it does, verify it uses the `signOut` function from `useAuth()`
3. No changes should be needed since sign-out is the same

### 2.5 Remove Google OAuth Configuration References

**Files to update:**
- `.env.example`
- `.env.local.backup` (if exists)
- Documentation files

**Task:** Remove Google OAuth client ID/secret references.

**Steps:**
1. Search for `GOOGLE_OAUTH` in all files
2. Remove any environment variables related to Google OAuth
3. Update `.env.example` to only include:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-publishable-key
   STRIPE_SECRET_KEY=your-secret-key
   STRIPE_WEBHOOK_SECRET=your-webhook-secret
   STRIPE_PRICE_ID=your-price-id
   ```

---

## Section 3: Fix Stripe Integration

### 3.1 Remove Frontend Checkout Session Creation

**File:** `app/api/create-checkout-session/route.ts`

**Current Issue:** Frontend duplicates backend logic. Should proxy to backend instead.

**Task:** Replace with a proxy to the backend.

**Steps:**

1. Replace the entire file content with:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';

   /**
    * Proxy checkout session creation to backend
    * The backend handles all Stripe logic
    */
   export async function POST(request: NextRequest) {
     try {
       const authHeader = request.headers.get('Authorization');
       if (!authHeader) {
         return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
       }

       // Get the backend URL from environment or use default proxy
       const backendUrl = process.env.BACKEND_URL || 'https://ria-hunter.vercel.app';
       
       // Forward request to backend
       const response = await fetch(`${backendUrl}/api/create-checkout-session`, {
         method: 'POST',
         headers: {
           'Authorization': authHeader,
           'Content-Type': 'application/json',
         },
         body: await request.text(),
       });

       const data = await response.json();
       return NextResponse.json(data, { status: response.status });

     } catch (error) {
       console.error('Checkout session proxy error:', error);
       return NextResponse.json(
         { error: 'Failed to create checkout session' },
         { status: 500 }
       );
     }
   }
   ```

2. Verify the backend URL is correct in environment variables

### 3.2 Verify Stripe Component Configuration

**File:** `app/components/subscription/UpgradeButton.tsx`

**Task:** Ensure it correctly calls the checkout endpoint.

**Current Implementation:** Already calls `/api/create-checkout-session` which will now proxy to backend.

**Steps:**
1. Open the file and verify line 34 calls `/api/create-checkout-session`
2. Verify it includes Authorization header (line 37)
3. No changes needed - the proxy handles everything

### 3.3 Update Subscription Status Fetching

**Files to check:**
- `app/hooks/useSessionDemo.ts`
- Any other hooks fetching subscription status

**Task:** Ensure they fetch from the backend session status endpoint.

**Steps:**
1. Verify the endpoint is `/api/session/status` 
2. Ensure Authorization header is included
3. The backend endpoint already exists and works - just verify frontend calls it correctly

---

## Section 4: Remove API Fallback

### 4.1 Remove or Simplify Frontend Ask Endpoint

**File:** `app/api/ask/route.ts`

**Current Issue:** Frontend has its own implementation that queries Supabase directly. This creates confusion and duplication.

**Task:** Remove this file entirely since all requests should proxy to backend via next.config.js.

**Steps:**

1. Delete the file: `app/api/ask/route.ts`

2. Verify `next.config.js` has the proxy rewrite:
   ```javascript
   async rewrites() {
     return [
       {
         source: '/api/:path*',
         destination: 'https://ria-hunter.vercel.app/api/:path*',
       },
     ];
   }
   ```

3. Test that API calls still work (they should proxy to backend automatically)

**Alternative (if deletion causes issues):**

If you need a fallback for some reason, replace with a simple proxy:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.warn('Frontend fallback API called - this should proxy to backend via next.config.js');
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'https://ria-hunter.vercel.app';
    const response = await fetch(`${backendUrl}/api/ask`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: await request.text(),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Backend proxy error:', error);
    return NextResponse.json(
      { error: 'Backend is temporarily unavailable' },
      { status: 503 }
    );
  }
}
```

### 4.2 Clean Up Other Duplicate API Routes

**Task:** Check for other API routes that duplicate backend functionality.

**Steps:**
1. List all files in `app/api/` directory
2. For each endpoint, determine if it:
   - Should proxy to backend (most cases)
   - Is frontend-only logic (rare)
   - Can be deleted (duplicates)
3. Common endpoints that should proxy:
   - `/api/ask` (already handled)
   - `/api/ask/browse`
   - `/api/balance`
   - `/api/session/status`
   - All Stripe endpoints

---

## Section 5: Update API Client

### 5.1 Review API Client Configuration

**File:** `app/lib/api/client.ts`

**Task:** Ensure API client uses the proxy correctly.

**Steps:**

1. Verify the base URL configuration (around lines 20-30)
2. Ensure it uses relative paths (e.g., `/api/ask`) not absolute backend URLs
3. The next.config.js rewrites will handle proxying automatically
4. Verify error handling is robust

**Expected configuration:**
```typescript
class RIAHunterAPIClient {
  private baseURL: string;

  constructor() {
    // Use relative paths - next.config.js rewrites will proxy to backend
    this.baseURL = '/api';
  }

  async ask(request: AskRequest): Promise<AskResponse> {
    const response = await fetch(`${this.baseURL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: JSON.stringify(request)
    });
    
    // ... error handling ...
  }
}
```

### 5.2 Update Session Demo Hook

**File:** `app/hooks/useSessionDemo.ts`

**Task:** Ensure it fetches from backend session status endpoint.

**Steps:**
1. Verify the endpoint URL is `/api/session/status` (should proxy to backend)
2. Ensure it includes Authorization header if user is logged in
3. Verify it handles both authenticated and anonymous users
4. The backend endpoint already returns the correct format

---

## Section 6: Update Documentation

### 6.1 Update README

**File:** `README.md`

**Task:** Update authentication and API sections.

**Steps:**

1. Update the authentication section:
   ```markdown
   ## Authentication

   RIA Hunter uses Supabase Magic Link authentication:
   
   - **Passwordless**: No passwords to remember
   - **Secure**: One-time links sent to email
   - **Simple**: Just enter your email to sign in
   
   ### How it works
   
   1. User enters their email address
   2. Supabase sends a magic link to their email
   3. User clicks the link to sign in
   4. Session is created and persisted
   ```

2. Update the API section:
   ```markdown
   ## API Architecture

   The frontend proxies all `/api/*` requests to the backend:
   
   - **Frontend** (this repo): UI and user interactions
   - **Backend** (ria-hunter): AI processing, database, auth
   - **Proxy**: next.config.js automatically forwards API requests
   
   This separation keeps the frontend simple and the backend powerful.
   ```

### 6.2 Update Implementation README

**File:** `IMPLEMENTATION_README.md`

**Task:** Update authentication flow section.

**Steps:**
1. Replace Google OAuth references with Magic Link flow
2. Update diagrams or flow descriptions
3. Update setup instructions:
   ```markdown
   ### 3. Supabase Authentication Setup

   1. Go to Supabase Dashboard → Authentication → Providers
   2. Ensure Email provider is enabled
   3. Configure email templates:
      - Customize the Magic Link email template
      - Set your app name and branding
   4. Test the flow:
      - Enter your email in the app
      - Check your email for the magic link
      - Click to sign in
   ```

---

## Section 7: Testing & Verification

### 7.1 Local Testing Checklist

**Run these tests after making changes:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build test:**
   ```bash
   npm run build
   ```
   Should complete with no errors

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Test Magic Link Authentication:**
   - Click "Sign In" button
   - Enter your email
   - Check your email inbox
   - Click the magic link
   - Verify you're signed in
   - Check browser console for errors

5. **Test API Proxy:**
   - Make a search query
   - Check browser Network tab
   - Verify request goes to `/api/ask`
   - Verify backend processes it (check response)

6. **Test Subscription Flow:**
   - Click "Upgrade to Pro"
   - Verify Stripe checkout opens
   - Complete test checkout
   - Verify subscription status updates

### 7.2 User Experience Testing

**Test these user flows:**

1. **Anonymous User:**
   - Visit site without signing in
   - Make 5 demo searches
   - Verify paywall appears after 5 searches
   - Sign in with magic link
   - Verify searches work again

2. **Signed-In User:**
   - Sign in with magic link
   - Make searches (should have demo limit)
   - Upgrade to Pro
   - Verify unlimited searches after upgrade

3. **Returning User:**
   - Sign in with magic link
   - Close browser
   - Reopen browser
   - Verify still signed in
   - Verify session persists

### 7.3 Error Handling Testing

**Test error scenarios:**

1. Invalid email format
2. Backend unavailable
3. Expired magic link
4. Failed Stripe checkout
5. Network errors during search

---

## Section 8: Deployment Preparation

### 8.1 Environment Variables

**Vercel Dashboard Setup:**

1. Go to Vercel project settings → Environment Variables

2. Remove:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - Any OpenAI-related variables

3. Ensure these are set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   NEXT_PUBLIC_APP_URL=https://ria-hunter-app.vercel.app
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   BACKEND_URL=https://ria-hunter.vercel.app
   ```

### 8.2 Supabase Configuration

**Manual steps in Supabase Dashboard:**

1. **Email Templates:**
   - Go to Authentication → Email Templates
   - Customize "Magic Link" template
   - Add your branding
   - Test email delivery

2. **URL Configuration:**
   - Go to Authentication → URL Configuration
   - Set Site URL: `https://ria-hunter-app.vercel.app`
   - Set Redirect URLs: `https://ria-hunter-app.vercel.app/*`

3. **Email Auth Settings:**
   - Enable "Confirm email" (optional, recommended)
   - Set "Minimum password length" (not used with magic link)
   - Configure "Email rate limits" to prevent abuse

### 8.3 Deploy

**Steps:**

1. Commit all changes:
   ```bash
   git add .
   git commit -m "Replace Google OAuth with Magic Link, remove OpenAI deps, fix Stripe proxy"
   git push origin main
   ```

2. Vercel will auto-deploy

3. Monitor deployment logs for errors

4. Test production deployment:
   - Visit production URL
   - Test magic link sign-in
   - Test search functionality
   - Test subscription upgrade

---

## Section 9: Monitoring & Maintenance

### 9.1 Setup Monitoring

**Recommended tools:**

1. **Vercel Analytics:**
   - Already built-in
   - Monitor page views and performance
   - Check Web Vitals

2. **Supabase Dashboard:**
   - Monitor auth events
   - Check email delivery
   - View error logs

3. **Stripe Dashboard:**
   - Monitor subscriptions
   - Track revenue
   - Handle customer issues

### 9.2 Error Tracking

**Setup error logging:**

1. Ensure console.error calls in key places:
   - Authentication failures
   - API errors
   - Stripe failures

2. Consider adding error tracking service (optional):
   - Sentry
   - LogRocket
   - Datadog

### 9.3 User Feedback

**Collect feedback on new auth flow:**

1. Add feedback button/form
2. Monitor support requests
3. Track authentication success rate
4. Measure conversion from demo to paid

---

## 🎬 Final Verification Checklist

After completing all sections, verify:

- [ ] OpenAI dependencies removed from package.json
- [ ] `npm run build` succeeds with no errors
- [ ] Magic Link authentication works end-to-end
- [ ] Google OAuth code completely removed
- [ ] All API calls proxy to backend correctly
- [ ] Frontend `/api/ask` removed (or replaced with proxy)
- [ ] Stripe checkout creates sessions via backend proxy
- [ ] Session tracking works for auth and anonymous users
- [ ] Environment variables properly configured
- [ ] Documentation updated with new auth flow
- [ ] Production deployment successful
- [ ] All user flows tested and working

---

## Common Issues & Solutions

### Issue: Magic link email not received

**Solutions:**
1. Check Supabase email configuration
2. Verify email provider settings
3. Check spam folder
4. Test with different email provider (Gmail vs Outlook)

### Issue: API proxy not working

**Solutions:**
1. Verify next.config.js rewrites configuration
2. Check BACKEND_URL environment variable
3. Ensure backend is deployed and accessible
4. Check CORS configuration on backend

### Issue: Session not persisting

**Solutions:**
1. Check Supabase cookie settings
2. Verify domain configuration in Supabase
3. Check browser cookie restrictions
4. Test in different browser

### Issue: Stripe checkout fails

**Solutions:**
1. Verify backend Stripe webhook is configured
2. Check Stripe API keys are correct
3. Verify backend is properly proxying
4. Test with Stripe test mode first

---

## Notes for Cursor AI Agent

When executing these prompts:

1. **Work sequentially through sections** - Each section builds on previous ones
2. **Test after each major change** - Don't wait until the end
3. **Pay attention to file paths** - Ensure you're editing the correct files
4. **Check imports** - Update imports when changing function names
5. **Verify environment variables** - Many issues come from misconfiguration
6. **Test the user experience** - Don't just check that code compiles
7. **Read error messages carefully** - They often tell you exactly what's wrong

The goal is a working frontend that:
- Uses passwordless Magic Link authentication
- Has no OpenAI dependencies
- Properly proxies all API calls to backend
- Works seamlessly with the updated backend
- Provides excellent user experience
