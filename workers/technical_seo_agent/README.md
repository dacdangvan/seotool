# Technical SEO Agent (v0.4)

A comprehensive technical SEO auditing agent that crawls websites, detects SEO issues, measures Core Web Vitals, and provides actionable fix suggestions.

## Features

### 🔍 Crawling
- **Respectful crawling**: Respects `robots.txt` directives
- **Rate limiting**: Configurable delay between requests
- **Depth control**: Crawl up to N levels deep
- **JS rendering**: Optional Playwright-based JavaScript rendering
- **HTML-only mode**: Fast crawling with native fetch

### 🐛 Issue Detection

| Category | Detectors |
|----------|-----------|
| **Indexing** | noindex, nofollow, robots.txt blocking, HTTP errors |
| **Canonical** | Missing, relative, cross-domain, chains, broken canonicals |
| **Meta Tags** | Missing/short/long title, missing/short/long description, duplicates |
| **Headings** | Missing H1, multiple H1s, empty H1, hierarchy issues |
| **Links** | Broken internal links, orphan pages, excessive links |
| **Duplicates** | Thin content, duplicate title+description, URL variations |

### ⚡ Core Web Vitals
- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **INP** (Interaction to Next Paint)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)
- **TBT** (Total Blocking Time)

### 📊 Output
- Severity ratings: Critical, High, Medium, Low
- SEO impact explanation for each issue
- Actionable fix suggestions with code examples
- Categorized issue summary

## Installation

```bash
cd workers/technical_seo_agent
npm install
npx playwright install chromium
```

## Usage

### CLI

```bash
# Run audit on a URL
npm run audit:run https://example.com
```

### HTTP Server

```bash
# Start the server
npm run dev

# Health check
curl http://localhost:8003/health

# Run audit via API
curl -X POST http://localhost:8003/audit \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-here",
    "planId": "plan-uuid",
    "targetUrl": "https://example.com",
    "crawlDepth": 2,
    "maxPages": 20,
    "renderMode": "html",
    "respectRobotsTxt": true,
    "rateLimit": 1000,
    "includeCoreWebVitals": true
  }'
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API information |
| `GET` | `/health` | Health check |
| `POST` | `/audit` | Run technical SEO audit |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8003 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `DEBUG` | false | Enable debug logging |
| `DEFAULT_MAX_PAGES` | 20 | Default max pages to crawl |
| `DEFAULT_CRAWL_DEPTH` | 2 | Default crawl depth |
| `DEFAULT_REQUEST_DELAY_MS` | 1000 | Delay between requests |
| `CRAWL_TIMEOUT_MS` | 30000 | Page load timeout |
| `LIGHTHOUSE_TIMEOUT_MS` | 60000 | Lighthouse audit timeout |
| `LIGHTHOUSE_CHROME_PATH` | - | Custom Chrome path for Lighthouse |

## Development

```bash
# Run tests
npm test

# Run tests once
npm run test:run

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Architecture

```
src/
├── config.ts          # Environment configuration
├── logger.ts          # Pino structured logging
├── models.ts          # Zod schemas and TypeScript types
├── main.ts            # HTTP server entry point
├── task_runner.ts     # CLI entry point
├── audit_runner.ts    # Main orchestration logic
├── crawler/
│   ├── robots_parser.ts   # robots.txt handling
│   ├── rate_limiter.ts    # Request rate limiting
│   ├── page_crawler.ts    # Page fetching and parsing
│   └── index.ts
├── detectors/
│   ├── base.ts            # Detector interface
│   ├── indexing_detector.ts
│   ├── canonical_detector.ts
│   ├── meta_detector.ts
│   ├── heading_detector.ts
│   ├── link_detector.ts
│   ├── duplicate_detector.ts
│   └── index.ts
└── cwv/
    ├── lighthouse_runner.ts  # Lighthouse integration
    ├── cwv_analyzer.ts       # CWV issue detection
    └── index.ts
```

## Input Schema (TechnicalAuditTask)

```typescript
{
  id: string;              // UUID
  planId: string;          // UUID
  targetUrl: string;       // URL to audit
  crawlDepth: number;      // 1-5, default 2
  maxPages: number;        // 1-100, default 20
  renderMode: 'html' | 'js'; // HTML-only or JavaScript rendering
  respectRobotsTxt: boolean; // Default true
  rateLimit: number;       // ms between requests, default 1000
  includeCoreWebVitals: boolean; // Run Lighthouse audit
}
```

## Output Schema (TechnicalAuditResult)

```typescript
{
  taskId: string;
  status: 'completed' | 'failed';
  crawlSummary: {
    startUrl: string;
    pagesFound: number;
    pagesCrawled: number;
    crawlDurationMs: number;
    robotsTxtStatus: 'found' | 'not_found' | 'blocked';
  };
  issues: SEOIssue[];
  issueSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<IssueCategory, number>;
  };
  coreWebVitals: CoreWebVitals | null;
  processingTimeMs: number;
  error?: string;
  metadata: {
    targetUrl: string;
    renderMode: string;
    maxPages: number;
    auditedAt: string;
  };
}
```

## SEOIssue Schema

Each issue includes:
- **id**: Unique identifier
- **category**: Issue category (indexing, canonical, meta_tags, etc.)
- **severity**: low, medium, high, critical
- **title**: Short issue title
- **description**: Detailed description
- **affectedUrls**: List of affected pages
- **impact**: SEO and user impact explanation
- **fix**: Suggested fix with steps and code examples

## License

MIT
