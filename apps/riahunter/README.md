# RIA Hunter API

A modern, secure API for the RIA Hunter application, built with Next.js and deployed on Vercel.

## Features

- 🚀 Built with Next.js App Router and TypeScript
- 🔒 Secure API key authentication
- 📝 Input validation with Zod
- 📊 Structured logging with Axiom
- 🐛 Error tracking with Sentry
- ✅ Comprehensive test suite
- 📚 API documentation with Postman

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Access to Vercel account
- Access to Axiom account (for logging)
- Access to Sentry account (for error tracking)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AppFoundation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Create .env.local in apps/riahunter
   cp apps/riahunter/.env.example apps/riahunter/.env.local
   ```

   Required environment variables:
   - `RIA_HUNTER_API_KEY`: Your API key for authentication
   - `NEXT_PUBLIC_AXIOM_TOKEN`: Axiom API token
   - `NEXT_PUBLIC_AXIOM_DATASET`: Axiom dataset name
   - `NEXT_PUBLIC_SENTRY_DSN`: Sentry DSN
   - `NEXT_PUBLIC_APP_VERSION`: Application version

4. Start the development server:
   ```bash
   npx nx serve riahunter
   ```

## API Documentation

The API is documented using Postman. You can find the collection at `apps/riahunter/docs/RIA-Hunter-API.postman_collection.json`.

### Key Endpoints

- `GET /api/health`: Health check endpoint
- `GET /api/listings`: List listings with pagination and filters
- `POST /api/listings`: Create a new listing

### Authentication

All API endpoints (except /api/health) require authentication using an API key in the Authorization header:

```http
Authorization: Bearer your-api-key-here
```

### Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "error": "Error message",
  "details": {} // Optional validation or error details
}
```

Common status codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized
- 500: Internal Server Error

## Development

### Running Tests

```bash
npx nx test riahunter
```

### Linting

```bash
npx nx lint riahunter
```

### Building for Production

```bash
npx nx build riahunter --prod
```

## Deployment

The API is automatically deployed to Vercel when changes are pushed to the main branch. Preview deployments are created for pull requests.

### Vercel Configuration

Key settings in `vercel.json`:
- Memory: 1024MB
- Max Duration: 10 seconds
- Region: iad1 (US East)
- CORS: Enabled for all origins (customize as needed)

### Monitoring

- **Logging**: Axiom dashboard
- **Error Tracking**: Sentry dashboard
- **Uptime**: UptimeRobot (checks /api/health every 5 minutes)

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For support, please contact the development team. 
