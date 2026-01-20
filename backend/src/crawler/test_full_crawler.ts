#!/usr/bin/env npx ts-node

/**
 * Full Site Crawler Test
 * 
 * Run: npx ts-node src/crawler/test_full_crawler.ts
 */

import { FullSiteCrawler, getCrawlConfig } from './index';

async function main() {
  console.log('='.repeat(60));
  console.log('Full Site Crawler Test - www.vib.com.vn');
  console.log('='.repeat(60));

  // Create crawler with custom config
  const crawler = new FullSiteCrawler(
    'www.vib.com.vn',
    'test-project-001',
    {
      maxPages: 100, // Crawl up to 100 pages
      maxDepth: 5,
      rateLimit: 1500, // 1.5 seconds between requests
      useSitemap: true,
      followLinks: true,
      maxErrorRate: 0.3,
    }
  );

  console.log('\n[Test] Starting crawl...\n');

  const result = await crawler.crawl({
    onProgress: (progress) => {
      const statusEmoji = {
        not_started: '⏳',
        initializing: '🔄',
        crawling: '🕷️',
        completed: '✅',
        failed: '❌',
        cancelled: '🛑',
      }[progress.status];

      console.log(
        `${statusEmoji} [${progress.status.toUpperCase()}] ` +
        `Pages: ${progress.pagesCrawled}/${progress.totalUrlsDiscovered || '?'} | ` +
        `Progress: ${progress.progressPercent}% | ` +
        `Queue: ${progress.pagesCrawled + progress.pagesFailed + progress.pagesSkipped} processed`
      );
    },
    onPageCrawled: (page) => {
      const title = page.title?.substring(0, 50) || 'No title';
      console.log(`  📄 ${page.url}`);
      console.log(`     Title: ${title}${page.title && page.title.length > 50 ? '...' : ''}`);
      console.log(`     Issues: ${page.issues?.length || 0}`);
    },
    onError: (url, error) => {
      console.error(`  ❌ Error: ${url} - ${error}`);
    },
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('CRAWL SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\nDomain: ${result.domain}`);
  console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Duration: ${((result.endTime.getTime() - result.startTime.getTime()) / 1000).toFixed(1)}s`);
  
  console.log(`\n📊 Progress:`);
  console.log(`   Total URLs Discovered: ${result.progress.totalUrlsDiscovered}`);
  console.log(`   Pages Crawled: ${result.progress.pagesCrawled}`);
  console.log(`   Pages Failed: ${result.progress.pagesFailed}`);
  console.log(`   Pages Skipped: ${result.progress.pagesSkipped}`);
  console.log(`   Error Rate: ${(result.progress.errorRate * 100).toFixed(1)}%`);

  console.log(`\n🔗 Frontier Stats:`);
  console.log(`   From Sitemap: ${result.frontierStats.bySources.sitemap}`);
  console.log(`   From Links: ${result.frontierStats.bySources.discovered}`);
  console.log(`   From Seeds: ${result.frontierStats.bySources.seed}`);

  if (result.errors.length > 0) {
    console.log(`\n⚠️ Errors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more`);
    }
  }

  // Save results to file
  const fs = await import('fs');
  const outputPath = `./crawl_result_${Date.now()}.json`;
  
  const output = {
    domain: result.domain,
    crawledAt: result.startTime.toISOString(),
    duration: result.endTime.getTime() - result.startTime.getTime(),
    progress: result.progress,
    frontierStats: result.frontierStats,
    pagesCount: result.pages.length,
    pages: result.pages.map(p => ({
      url: p.url,
      title: p.title,
      statusCode: p.statusCode,
      issuesCount: p.issues?.length || 0,
      wordCount: p.wordCount,
      internalLinksCount: p.internalLinksCount,
    })),
    errors: result.errors,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETED');
  console.log('='.repeat(60));
}

main().catch(console.error);
