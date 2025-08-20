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

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (should be `https://llusjnpltqxhokycwzry.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `AI_PROVIDER`: Set to `vertex` for Google Vertex AI or `openai` for OpenAI
- `NEXT_PUBLIC_APP_URL`: Your app's URL (e.g., http://localhost:3000 for development)
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret
- `STRIPE_PRICE_ID`: The ID of your subscription price

See `.env.example` for a complete list of environment variables.

## Project Structure

- `app/`: Next.js App Router components and pages
  - `api/`: API routes for backend functionality
  - `components/`: Reusable React components
  - `contexts/`: React context providers
  - `hooks/`: Custom React hooks
  - `lib/`: Utility functions and shared code
- `components/`: Shared components used across the application
- `docs/`: Documentation files
- `libs/`: Shared libraries and schemas
- `public/`: Static assets
- `styles/`: CSS and style-related files including style guide

## Styling

This project uses Tailwind CSS for styling. See `styles/style-guide.md` for color palette, typography, and component styling guidelines.

## Deployment

The app is deployed on Vercel. To deploy your own instance:

1. Connect your GitHub repository to Vercel
2. Configure the environment variables in the Vercel dashboard
3. Deploy the project

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.
