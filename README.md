# RIA Hunter App

A Next.js application for searching and analyzing Registered Investment Advisor (RIA) profiles. Features include profile management by SEC/CRD numbers, investment thesis matching, advanced RAG search capabilities, and organizational tools.

## Features

- **RAG Search**: Retrieval-Augmented Generation search that answers questions like "What are the 10 most active RIAs in Missouri with VC activity and who are their executives?"
- **Browse**: Filter and sort RIAs by state, VC activity, AUM, and more
- **Profiles**: View detailed information about RIAs including executives, funds, and services
- **Credits & Subscription**: Manage user credits and subscription status
- **Responsive Design**: Optimized for all devices including iPhones and iPads in both portrait and landscape

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Turnstyle/ria-hunter-app.git
   cd ria-hunter-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy the `.env.example` file to `.env.local`
   - Fill in the required values (Supabase URL and keys, Stripe keys, etc.)

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `NEXT_PUBLIC_APP_URL`: Your app's URL (e.g., http://localhost:3000 for development)
- `BACKEND_URL`: URL of the backend deployment used for API proxying (defaults to https://ria-hunter.vercel.app)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret
- `STRIPE_PRICE_ID`: The ID of your subscription price
- `GCP_SA_KEY_BASE64`: Base64-encoded Google Cloud service account JSON used for Vertex AI access

See `.env.example` for a complete list of environment variables.

AI requests are proxied to the backend, which handles all Vertex AI interactions. No OpenAI credentials are required on the frontend.
