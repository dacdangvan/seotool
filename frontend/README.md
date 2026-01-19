# SEO Dashboard - Manager View (v0.7)

A read-only dashboard for decision-makers to monitor SEO performance.

## Features

### 1. KPI Overview
- Organic traffic (current vs. previous period)
- Keyword coverage (Top 3 / Top 10 rankings)
- Content performance summary
- SEO Health Score

### 2. SEO Health & Risk Panel
- Technical SEO status
- Content quality status
- Topical authority status
- Active alerts and risks

### 3. Forecast & Trend
- Traffic forecast (30/60/90 days)
- Trend direction indicator
- Confidence levels

### 4. AI Copilot (Manager Mode)
- Natural language Q&A
- Business-oriented answers
- Actionable recommendations

### 5. Recommendation Panel
- Top 3 AI-suggested actions
- Impact/Effort/Risk levels
- Estimated traffic gain

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **State**: React hooks (useState, useEffect)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   └── page.tsx       # Main dashboard page
│   ├── layout.tsx
│   └── page.tsx           # Redirects to /dashboard
├── components/
│   ├── dashboard/
│   │   ├── KPIOverview.tsx
│   │   ├── SEOHealthPanel.tsx
│   │   ├── ForecastChart.tsx
│   │   ├── RecommendationPanel.tsx
│   │   ├── ManagerCopilot.tsx
│   │   └── index.ts
│   └── ui/
│       └── Skeleton.tsx   # Loading states
├── lib/
│   ├── api.ts             # API client
│   ├── api-contracts.ts   # API type definitions
│   ├── mock-data.ts       # Mock data for development
│   └── utils.ts           # Utility functions
└── types/
    └── dashboard.ts       # TypeScript types
```

## API Contract

The frontend expects these endpoints from the backend orchestrator:

### GET /api/dashboard
Returns aggregated dashboard data from all agents.

### POST /api/copilot/chat
Sends user message and returns AI response.

### GET /api/dashboard/:section
Returns specific section data (kpi, health, forecast, recommendations).

See `src/lib/api-contracts.ts` for detailed type definitions.

## Environment Variables

```env
NEXT_PUBLIC_API_URL=/api          # API base URL
NEXT_PUBLIC_USE_MOCK=true         # Use mock data (set to 'false' for real API)
```

## Design Principles

1. **Manager-Focused**: No technical jargon, clear business impact
2. **Fast Load**: Target <2s initial load
3. **Clean Layout**: Deterministic, no data overload
4. **Reusable Components**: All components are self-contained
5. **No Business Logic in UI**: Data transformations in backend

## License

MIT
