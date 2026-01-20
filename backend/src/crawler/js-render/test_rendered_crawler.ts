/**
 * Test Script for Rendered Crawler
 * 
 * Usage: npx tsx src/crawler/js-render/test_rendered_crawler.ts
 */

import { createRenderedCrawler } from './rendered_crawler';
import { RenderDecider } from './render_decider';

async function testRenderDecider() {
  console.log('\n=== Testing Render Decider ===\n');

  const decider = new RenderDecider();

  // Test 1: Simple HTML page
  const simpleHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Simple Page - Company Name</title>
      <meta name="description" content="This is a simple page with static content.">
    </head>
    <body>
      <h1>Welcome to Our Website</h1>
      <p>This is some content that is rendered server-side.</p>
      <a href="/about">About Us</a>
    </body>
    </html>
  `;

  const simpleDecision = decider.decide('https://example.com/simple', simpleHtml);
  console.log('Simple HTML page:');
  console.log('  Should render:', simpleDecision.shouldRender);
  console.log('  Reason:', simpleDecision.reason);
  console.log('  Confidence:', simpleDecision.confidence);

  // Test 2: React SPA
  const spaHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>React App</title>
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
      <script src="/static/js/main.abc123.js"></script>
    </body>
    </html>
  `;

  const spaDecision = decider.decide('https://example.com/spa', spaHtml);
  console.log('\nReact SPA page:');
  console.log('  Should render:', spaDecision.shouldRender);
  console.log('  Reason:', spaDecision.reason);
  console.log('  Confidence:', spaDecision.confidence);

  // Test 3: Next.js page
  const nextjsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Next.js App</title>
      <meta name="description" content="A Next.js application">
    </head>
    <body>
      <div id="__next">
        <h1>Home Page</h1>
        <p>Some SSR content</p>
      </div>
      <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
    </body>
    </html>
  `;

  const nextjsDecision = decider.decide('https://example.com/nextjs', nextjsHtml);
  console.log('\nNext.js page:');
  console.log('  Should render:', nextjsDecision.shouldRender);
  console.log('  Reason:', nextjsDecision.reason);
  console.log('  Confidence:', nextjsDecision.confidence);

  // Test 4: Missing title
  const noTitleHtml = `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body>
      <h1>Content Without Title</h1>
    </body>
    </html>
  `;

  const noTitleDecision = decider.decide('https://example.com/no-title', noTitleHtml);
  console.log('\nMissing title page:');
  console.log('  Should render:', noTitleDecision.shouldRender);
  console.log('  Reason:', noTitleDecision.reason);
  console.log('  Confidence:', noTitleDecision.confidence);

  // Detailed analysis
  console.log('\n--- Detailed Analysis for SPA ---');
  const analysis = decider.getDetailedAnalysis('https://example.com/spa', spaHtml);
  console.log('  Has title:', analysis.analysis.hasTitle);
  console.log('  Title content:', analysis.analysis.titleContent);
  console.log('  Is placeholder:', analysis.analysis.isPlaceholderTitle);
  console.log('  Has H1:', analysis.analysis.hasH1);
  console.log('  Script count:', analysis.analysis.scriptCount);
  console.log('  SPA indicators:', analysis.analysis.spaIndicators.length);
  analysis.analysis.spaIndicators.forEach(ind => {
    console.log(`    - ${ind.type}: ${ind.details}`);
  });
}

async function testRenderedCrawler() {
  console.log('\n=== Testing Rendered Crawler ===\n');

  const crawler = createRenderedCrawler({
    enabled: true,
    maxJsRenderPages: 10,
    timeout: 15000
  });

  try {
    await crawler.initialize();
    console.log('Crawler initialized\n');

    // Test with a real URL (example.com is a simple static site)
    const testUrls = [
      'https://example.com',
      // Add more test URLs as needed
    ];

    for (const url of testUrls) {
      console.log(`Crawling: ${url}`);
      
      const result = await crawler.crawl(url);
      
      console.log('  Status:', result.statusCode);
      console.log('  Render mode:', result.renderMode);
      console.log('  Load time:', result.loadTime, 'ms');
      console.log('  Render time:', result.renderTime, 'ms');
      
      if (result.error) {
        console.log('  Error:', result.error);
      } else {
        console.log('  Title:', result.seoData.title);
        console.log('  Meta desc:', result.seoData.metaDescription?.substring(0, 50) + '...');
        console.log('  H1 count:', result.seoData.h1.length);
        console.log('  Internal links:', result.seoData.internalLinks.length);
        console.log('  External links:', result.seoData.externalLinks.length);
        console.log('  Word count:', result.seoData.wordCount);
        console.log('  SEO Score:', result.seoAnalysis.score);
        console.log('  Issues:', result.seoAnalysis.issues.length);
        
        if (result.seoAnalysis.issues.length > 0) {
          console.log('  Top issues:');
          result.seoAnalysis.issues.slice(0, 3).forEach(issue => {
            console.log(`    - [${issue.severity}] ${issue.message}`);
          });
        }
      }
      console.log('');
    }

    // Show stats
    const stats = crawler.getStats();
    console.log('Crawler Stats:');
    console.log('  Render count:', stats.renderCount);
    console.log('  Limit reached:', stats.limitReached);
    console.log('  Max render pages:', stats.maxRenderPages);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await crawler.close();
    console.log('\nCrawler closed');
  }
}

async function main() {
  console.log('========================================');
  console.log('  Browser-Rendered Crawler Test Suite');
  console.log('========================================');

  // Run tests
  await testRenderDecider();
  await testRenderedCrawler();

  console.log('\n========================================');
  console.log('  Tests Complete');
  console.log('========================================\n');
}

main().catch(console.error);
