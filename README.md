# RIA Hunter - Investment Adviser Search & Analysis Platform

A comprehensive platform for searching, analyzing, and managing personal research on Registered Investment Advisers (RIAs) using SEC Form ADV data.

## 🚀 Features Completed

### ✅ Core Search Functionality
- **Real-time RIA Search**: Search through 13,000+ investment advisers using real SEC data
- **Geographic Filtering**: Filter by location (city, state, ZIP code)
- **Private Fund Filtering**: Find advisers that manage private funds
- **AI-Powered Natural Language Search**: Use plain English to describe what you're looking for
- **Comprehensive Results Display**: View AUM, filing dates, contact info, and more

### ✅ Investment Thesis Matcher
- **Keyword-Based Matching**: Match investment themes against adviser narratives
- **AI-Powered Analysis**: Extract keywords and themes from natural language
- **Semantic Search Ready**: Infrastructure for vector-based semantic matching (ChromaDB integration)
- **Narrative Data**: Access to Form ADV Part 2A narrative content

### ✅ Living Profile System
- **Personal Notes**: Add private notes to any RIA profile
- **Custom Tags**: Organize RIAs with personal tags
- **Research Links**: Save relevant links and resources
- **User Authentication**: Secure Auth0 integration
- **Data Privacy**: Row-level security ensures users only see their own data

### ✅ Modern Tech Stack
- **Next.js 14**: React-based frontend with App Router
- **Supabase**: PostgreSQL database with real-time features
- **Auth0**: Enterprise-grade authentication
- **Google Gemini AI**: Natural language processing and embeddings
- **Tailwind CSS**: Modern, responsive UI design
- **TypeScript**: Type-safe development
- **Zod**: Runtime validation and type safety

## 📊 Database Schema

### ETL Data (Created by ria-hunter-etl)
- **`advisers`**: 13,000+ RIA profiles with contact info, AUM, location data
- **`filings`**: Historical SEC Form ADV filings with AUM and fund data
- **`private_funds`**: Schedule D private fund details
- **`narratives`**: Text content from filings for thesis matching

### Living Profile Data
- **`user_notes`**: Personal notes on RIA profiles
- **`user_tags`**: Custom tags for organizing RIAs
- **`user_links`**: Saved research links and resources

## 🛠 Setup & Installation

### Prerequisites
- Node.js 18+
- Supabase account and project
- Auth0 account and application
- Google Cloud account (for Gemini AI)

### Environment Variables
Create `.env.local` in the app root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth0
AUTH0_SECRET=your_auth0_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=your_auth0_domain
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Optional: ChromaDB for semantic search
CHROMA_URL=your_chroma_url
```

### Database Setup
1. Run the ETL pipeline (see ria-hunter-etl repo) to populate core data
2. Execute the Living Profile schema:
   ```sql
   -- Run the SQL in docs/supabase_living_profile_schema.sql
   ```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
node test-ria-hunter.js
```

## 📡 API Endpoints

### Search API
```bash
# GET search with filters
GET /api/ria-hunter/search?location=St.%20Louis&privateInvestment=true

# POST search with natural language
POST /api/ria-hunter/search
{
  "query": "Find RIAs in Missouri managing private equity funds"
}
```

### Thesis Matcher API
```bash
POST /api/ria-hunter/match-thesis
{
  "thesis": "Looking for growth-focused managers in healthcare technology"
}
```

### Profile API
```bash
# Get detailed RIA profile
GET /api/ria-hunter/profile/[cik]
```

### Living Profile APIs
```bash
# Notes
GET /api/ria-hunter/profile/notes?ria_id=123456789
POST /api/ria-hunter/profile/notes
DELETE /api/ria-hunter/profile/notes?note_id=uuid

# Tags  
GET /api/ria-hunter/profile/tags?ria_id=123456789
POST /api/ria-hunter/profile/tags
DELETE /api/ria-hunter/profile/tags?tag_id=uuid

# Links
GET /api/ria-hunter/profile/links?ria_id=123456789
POST /api/ria-hunter/profile/links
DELETE /api/ria-hunter/profile/links?link_id=uuid
```

## 🎯 Usage Examples

### Basic Search
1. Visit the main page
2. Enter location (e.g., "St. Louis") 
3. Check "Private Investments" if interested in private funds
4. Click "Search RIAs"
5. Browse results and click any RIA for detailed profile

### Investment Thesis Matching
1. Use the thesis matcher to find RIAs with similar investment approaches
2. Enter natural language descriptions of investment strategies
3. Review keyword and semantic matches

### Personal Research Management
1. Sign in with Auth0
2. Navigate to any RIA profile
3. Add personal notes, tags, and research links
4. Data is automatically saved and private to your account

## 🔒 Security Features

- **Row-Level Security**: Users can only access their own Living Profile data
- **Authentication**: Secure Auth0 integration with JWT validation
- **Input Validation**: Comprehensive Zod schemas for all API endpoints
- **Error Handling**: Centralized error logging with Sentry integration
- **Rate Limiting**: Built-in protection against abuse

## 🚀 Performance Optimizations

- **Database Indexing**: Optimized indexes for search performance
- **Query Optimization**: Efficient joins and filtering
- **Caching**: Strategic use of caching for static data
- **Pagination**: Results limited to prevent excessive data transfer
- **Responsive Design**: Fast loading on all device types

## 🧪 Testing

Run the comprehensive test suite:
```bash
node test-ria-hunter.js
```

Tests cover:
- Search API functionality
- Thesis matching
- Profile retrieval
- Error handling
- Response validation

## 🚀 Deployment & CI/CD

### Vercel Deployment Setup

This project is configured for automatic deployment on Vercel with GitHub integration:

1. **GitHub → Vercel Integration**: 
   - Connect your GitHub repository to Vercel
   - Enable automatic deployments on push to `main` branch
   - Configure environment variables in Vercel dashboard

2. **Environment Variables on Vercel**:
   Add the following environment variables in your Vercel project settings:
   ```
   NEXT_PUBLIC_API_URL=https://ria-hunter.vercel.app
   NEXT_PUBLIC_APP_NAME=RIA Hunter
   NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
   ```

3. **Build Configuration**:
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Root Directory: `/` (repository root)

4. **Automatic Deployments**:
   - Every push to `main` triggers a production deployment
   - Pull requests create preview deployments
   - Build status is reported back to GitHub

### Local Build Verification
```bash
npm install
npm run build
```

## 📈 Integration Status

### ✅ Completed
- Core search functionality with real SEC data
- AI-powered natural language processing
- Living Profile system with authentication
- Comprehensive API layer
- Modern React frontend
- Database schema and migrations

### 🔄 Ready for Integration
- ChromaDB semantic search (infrastructure complete)
- Advanced thesis matching with embeddings
- Real-time notifications
- Analytics and usage tracking
- Additional data sources

## 📚 Documentation

- **API Docs**: See endpoint documentation above
- **Database Schema**: `docs/supabase_living_profile_schema.sql`
- **Test Suite**: `test-ria-hunter.js`
- **Component Library**: Modern React components with TypeScript

## 🎯 Project Completion Status

**Overall: ~85% Complete**

The RIA Hunter platform is feature-complete for core functionality:
- ✅ Real SEC data integration (via ETL pipeline)
- ✅ Advanced search with AI assistance  
- ✅ Personal research management
- ✅ Secure authentication and data privacy
- ✅ Modern, responsive user interface
- ✅ Comprehensive API layer
- ✅ Production-ready architecture

**Remaining work (~15%)**:
- Frontend deployment to jtpnexus-website
- Production environment configuration
- Performance monitoring setup
- User onboarding flow
- Advanced semantic search activation

The AppFoundation backend is complete and ready for integration with any frontend system. 
