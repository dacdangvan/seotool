/**
 * CrUX Sync Script
 *
 * Syncs Chrome UX Report (Field Data) for a specific project
 * Usage: npm run sync-crux -- --project-id=<uuid> [--origin-only]
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { CrUXClient, CrUXData } from './crux_client.js';

interface SyncOptions {
  projectId: string;
  originOnly?: boolean;
}

async function syncCrUXForProject(options: SyncOptions): Promise<boolean> {
  const { projectId, originOnly = false } = options;
  console.log(`\n📊 [${projectId}] Starting CrUX sync...`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // Get project info
    const projectResult = await pool.query(
      'SELECT id, name, domain FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      console.log('   ❌ Project not found');
      return false;
    }

    const project = projectResult.rows[0];
    const origin = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;
    
    // Get CrUX API key from project_ai_configs table first, fallback to env var
    const configResult = await pool.query(
      'SELECT crux_api_key FROM project_ai_configs WHERE project_id = $1',
      [projectId]
    );
    const dbCruxKey = configResult.rows[0]?.crux_api_key;
    const cruxApiKey = dbCruxKey || process.env.CRUX_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!cruxApiKey) {
      console.log('   ❌ CrUX API key not configured');
      console.log('   💡 Add CrUX API key in Settings > AI Settings > CrUX API');
      return false;
    }
    
    console.log(`   Project: ${project.name}`);
    console.log(`   Origin: ${origin}`);
    console.log(`   API Key: ${dbCruxKey ? '(from project settings)' : '(from environment)'}`);

    const cruxClient = new CrUXClient(cruxApiKey);
    let syncedCount = 0;

    // Always get origin-level data first
    console.log('\n   📈 Fetching origin-level CrUX data...');
    
    for (const formFactor of ['PHONE', 'DESKTOP'] as const) {
      const device = formFactor === 'PHONE' ? 'mobile' : 'desktop';
      console.log(`      ${device}...`);
      
      const data = await cruxClient.getOriginMetrics(origin, formFactor);
      if (data) {
        await upsertCrUXResult(pool, projectId, origin, data, true);
        syncedCount++;
        console.log(`      ✅ LCP: ${data.lcp}ms (${data.lcpStatus}), CLS: ${data.cls} (${data.clsStatus}), INP: ${data.inp}ms (${data.inpStatus})`);
      } else {
        console.log(`      ⚠️  No CrUX data available`);
      }
    }

    // If not origin-only, also fetch URL-level data for top pages
    if (!originOnly) {
      console.log('\n   📄 Fetching URL-level CrUX data for top pages...');
      
      // Get top URLs from url_inventory or crawled_pages
      const urlsResult = await pool.query(`
        SELECT DISTINCT url FROM (
          SELECT url FROM url_inventory WHERE project_id = $1
          UNION
          SELECT url FROM crawled_pages WHERE project_id = $1
          UNION
          SELECT url FROM page_content_normalized WHERE project_id = $1
        ) all_urls
        WHERE url LIKE $2
        LIMIT 50
      `, [projectId, `${origin}%`]);

      const urls = urlsResult.rows.map(r => r.url);
      console.log(`      Found ${urls.length} URLs to check`);

      for (const url of urls) {
        for (const formFactor of ['PHONE', 'DESKTOP'] as const) {
          try {
            const data = await cruxClient.getUrlMetrics(url, formFactor);
            if (data) {
              await upsertCrUXResult(pool, projectId, url, data, false);
              syncedCount++;
            }
            // Rate limit delay
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            // Continue on error
          }
        }
      }
    }

    // Update project's last CrUX sync time
    await pool.query(
      `UPDATE projects SET crux_last_sync_at = NOW() WHERE id = $1`,
      [projectId]
    );

    console.log(`\n   ✅ Synced ${syncedCount} CrUX results`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Upsert CrUX result to database
 */
async function upsertCrUXResult(
  pool: Pool,
  projectId: string,
  url: string,
  data: CrUXData,
  isOrigin: boolean
): Promise<void> {
  // Calculate performance score (simplified)
  const lcpScore = Math.max(0, Math.min(100, 100 - (data.lcp - 1200) / 28));
  const clsScore = Math.max(0, Math.min(100, 100 - data.cls * 400));
  const inpScore = data.inp ? Math.max(0, Math.min(100, 100 - (data.inp - 150) / 4.5)) : 100;
  const rawScore = lcpScore * 0.25 + clsScore * 0.25 + inpScore * 0.30 + 90 * 0.20;
  const performanceScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Determine overall status
  const statuses = [data.lcpStatus, data.clsStatus, data.inpStatus];
  const overallStatus = statuses.includes('poor') ? 'poor' :
                       statuses.includes('needs_improvement') ? 'needs_improvement' : 'good';

  const query = `
    INSERT INTO cwv_results (
      project_id, url, device,
      lcp_value, lcp_status,
      cls_value, cls_status,
      inp_value, inp_status,
      fcp_value, fcp_status,
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
      $14, $15,
      $16, $17,
      NOW(), NOW()
    )
    ON CONFLICT (project_id, url, device) DO UPDATE SET
      lcp_value = EXCLUDED.lcp_value,
      lcp_status = EXCLUDED.lcp_status,
      cls_value = EXCLUDED.cls_value,
      cls_status = EXCLUDED.cls_status,
      inp_value = EXCLUDED.inp_value,
      inp_status = EXCLUDED.inp_status,
      fcp_value = EXCLUDED.fcp_value,
      fcp_status = EXCLUDED.fcp_status,
      ttfb_value = EXCLUDED.ttfb_value,
      ttfb_status = EXCLUDED.ttfb_status,
      performance_score = EXCLUDED.performance_score,
      overall_status = EXCLUDED.overall_status,
      lighthouse_version = EXCLUDED.lighthouse_version,
      measured_at = NOW(),
      updated_at = NOW()
  `;

  await pool.query(query, [
    projectId,
    url,
    data.formFactor,
    data.lcp,
    data.lcpStatus,
    data.cls,
    data.clsStatus,
    data.inp || null,
    data.inpStatus,
    data.fcp,
    data.fcpStatus,
    data.ttfb,
    data.ttfbStatus,
    performanceScore,
    overallStatus,
    'CrUX-API',  // Use this to identify CrUX data vs Lighthouse
    `CrUX Field Data (${data.collectionPeriodStart} to ${data.collectionPeriodEnd})`,
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find(arg => arg.startsWith('--project-id='))?.split('=')[1];
  const originOnly = args.includes('--origin-only');

  if (!projectId) {
    console.error('Usage: npm run sync-crux -- --project-id=<uuid> [--origin-only]');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('CrUX (Chrome UX Report) Sync - Real User Metrics');
  console.log('============================================================');
  console.log(`Project ID: ${projectId}`);
  console.log(`Mode: ${originOnly ? 'Origin only' : 'Origin + Top URLs'}`);

  const success = await syncCrUXForProject({ projectId, originOnly });

  console.log('============================================================');
  console.log(success ? 'CrUX sync completed' : 'CrUX sync failed');
  console.log('============================================================');

  process.exit(success ? 0 : 1);
}

main();
