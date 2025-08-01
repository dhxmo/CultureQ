# cultureQ

cultureQ is a personalized coupon platform that combines financial transaction data with AI-driven taste profiling to deliver relevant brand recommendations. The system integrates Plaid for transaction access, Qloo API for brand recommendations, and OpenAI for conversational interactions.

## Development Commands

The main application is located in the `cultureQ/` directory. All commands should be run from this directory:

```bash
cd cultureQ
```

### Core Commands
- `npm i` - Install dependencies
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run bootstrap-admin` - Create admin user (requires environment setup)

### Convex Database
- `npx convex dev` - Start Convex development environment (required for database operations)

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database with serverless functions)
- **External APIs**: Plaid (banking), Qloo (brand recommendations), OpenAI (chat)
- **Authentication**: Plaid-based user authentication with local storage

### Core Components

#### Database Schema (`convex/schema.ts`)
- **users**: Plaid authentication, taste profiles, attached brands cache
- **transactions**: Anonymized transaction data with merchant mapping
- **conversations**: Chat history for taste building and coupon requests
- **merchants**: Admin-managed partner merchants with cashback rates
- **offers**: Personalized offers delivered to users
- **coupons/cashbacks**: Admin-managed promotional content

#### Key Contexts
- **AuthContext** (`src/contexts/AuthContext.tsx`): Manages authentication, transaction fetching, and Qloo brand recommendations with caching
- **AdminContext** (`src/contexts/AdminContext.tsx`): Admin authentication and management

#### API Routes
- `/api/chat/*`: OpenAI-powered conversational interfaces
- `/api/plaid/*`: Banking transaction integration
- `/api/qloo/*`: Brand recommendation services

## Environment Setup

Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_CONVEX_URL`
- `OPENAI_API_KEY`
- `PLAID_CLIENT_ID` and `PLAID_SECRET`
- `QLOO_API_KEY`
