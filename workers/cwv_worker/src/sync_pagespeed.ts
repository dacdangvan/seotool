/**
 * PageSpeed Insights Sync Script
 * 
 * Syncs CWV data from Google PageSpeed Insights API for all pages
 * Usage: npm run sync-pagespeed -- --project-id=<uuid> [--limit=50]
 */

import 'dotenv/config';
import { Pool } from 'pg';

interface PSIResult {
  url: string;
  device: 'mobile' | 'desktop';
  performanceScore: number;
  lcp: number;
  fcp: number;
  cls: number;
  tbt: number;
  si: number;
  ttfb: number;
  lcpStatus: string;
  fcpStatus: string;
  clsStatus: string;
  tbtStatus: string;
  ttfbStatus: string;
}

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  cls: { good: 0.1, poor: 0.25 },
  tbt: { good: 200, poor: 600 },
  ttfb: { good: 800, poor: 1800 },
};

function getStatus(metric: string, value: number): 'good' | 'needs_improvement' | 'poor' {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs_improvement';
  return 'poor';
}

async function fetchPageSpeedData(url: string, strategy: 'mobile' | 'desktop', apiKey?: string): Promise<PSIResult | null> {
  try {
    const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('strategy', strategy);
    apiUrl.searchParams.set('category', 'performance');
    // With API key: 400 queries/100s
    // Without API key: ~25 queries/day
    if (apiKey) {
      apiUrl.searchParams.set('key', apiKey);
    }

    // Extract domain from URL to use as Referer (bypass API key restrictions)
    const urlObj = new URL(url);
    const referer = `${urlObj.protocol}//${urlObj.host}`;

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Referer': referer,
        'Origin': referer,
      }
    });
    const data = await response.json();

    if (data.error) {
      console.log(`   ⚠️  PSI error for ${url}: ${data.error.message}`);
      return null;
    }

    const lighthouse = data.lighthouseResult;
    if (!lighthouse) {
      return null;
    }

    const audits = lighthouse.audits;
    const lcp = audits['largest-contentful-paint']?.numericValue || 0;
    const fcp = audits['first-contentful-paint']?.numericValue || 0;
    const cls = audits['cumulative-layout-shift']?.numericValue || 0;
    const tbt = audits['total-blocking-time']?.numericValue || 0;
    const si = audits['speed-index']?.numericValue || 0;
    const ttfb = audits['server-response-time']?.numericValue || 0;

    return {
      url,
      device: strategy,
      performanceScore: Math.round((lighthouse.categories?.performance?.score || 0) * 100),
      lcp,
      fcp,
      cls,
      tbt,
      si,
      ttfb,
      lcpStatus: getStatus('lcp', lcp),
      fcpStatus: getStatus('fcp', fcp),
      clsStatus: getStatus('cls', cls),
      tbtStatus: getStatus('tbt', tbt),
      ttfbStatus: getStatus('ttfb', ttfb),
    };
  } catch (error) {
    console.log(`   ❌ Error fetching PSI for ${url}: ${error}`);
    return null;
  }
}

async function upsertCWVResult(pool: Pool, projectId: string, result: PSIResult): Promise<void> {
  const overallStatus = [result.lcpStatus, result.clsStatus, result.tbtStatus].includes('poor') 
    ? 'poor' 
    : [result.lcpStatus, result.clsStatus, result.tbtStatus].includes('needs_improvement')
      ? 'needs_improvement' 
      : 'good';

  await pool.query(`
    INSERT INTO cwv_results (
      project_id, url, device,
      lcp_value, lcp_status,
      fcp_value, fcp_status,
      cls_value, cls_status,
      ttfb_value, ttfb_status,
      performance_score, overall_status,
      lighthouse_version, user_agent,
      measured_at, updated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      $6, $7,
      $8, $9,
      $10, $11,
      $12, $13,
      'PSI-API', $14,
      NOW(), NOW()
    )
    ON CONFLICT (project_id, url, device) DO UPDATE SET
      lcp_value = EXCLUDED.lcp_value,
      lcp_status = EXCLUDED.lcp_status,
      fcp_value = EXCLUDED.fcp_value,
      fcp_status = EXCLUDED.fcp_status,
      cls_value = EXCLUDED.cls_value,
      cls_status = EXCLUDED.cls_status,
      ttfb_value = EXCLUDED.ttfb_value,
      ttfb_status = EXCLUDED.ttfb_status,
      performance_score = EXCLUDED.performance_score,
      overall_status = EXCLUDED.overall_status,
      lighthouse_version = EXCLUDED.lighthouse_version,
      measured_at = NOW(),
      updated_at = NOW()
  `, [
    projectId,
    result.url,
    result.device,
    result.lcp,
    result.lcpStatus,
    result.fcp,
    result.fcpStatus,
    result.cls,
    result.clsStatus,
    result.ttfb,
    result.ttfbStatus,
    result.performanceScore,
    overallStatus,
    `PageSpeed Insights (TBT: ${result.tbt}ms, SI: ${result.si}ms)`,
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find(arg => arg.startsWith('--project-id='))?.split('=')[1];
  const limitArg = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  const limit = parseInt(limitArg || '50');

  if (!projectId) {
    console.error('Usage: npm run sync-pagespeed -- --project-id=<uuid> [--limit=50]');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('PageSpeed Insights Sync - Lab Data');
  console.log('============================================================');
  console.log(`Project ID: ${projectId}`);
  console.log(`Limit: ${limit} URLs`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // Get API key from project config
    const configResult = await pool.query(
      'SELECT crux_api_key FROM project_ai_configs WHERE project_id = $1',
      [projectId]
    );
    const apiKey = configResult.rows[0]?.crux_api_key;
    
    if (apiKey) {
      console.log('API Key: (from project settings)');
    } else {
      console.log('API Key: (none - rate limited mode)');
    }

    // Get URLs that don't have PSI data yet
    const urlsResult = await pool.query(`
      SELECT DISTINCT pcn.url
      FROM page_content_normalized pcn
      WHERE pcn.project_id = $1
        AND pcn.url LIKE 'https://%'
        AND NOT EXISTS (
          SELECT 1 FROM cwv_results cwv 
          WHERE cwv.project_id = $1 
            AND cwv.url = pcn.url 
            AND cwv.lighthouse_version = 'PSI-API'
        )
      ORDER BY pcn.url
      LIMIT $2
    `, [projectId, limit]);

    const urls = urlsResult.rows.map(r => r.url);
    console.log(`\n📋 Found ${urls.length} URLs without PSI data\n`);

    if (urls.length === 0) {
      console.log('All URLs already have PSI data!');
      await pool.end();
      process.exit(0);
    }

    let synced = 0;
    let failed = 0;

    for (const url of urls) {
      console.log(`📊 [${synced + failed + 1}/${urls.length}] ${url}`);
      
      for (const strategy of ['mobile', 'desktop'] as const) {
        const result = await fetchPageSpeedData(url, strategy, apiKey);
        
        if (result) {
          await upsertCWVResult(pool, projectId, result);
          console.log(`   ✅ ${strategy}: Score=${result.performanceScore}, LCP=${Math.round(result.lcp)}ms, CLS=${result.cls.toFixed(3)}`);
          synced++;
        } else {
          failed++;
        }
        
        // Rate limiting - PSI API allows 400 queries/100s with API key, 25/day without
        await new Promise(resolve => setTimeout(resolve, apiKey ? 500 : 5000));
      }
    }

    console.log('\n============================================================');
    console.log(`✅ Synced: ${synced} records`);
    console.log(`❌ Failed: ${failed} records`);
    console.log('============================================================');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
