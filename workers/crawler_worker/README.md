# Crawler Worker

Standalone Crawler Worker for AI SEO Tool - Processes crawl jobs from the PostgreSQL queue.

## Architecture

```
Frontend → Backend API (creates jobs) → PostgreSQL Queue → Crawler Worker (executes crawls)
```

The worker runs as an **independent process**, decoupled from the backend API:

- **Backend API**: Creates crawl jobs and adds them to the queue
- **Crawler Worker**: Polls the queue and executes crawls
- **Frontend**: Triggers crawls via API and observes progress

## Prerequisites

- Node.js 18+
- PostgreSQL database with required tables
- Backend dependencies (imports crawler modules from backend)

## Installation

```bash
cd workers/crawler_worker
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection
- `CRAWLER_POLL_INTERVAL` - Queue polling interval (default: 10000ms)
- `CRAWLER_MAX_CONCURRENT` - Max concurrent crawls (default: 2)
- `CRAWLER_ENABLE_SCHEDULING` - Enable scheduled crawls (default: true)

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run start
```

## Features

- **Polling-based**: Continuously polls PostgreSQL queue for pending jobs
- **Concurrent crawling**: Configurable max concurrent crawl limit
- **Scheduled crawls**: Automatically processes scheduled crawl jobs
- **Graceful shutdown**: Waits for active crawls to complete on SIGINT/SIGTERM
- **Core Web Vitals**: Collects CWV metrics using Lighthouse
- **Content storage**: Stores raw HTML and normalized content

## Project Structure

```
workers/crawler_worker/
├── src/
│   └── index.ts        # Main entry point (StandaloneCrawlerWorker)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Dependencies

The worker imports crawler modules from the backend package:
- `CrawlScheduler` - Manages job scheduling and queue processing
- `CrawlerWorker` - Executes individual crawl jobs
- `SEOCrawler` - Core crawling engine
- `CWVRunner` - Core Web Vitals measurement

## Running with Backend

1. Start PostgreSQL database
2. Run database migrations
3. Start backend API: `cd backend && npm run dev`
4. Start crawler worker: `cd workers/crawler_worker && npm run dev`
5. Trigger a crawl from frontend or API

## Troubleshooting

### Jobs stuck in pending
- Ensure crawler worker is running
- Check database connection
- Verify `crawl_queue` table has pending items

### CWV collection fails
- Ensure Puppeteer can launch Chrome
- Check `lighthouse` is installed
- May need `--no-sandbox` flag in Docker

## License

Internal use only - VIB Bank
