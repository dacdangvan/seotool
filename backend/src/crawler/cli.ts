#!/usr/bin/env npx tsx
/**
 * Crawler CLI
 * 
 * Command line tool to crawl websites and collect SEO data
 * 
 * Usage:
 *   npx tsx src/crawler/cli.ts crawl https://www.vib.com.vn --max-pages=50
 *   npx tsx src/crawler/cli.ts crawl https://www.vib.com.vn --max-depth=2 --delay=2000
 */

import { WebCrawler } from './crawler';
import { CrawlConfig, CrawlSummary } from './types';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
VIB SEO Crawler - Command Line Tool

Usage:
  npx tsx src/crawler/cli.ts crawl <url> [options]

Options:
  --max-pages=<n>     Maximum pages to crawl (default: 100)
  --max-depth=<n>     Maximum crawl depth (default: 3)
  --delay=<ms>        Delay between requests in ms (default: 1000)
  --project-id=<id>   Project ID (default: vib-cli-crawl)
  --no-robots         Ignore robots.txt
  --output=<file>     Save results to JSON file

Examples:
  npx tsx src/crawler/cli.ts crawl https://www.vib.com.vn
  npx tsx src/crawler/cli.ts crawl https://www.vib.com.vn --max-pages=50 --max-depth=2
  npx tsx src/crawler/cli.ts crawl https://www.vib.com.vn --output=crawl-result.json
`);
  process.exit(0);
}

const command = args[0];

if (command !== 'crawl') {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

const url = args[1];
if (!url) {
  console.error('URL is required');
  process.exit(1);
}

// Parse options
const options: Record<string, string | boolean> = {};
for (let i = 2; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    options[key] = value ?? true;
  }
}

const config: CrawlConfig = {
  baseUrl: url,
  projectId: (options['project-id'] as string) || 'vib-cli-crawl',
  maxPages: options['max-pages'] ? parseInt(options['max-pages'] as string) : 100,
  maxDepth: options['max-depth'] ? parseInt(options['max-depth'] as string) : 3,
  requestDelay: options['delay'] ? parseInt(options['delay'] as string) : 1000,
  respectRobotsTxt: !options['no-robots'],
  sameDomainOnly: true,
};

console.log('\n🕷️  VIB SEO Crawler\n');
console.log('Configuration:');
console.log(`  URL: ${config.baseUrl}`);
console.log(`  Max Pages: ${config.maxPages}`);
console.log(`  Max Depth: ${config.maxDepth}`);
console.log(`  Request Delay: ${config.requestDelay}ms`);
console.log(`  Respect robots.txt: ${config.respectRobotsTxt}`);
console.log('');

const crawler = new WebCrawler(config);

// Progress tracking
let lastProgressUpdate = 0;
crawler.on((event) => {
  if (event.type === 'progress') {
    const now = Date.now();
    if (now - lastProgressUpdate > 1000) { // Update every second
      const progress = event.data as { crawledPages: number; totalPages: number; pagesPerMinute?: number };
      process.stdout.write(`\r📄 Crawled: ${progress.crawledPages} pages | Queue: ${progress.totalPages - progress.crawledPages} | Speed: ${progress.pagesPerMinute?.toFixed(1) || '0'} pages/min`);
      lastProgressUpdate = now;
    }
  } else if (event.type === 'page') {
    // Page crawled
  } else if (event.type === 'error') {
    console.error('\n❌ Error:', (event.data as Error).message);
  }
});

// Start crawling
console.log('🚀 Starting crawl...\n');
const startTime = Date.now();

crawler.start()
  .then(async (result) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n\n✅ Crawl completed!\n');
    
    // Print summary
    const summary = result.summary;
    console.log('📊 Summary:');
    console.log('─'.repeat(50));
    console.log(`  Total Pages Crawled: ${summary.totalPages}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Average Response Time: ${summary.avgResponseTime}ms`);
    console.log(`  Average Word Count: ${summary.avgWordCount}`);
    console.log('');
    console.log('🔗 Links:');
    console.log(`  Internal Links: ${summary.totalInternalLinks}`);
    console.log(`  External Links: ${summary.totalExternalLinks}`);
    console.log('');
    console.log('🖼️  Images:');
    console.log(`  Total Images: ${summary.totalImages}`);
    console.log(`  Missing Alt Text: ${summary.imagesWithoutAlt}`);
    console.log('');
    console.log('⚠️  SEO Issues:');
    console.log(`  Total Issues: ${summary.totalIssues}`);
    console.log(`  Critical: ${summary.criticalIssues}`);
    console.log(`  Warnings: ${summary.warnings}`);
    console.log('');
    console.log('📝 Content Issues:');
    console.log(`  Pages without Title: ${summary.pagesWithoutTitle}`);
    console.log(`  Pages without Meta Description: ${summary.pagesWithoutMetaDescription}`);
    console.log(`  Pages without H1: ${summary.pagesWithoutH1}`);
    console.log(`  Duplicate Titles: ${summary.duplicateTitles}`);
    console.log(`  Duplicate Descriptions: ${summary.duplicateDescriptions}`);
    console.log('─'.repeat(50));
    
    // Save to file if requested
    if (options['output']) {
      const outputFile = options['output'] as string;
      const fs = await import('fs');
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`\n💾 Results saved to: ${outputFile}`);
    }
    
    // Print top issues
    if (summary.totalIssues > 0) {
      console.log('\n🔍 Top Issues Found:');
      const issueTypes = new Map<string, number>();
      for (const page of result.pages) {
        for (const issue of page.issues) {
          issueTypes.set(issue.type, (issueTypes.get(issue.type) || 0) + 1);
        }
      }
      
      const sortedIssues = [...issueTypes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [type, count] of sortedIssues) {
        console.log(`  • ${type}: ${count} pages`);
      }
    }
    
    console.log('\n');
  })
  .catch((error) => {
    console.error('\n\n❌ Crawl failed:', error.message);
    process.exit(1);
  });

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping crawler...');
  crawler.stop();
});
