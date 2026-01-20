/**
 * Test CWV Runner
 * 
 * Test script to run Core Web Vitals collection on VIB.com.vn
 * 
 * Usage:
 *   npx ts-node src/crawler/cwv/test_cwv_runner.ts
 */

import { CWVRunner, selectRepresentativePages } from './cwv_runner';
import { formatVitalsForDisplay, getSuggestions } from './vitals_extractor';
import fs from 'fs';

const TEST_URLS = [
  'https://www.vib.com.vn/',
  'https://www.vib.com.vn/vi/',
  'https://www.vib.com.vn/vi/ca-nhan',
  'https://www.vib.com.vn/vi/doanh-nghiep',
  'https://www.vib.com.vn/vi/san-pham/the-tin-dung',
  'https://www.vib.com.vn/vi/lien-he',
];

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Core Web Vitals (CWV) Runner - Test Script           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Select representative pages
  const pages = selectRepresentativePages(TEST_URLS, 5);
  console.log(`📋 Selected ${pages.length} pages for CWV testing:`);
  pages.forEach((p, i) => {
    console.log(`   ${i + 1}. [Priority ${p.priority}] ${p.template || 'unknown'}: ${p.url}`);
  });
  console.log('');

  // Create runner with test config
  const runner = new CWVRunner({
    devices: ['mobile'], // Only mobile for quick test
    maxCWVPages: 3,
    delayBetweenRuns: 3000,
    timeout: 45000,
    useThrottling: false, // Disable throttling for faster test
    storeRawReport: false,
  });

  console.log('🚀 Starting CWV collection...');
  console.log('─'.repeat(70));

  const startTime = Date.now();
  
  const results = await runner.runCWV(
    'test-project-id',
    pages,
    {
      onProgress: (progress) => {
        if (progress.currentUrl) {
          console.log(`\n📊 Progress: ${progress.completedPages}/${progress.totalPages}`);
          console.log(`   Current: ${progress.currentUrl} (${progress.currentDevice})`);
        }
      },
      onPageComplete: (result) => {
        console.log(`   ✅ Completed: ${result.url}`);
        const display = formatVitalsForDisplay(result.vitals);
        console.log(`      Score: ${display.score} | LCP: ${display.lcp} | CLS: ${display.cls} | FCP: ${display.fcp}`);
        console.log(`      Status: ${result.overallStatus.toUpperCase()}`);
      },
      onError: (url, device, error) => {
        console.log(`   ❌ Error on ${url} (${device}): ${error.message}`);
      },
    }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('─'.repeat(70));
  console.log(`\n✅ CWV collection completed in ${duration}s`);
  console.log(`   Total results: ${results.length}`);

  // Summary
  if (results.length > 0) {
    console.log('\n📊 Summary:');
    console.log('─'.repeat(70));
    
    const goodCount = results.filter(r => r.overallStatus === 'good').length;
    const needsImprovementCount = results.filter(r => r.overallStatus === 'needs_improvement').length;
    const poorCount = results.filter(r => r.overallStatus === 'poor').length;
    
    console.log(`   🟢 Good: ${goodCount}`);
    console.log(`   🟡 Needs Improvement: ${needsImprovementCount}`);
    console.log(`   🔴 Poor: ${poorCount}`);
    
    const avgScore = results.reduce((sum, r) => sum + r.vitals.performanceScore, 0) / results.length;
    const avgLcp = results.reduce((sum, r) => sum + r.vitals.lcp.value, 0) / results.length;
    const avgCls = results.reduce((sum, r) => sum + r.vitals.cls.value, 0) / results.length;
    
    console.log(`\n   Average Performance Score: ${avgScore.toFixed(0)}/100`);
    console.log(`   Average LCP: ${(avgLcp / 1000).toFixed(2)}s`);
    console.log(`   Average CLS: ${avgCls.toFixed(3)}`);

    // Top suggestions
    console.log('\n💡 Top Suggestions:');
    const allSuggestions = new Set<string>();
    results.forEach(r => {
      getSuggestions(r.vitals).forEach(s => allSuggestions.add(s));
    });
    
    [...allSuggestions].slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. ${s}`);
    });

    // Save results to file
    const outputFile = 'cwv_test_results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${outputFile}`);
  }

  console.log('\n🏁 Test completed!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
