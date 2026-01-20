/**
 * Simple test script for SEO Crawler
 * 
 * Run: npx ts-node src/crawler/test-crawl.ts
 */

import { SEOCrawler } from './seo_crawler';

async function test() {
  console.log('Starting SEO Crawler test...');
  
  const crawler = new SEOCrawler({
    baseUrl: 'https://www.vib.com.vn',
    projectId: 'test',
    maxPages: 5,
    maxDepth: 2,
    requestDelay: 1500,
    storeRawHtml: false,
  });
  
  const result = await crawler.start();
  
  console.log('\n=== CRAWL RESULT ===');
  console.log(`Status: ${result.job.status}`);
  console.log(`Pages crawled: ${result.summary.totalPages}`);
  console.log(`Issues found: ${result.summary.totalIssues}`);
  
  console.log('\n=== PAGES ===');
  for (const page of result.pages) {
    console.log(`\n📄 ${page.url}`);
    console.log(`   Title: ${page.title?.substring(0, 50)}...`);
    console.log(`   Status: ${page.statusCode}`);
    console.log(`   Words: ${page.wordCount}`);
    console.log(`   Issues: ${page.issues.length}`);
  }
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync(
    'crawl_test_result.json',
    JSON.stringify({
      job: result.job,
      pages: result.pages,
      summary: {
        ...result.summary,
        issuesByType: Object.fromEntries(result.summary.issuesByType),
        statusCodeDistribution: Object.fromEntries(result.summary.statusCodeDistribution),
      },
    }, null, 2)
  );
  
  console.log('\n✅ Result saved to crawl_test_result.json');
}

test().catch(console.error);
