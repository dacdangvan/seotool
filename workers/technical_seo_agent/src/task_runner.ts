/**
 * Technical SEO Agent - CLI Task Runner
 * For testing audits from command line
 */

import { v4 as uuid } from 'uuid';
import { createLogger } from './logger';
import { loadConfig } from './config';
import { AuditRunner } from './audit_runner';
import { TechnicalAuditTask, RenderMode, TechnicalAuditTaskSchema } from './models';

async function main() {
  const logger = createLogger('TechnicalSEOAgent', true);
  const config = loadConfig();

  // Get URL from command line arguments
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error('Usage: npm run audit:run <url>');
    console.error('Example: npm run audit:run https://example.com');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(targetUrl);
  } catch {
    console.error('Invalid URL provided');
    process.exit(1);
  }

  // Create audit task
  const task: TechnicalAuditTask = {
    id: uuid(),
    planId: uuid(),
    targetUrl,
    crawlDepth: 2,
    maxPages: 10, // Lower for CLI testing
    renderMode: RenderMode.HTML,
    respectRobotsTxt: true,
    rateLimit: 1000,
    includeCoreWebVitals: true,
  };

  logger.info({ task }, 'Starting audit');

  const runner = new AuditRunner(config, logger);
  const result = await runner.run(task);

  // Pretty print results
  console.log('\n' + '='.repeat(80));
  console.log('TECHNICAL SEO AUDIT RESULTS');
  console.log('='.repeat(80));
  console.log(`URL: ${result.metadata.targetUrl}`);
  console.log(`Status: ${result.status}`);
  console.log(`Pages Crawled: ${result.crawlSummary.pagesCrawled}`);
  console.log(`Processing Time: ${result.processingTimeMs}ms`);
  console.log('');

  console.log('ISSUE SUMMARY:');
  console.log(`  Total: ${result.issueSummary.total}`);
  console.log(`  Critical: ${result.issueSummary.critical}`);
  console.log(`  High: ${result.issueSummary.high}`);
  console.log(`  Medium: ${result.issueSummary.medium}`);
  console.log(`  Low: ${result.issueSummary.low}`);
  console.log('');

  if (result.coreWebVitals) {
    console.log('CORE WEB VITALS:');
    console.log(`  Performance Score: ${result.coreWebVitals.performanceScore}/100`);
    console.log(`  LCP: ${result.coreWebVitals.lcp.value}ms (${result.coreWebVitals.lcp.rating})`);
    console.log(`  CLS: ${result.coreWebVitals.cls.value} (${result.coreWebVitals.cls.rating})`);
    if (result.coreWebVitals.inp) {
      console.log(`  INP: ${result.coreWebVitals.inp.value}ms (${result.coreWebVitals.inp.rating})`);
    }
    console.log('');
  }

  if (result.issues.length > 0) {
    console.log('DETECTED ISSUES:');
    for (const issue of result.issues) {
      console.log(`\n  [${issue.severity.toUpperCase()}] ${issue.title}`);
      console.log(`    Category: ${issue.category}`);
      console.log(`    ${issue.description}`);
      console.log(`    Affected URLs: ${issue.affectedUrls.length}`);
      console.log(`    Impact: ${issue.impact.summary}`);
    }
  }

  console.log('\n' + '='.repeat(80));

  // Write full result to JSON file
  const outputFile = `audit-result-${Date.now()}.json`;
  const fs = await import('fs/promises');
  await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
  console.log(`Full results saved to: ${outputFile}`);
}

main().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});
