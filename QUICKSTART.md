# EdgeJury - Quick Start

## Prerequisites

1. **Node.js 18+** - Install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/)
2. **Cloudflare Account** - Sign up free at [cloudflare.com](https://cloudflare.com)

## Setup

### 1. Install Dependencies

```bash
# Worker
cd worker && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Create Cloudflare Resources

```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npx wrangler d1 create edge-jury-db
# Copy the database_id to worker/wrangler.toml

# Create KV namespace
npx wrangler kv:namespace create KV
# Copy the id to worker/wrangler.toml

# Initialize database schema
cd worker && npm run db:init
```

### 3. Run Locally

```bash
# Terminal 1: Start Worker
cd worker && npm run dev

# Terminal 2: Start Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

## Deploy to Production

```bash
# Deploy Worker
cd worker && npm run deploy

# Deploy Frontend (connect repo to Cloudflare Pages)
# Or: cd frontend && npm run build && npx wrangler pages deploy dist
```

## Project Structure

```
edge-jury/
├── frontend/        # React + Vite (Cloudflare Pages)
├── worker/          # Cloudflare Worker API
├── schema/          # D1 database schema
└── eval/            # Evaluation harness (coming soon)
```
