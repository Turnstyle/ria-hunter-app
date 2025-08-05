# RIA Hunter - Stripe & Google Auth Implementation

This document outlines the complete implementation of the Stripe Google Auth Plan for RIA Hunter.

## 🎯 Implementation Summary

The implementation includes:
- ✅ **Google OAuth Authentication** via Supabase
- ✅ **Usage Limits & Tracking** (2 free queries/month + LinkedIn bonus)
- ✅ **Stripe Subscription System** (Pro plan with 7-day trial)
- ✅ **LinkedIn Sharing Bonus** (+1 query per month)
- ✅ **Protected API Routes** with middleware authentication
- ✅ **Complete UI Components** for auth, usage, and subscription management

## 🚀 Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Setup

Run the SQL schema in your Supabase database:

```bash
# Apply the schema
psql -h your-db-host -U postgres -d postgres -f supabase-schema.sql
```

Or copy the contents of `supabase-schema.sql` into the Supabase SQL Editor.

### 3. Supabase Authentication Setup

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google OAuth provider
3. Configure Google OAuth:
   - Create a Google Cloud Project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your domain to authorized origins
   - Add callback URL: `https://your-project.supabase.co/auth/v1/callback`

### 4. Stripe Setup

1. Create a Stripe account
2. Get your API keys from the Stripe Dashboard
3. Set up a webhook endpoint: `https://your-domain.com/api/stripe-webhook`
4. Configure webhook events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 5. Install Dependencies

```bash
npm install
```

## 📁 File Structure

```
app/
├── api/
│   ├── ask/route.ts                    # Updated with usage tracking
│   ├── usage/route.ts                  # Usage limits API
│   ├── redeem-share/route.ts           # LinkedIn share bonus
│   ├── create-checkout-session/route.ts # Stripe checkout
│   ├── stripe-webhook/route.ts         # Stripe webhooks
│   └── subscription-status/route.ts    # Subscription info
├── auth/
│   └── callback/route.ts               # OAuth callback handler
├── components/
│   ├── auth/
│   │   ├── LoginButton.tsx             # Google sign-in button
│   │   ├── UserMenu.tsx                # User dropdown menu
│   │   └── ProtectedRoute.tsx          # Route protection wrapper
│   ├── usage/
│   │   ├── UsageDisplay.tsx            # Query usage indicator
│   │   └── LimitReachedModal.tsx       # Upgrade/share modal
│   ├── subscription/
│   │   └── UpgradeButton.tsx           # Stripe checkout trigger
│   └── sharing/
│       └── LinkedInShareButton.tsx     # LinkedIn share component
├── contexts/
│   └── AuthContext.tsx                 # Authentication state management
├── hooks/
│   └── useUsage.ts                     # Usage data fetching hook
├── lib/
│   ├── supabase-client.ts              # Client-side Supabase
│   ├── supabase-server.ts              # Server-side Supabase
│   └── supabase-ssr.ts                 # SSR Supabase client
├── login/page.tsx                      # Login page
├── subscription/
│   ├── success/page.tsx                # Post-checkout success
│   └── cancel/page.tsx                 # Checkout cancellation
├── layout.tsx                          # Root layout with AuthProvider
└── page.tsx                            # Main app with integrated UI
```

## 🔐 Authentication Flow

1. **Login**: User clicks "Sign in with Google" → Supabase OAuth → Google consent → Callback
2. **Session Management**: AuthContext manages user state across the app
3. **API Protection**: Middleware validates Supabase JWT tokens on protected routes
4. **User Info**: User ID and email passed to API routes via headers

## 📊 Usage Tracking System

### Free Tier Limits
- 2 queries per month base allowance
- +1 bonus query for LinkedIn sharing (once per month)
- Usage resets on the 1st of each month

### Pro Tier Benefits
- Unlimited queries
- Priority support
- Advanced analytics
- 7-day free trial, then $20/month

## 💳 Subscription Flow

1. **Upgrade Trigger**: User clicks upgrade button or hits usage limit
2. **Checkout Session**: Backend creates Stripe checkout session
3. **Payment**: User completes payment on Stripe-hosted page
4. **Webhook Processing**: Stripe webhooks update subscription status
5. **Success Redirect**: User returns to success page with updated access

## 🔗 LinkedIn Sharing System

1. **Share Trigger**: User clicks share button when eligible
2. **LinkedIn Redirect**: Opens LinkedIn sharing dialog
3. **Bonus Application**: Backend records share and grants +1 query
4. **Immediate Feedback**: UI updates to show new query count

## 🛡️ Security Features

- **Row Level Security**: Database policies ensure users only access their own data
- **JWT Validation**: All API routes validate Supabase authentication tokens
- **CORS Protection**: Middleware adds security headers
- **Webhook Verification**: Stripe webhook signatures verified
- **Environment Isolation**: Sensitive keys stored in environment variables

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop and mobile
- **Loading States**: Proper loading indicators throughout
- **Error Handling**: User-friendly error messages
- **Usage Indicators**: Clear display of remaining queries
- **Smooth Onboarding**: Guided sign-up and upgrade flow

## 🧪 Testing

### Manual Testing Checklist

- [ ] Google OAuth sign-in works
- [ ] Usage limits are enforced
- [ ] LinkedIn sharing grants bonus
- [ ] Stripe checkout completes successfully
- [ ] Webhooks update subscription status
- [ ] Pro users have unlimited access
- [ ] UI components render correctly
- [ ] Mobile responsiveness works

### API Testing

Use the provided test endpoints:
- `GET /api/usage` - Check current usage
- `POST /api/redeem-share` - Test share bonus
- `POST /api/create-checkout-session` - Test Stripe integration

## 🚀 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with automatic CI/CD

### Environment Variables in Production

Ensure all environment variables are set in your production environment:
- Supabase keys (production project)
- Stripe keys (live mode)
- Webhook secrets
- App URL (production domain)

## 📈 Monitoring & Analytics

- **Supabase Analytics**: Monitor authentication and database usage
- **Stripe Dashboard**: Track subscription metrics and revenue
- **Vercel Analytics**: Monitor application performance
- **Error Tracking**: Use Sentry integration for error monitoring

## 🔄 Future Enhancements

- **Customer Portal**: Stripe billing portal for subscription management
- **Usage Analytics**: Detailed usage statistics for users
- **Team Plans**: Multi-user subscription tiers
- **API Rate Limiting**: Advanced rate limiting based on subscription tier
- **Email Notifications**: Usage alerts and subscription updates

## 🆘 Troubleshooting

### Common Issues

1. **OAuth Redirect Errors**: Check Supabase redirect URLs configuration
2. **Webhook Failures**: Verify webhook endpoint URL and secret
3. **Database Permissions**: Ensure RLS policies are correctly configured
4. **Stripe Test Mode**: Make sure to use test keys during development

### Debug Tools

- Supabase Dashboard logs
- Stripe Dashboard webhook logs
- Browser developer tools for client-side debugging
- Vercel function logs for server-side issues

## 📞 Support

For implementation questions or issues:
1. Check the Supabase documentation
2. Review Stripe integration guides
3. Consult Next.js App Router documentation
4. Open GitHub issues for bugs or feature requests

---

**Implementation Status**: ✅ Complete and Ready for Production

This implementation follows all requirements from the original plan and provides a robust, scalable foundation for the RIA Hunter application's authentication and subscription system.