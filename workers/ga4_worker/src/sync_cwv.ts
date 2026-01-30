/**
 * GA4 CWV Sync Script
 *
 * Syncs only Core Web Vitals data from GA4 for a specific project
 * Usage: npm run sync-cwv -- --project-id=<uuid> --days=30
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { GA4Client } from './ga4_client.js';
import { GA4DatabaseSync } from './db_sync.js';
import { ProjectConfigService } from './project_config.js';

async function syncCWVForProject(projectId: string, days: number = 30): Promise<boolean> {
  console.log(`\n📊 [${projectId}] Starting CWV sync...`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const configService = new ProjectConfigService(pool);
  const config = await configService.getProjectGA4Config(projectId);

  if (!config) {
    console.log(`   ❌ Project not found`);
    return false;
  }

  if (!config.ga4PropertyId || !config.ga4Credentials) {
    console.log(`   ⚠️  GA4 not configured for this project`);
    return false;
  }

  try {
    const ga4Client = new GA4Client({
      propertyId: config.ga4PropertyId,
      credentials: config.ga4Credentials,
    });

    const syncService = new GA4DatabaseSync({
      projectId: config.projectId,
      pool,
      ga4Client,
    });

    const synced = await syncService.syncCWVData(days);
    await configService.updateLastSyncAt(config.projectId);

    console.log(`   ✅ Synced ${synced} CWV results`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find(arg => arg.startsWith('--project-id='))?.split('=')[1];
  const days = parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '30');

  if (!projectId) {
    console.error('Usage: npm run sync-cwv -- --project-id=<uuid> [--days=30]');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('GA4 CWV Sync - Single Project');
  console.log('============================================================');
  console.log(`Project ID: ${projectId}`);
  console.log(`Days: ${days}`);

  const success = await syncCWVForProject(projectId, days);

  console.log('============================================================');
  console.log(`CWV sync ${success ? 'completed' : 'failed'}`);
  console.log('============================================================\n');

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
