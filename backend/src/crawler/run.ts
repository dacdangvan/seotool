#!/usr/bin/env npx ts-node
/**
 * SEO Crawler CLI
 * 
 * Usage:
 *   npx ts-node src/crawler/run.ts
 *   npx ts-node src/crawler/run.ts --url https://www.vib.com.vn --max-pages 20
 * 
 * Options:
 *   --url          Base URL to crawl (default: https://www.vib.com.vn)
 *   --max-pages    Maximum pages to crawl (default: 50)
 *   --max-depth    Maximum crawl depth (default: 3)
 *   --delay        Request delay in ms (default: 1000)
 *   --output       Output file path (default: crawl_result.json)
 *   --verbose      Enable verbose logging
 */

import { SEOCrawler } from './seo_crawler';
import { CrawlResult, PageSEOData } from './models';
import * as fs from 'fs';
import * as path from 'path';

// Parse CLI arguments
function parseArgs(): {
  url: string;
  maxPages: number;
  maxDepth: number;
  delay: number;
  output: string;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    url: 'https://www.vib.com.vn',
    maxPages: 50,
    maxDepth: 3,
    delay: 1000,
    output: 'crawl_result.json',
    verbose: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--url':
        result.url = next;
        i++;
        break;
      case '--max-pages':
        result.maxPages = parseInt(next, 10);
        i++;
        break;
      case '--max-depth':
        result.maxDepth = parseInt(next, 10);
        i++;
        break;
      case '--delay':
        result.delay = parseInt(next, 10);
        i++;
        break;
      case '--output':
        result.output = next;
        i++;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }
  
  return result;
}

function printHelp(): void {
  console.log(`
SEO Crawler CLI - Crawl websites for SEO analysis

Usage:
  npx ts-node src/crawler/run.ts [options]

Options:
  --url <url>          Base URL to crawl (default: https://www.vib.com.vn)
  --max-pages <n>      Maximum pages to crawl (default: 50)
  --max-depth <n>      Maximum crawl depth (default: 3)
  --delay <ms>         Request delay in ms (default: 1000)
  --output <file>      Output file path (default: crawl_result.json)
  --verbose            Enable verbose logging
  --help               Show this help message

Examples:
  # Crawl VIB website with default settings
  npx ts-node src/crawler/run.ts

  # Crawl first 10 pages
  npx ts-node src/crawler/run.ts --max-pages 10

  # Crawl with custom URL
  npx ts-node src/crawler/run.ts --url https://example.com --max-pages 20
`);
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// Print summary table
function printSummary(result: CrawlResult): void {
  const { summary, job } = result;
  
  console.log('\n' + '═'.repeat(70));
  console.log('  SEO CRAWL SUMMARY');
  console.log('═'.repeat(70));
  
  // Crawl Info
  console.log('\n📊 CRAWL STATISTICS');
  console.log('─'.repeat(40));
  console.log(`  Job ID:            ${job.id}`);
  console.log(`  Status:            ${job.status.toUpperCase()}`);
  console.log(`  Duration:          ${formatDuration(summary.totalCrawlTime)}`);
  console.log(`  Total Pages:       ${summary.totalPages}`);
  console.log(`  Successful:        ${summary.successfulPages}`);
  console.log(`  Failed:            ${summary.failedPages}`);
  console.log(`  Skipped:           ${summary.skippedPages}`);
  
  // Performance
  console.log('\n⚡ PERFORMANCE');
  console.log('─'.repeat(40));
  console.log(`  Avg Response:      ${summary.avgResponseTime}ms`);
  console.log(`  Min Response:      ${summary.minResponseTime}ms`);
  console.log(`  Max Response:      ${summary.maxResponseTime}ms`);
  
  // Content
  console.log('\n📝 CONTENT ANALYSIS');
  console.log('─'.repeat(40));
  console.log(`  Avg Word Count:    ${summary.avgWordCount} words`);
  console.log(`  Avg Content Size:  ${formatBytes(summary.avgContentLength)}`);
  console.log(`  Thin Content:      ${summary.pagesWithThinContent} pages (<300 words)`);
  
  // Links
  console.log('\n🔗 LINK ANALYSIS');
  console.log('─'.repeat(40));
  console.log(`  Internal Links:    ${summary.totalInternalLinks} (${summary.uniqueInternalLinks} unique)`);
  console.log(`  External Links:    ${summary.totalExternalLinks}`);
  
  // Images
  console.log('\n🖼️  IMAGE ANALYSIS');
  console.log('─'.repeat(40));
  console.log(`  Total Images:      ${summary.totalImages}`);
  console.log(`  Without Alt:       ${summary.imagesWithoutAlt}`);
  console.log(`  Alt Coverage:      ${summary.altTextCoverage}%`);
  
  // SEO Issues
  console.log('\n⚠️  SEO ISSUES');
  console.log('─'.repeat(40));
  console.log(`  Total Issues:      ${summary.totalIssues}`);
  console.log(`  🔴 Critical:       ${summary.criticalIssues}`);
  console.log(`  🟡 Warnings:       ${summary.warningIssues}`);
  console.log(`  🔵 Info:           ${summary.infoIssues}`);
  
  // Issue details
  if (summary.issuesByType.size > 0) {
    console.log('\n  Issues by Type:');
    for (const [type, count] of summary.issuesByType) {
      console.log(`    - ${type}: ${count}`);
    }
  }
  
  // Meta Issues
  console.log('\n📋 META TAG ISSUES');
  console.log('─'.repeat(40));
  console.log(`  Missing Title:     ${summary.pagesWithoutTitle}`);
  console.log(`  Missing Desc:      ${summary.pagesWithoutMetaDescription}`);
  console.log(`  Missing H1:        ${summary.pagesWithoutH1}`);
  console.log(`  Multiple H1:       ${summary.pagesWithMultipleH1}`);
  console.log(`  Duplicate Titles:  ${summary.duplicateTitles}`);
  console.log(`  Duplicate Desc:    ${summary.duplicateDescriptions}`);
  console.log(`  Noindex Pages:     ${summary.pagesWithNoindex}`);
  
  // Status Codes
  console.log('\n📡 HTTP STATUS CODES');
  console.log('─'.repeat(40));
  for (const [status, count] of summary.statusCodeDistribution) {
    const emoji = status >= 200 && status < 300 ? '✅' : 
                  status >= 300 && status < 400 ? '🔄' :
                  status >= 400 && status < 500 ? '❌' : '💥';
    console.log(`  ${emoji} ${status}: ${count} pages`);
  }
  
  console.log('\n' + '═'.repeat(70));
}

// Print top issues
function printTopIssues(pages: PageSEOData[]): void {
  // Collect all issues
  const allIssues: { url: string; type: string; severity: string; message: string }[] = [];
  
  for (const page of pages) {
    for (const issue of page.issues) {
      allIssues.push({
        url: page.url,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
      });
    }
  }
  
  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allIssues.sort((a, b) => 
    severityOrder[a.severity as keyof typeof severityOrder] - 
    severityOrder[b.severity as keyof typeof severityOrder]
  );
  
  // Show top 20
  const topIssues = allIssues.slice(0, 20);
  
  if (topIssues.length > 0) {
    console.log('\n📋 TOP SEO ISSUES (First 20)');
    console.log('─'.repeat(70));
    
    for (const issue of topIssues) {
      const icon = issue.severity === 'critical' ? '🔴' : 
                   issue.severity === 'warning' ? '🟡' : '🔵';
      const shortUrl = issue.url.replace(/^https?:\/\/[^/]+/, '');
      console.log(`${icon} [${issue.type}] ${shortUrl}`);
      console.log(`   ${issue.message}`);
    }
  }
}

// Serialize result for JSON (handle Map)
function serializeResult(result: CrawlResult): unknown {
  return {
    job: result.job,
    pages: result.pages.map(page => ({
      ...page,
      issues: page.issues,
    })),
    summary: {
      ...result.summary,
      issuesByType: Object.fromEntries(result.summary.issuesByType),
      statusCodeDistribution: Object.fromEntries(result.summary.statusCodeDistribution),
    },
    robotsTxt: result.robotsTxt,
  };
}

// Main function
async function main(): Promise<void> {
  const args = parseArgs();
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    SEO-SAFE WEB CRAWLER                                ║
║                    For www.vib.com.vn                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

⚖️  LEGAL & SAFETY:
   ✓ Respects robots.txt strictly
   ✓ Crawls public HTML pages only
   ✓ No form submission
   ✓ No authentication
   ✓ No PII extraction
   ✓ Rate-limited crawling (${args.delay}ms delay)
   ✓ SEO audit use only
`);

  console.log('📋 CONFIGURATION:');
  console.log(`   URL:        ${args.url}`);
  console.log(`   Max Pages:  ${args.maxPages}`);
  console.log(`   Max Depth:  ${args.maxDepth}`);
  console.log(`   Delay:      ${args.delay}ms`);
  console.log(`   Output:     ${args.output}`);
  console.log('');
  
  // Create crawler
  const crawler = new SEOCrawler({
    baseUrl: args.url,
    projectId: 'cli-crawl',
    maxPages: args.maxPages,
    maxDepth: args.maxDepth,
    requestDelay: args.delay,
    storeRawHtml: false, // Don't store HTML in output
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Received interrupt signal, stopping gracefully...');
    crawler.stop();
  });
  
  // Verbose event logging
  if (args.verbose) {
    crawler.on((event) => {
      if (event.type === 'crawl:skip') {
        const data = event.data as { url: string; reason: string };
        console.log(`[SKIP] ${data.url}: ${data.reason}`);
      }
    });
  }
  
  try {
    // Start crawl
    const result = await crawler.start();
    
    // Print summary
    printSummary(result);
    
    // Print top issues
    printTopIssues(result.pages);
    
    // Save to file
    const outputPath = path.resolve(args.output);
    const jsonResult = JSON.stringify(serializeResult(result), null, 2);
    fs.writeFileSync(outputPath, jsonResult, 'utf8');
    
    console.log(`\n✅ Results saved to: ${outputPath}`);
    console.log(`   File size: ${formatBytes(Buffer.byteLength(jsonResult, 'utf8'))}`);
    
    // Exit code based on critical issues
    if (result.summary.criticalIssues > 0) {
      console.log('\n⚠️  Crawl completed with critical issues');
      process.exit(1);
    }
    
    console.log('\n✅ Crawl completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Crawl failed:', error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

// Run
main().catch(console.error);
