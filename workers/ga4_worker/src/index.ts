/**
 * GA4 Worker - Main entry point (scheduled worker)
 * 
 * Runs as a continuous worker that syncs data for ALL enabled projects
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { GA4Client } from './ga4_client.js';
import { GA4DatabaseSync } from './db_sync.js';
import { ProjectConfigService, ProjectGA4Config } from './project_config.js';

const SYNC_INTERVAL_HOURS = parseInt(process.env.SYNC_INTERVAL_HOURS || '6');
const SYNC_DAYS = parseInt(process.env.SYNC_DAYS || '30');

async function syncProject(
  pool: Pool,
  config: ProjectGA4Config,
  configService: ProjectConfigService
): Promise<boolean> {
  console.log(`\n📊 [${config.projectName}] Starting sync...`);
  console.log(`   Domain: ${config.domain}`);
  console.log(`   GA4 Property: ${config.ga4PropertyId}`);

  if (!config.ga4PropertyId || !config.ga4Credentials) {
    console.log(`   ⚠️  Skipping - missing configuration`);
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

    const trafficSynced = await syncService.syncTrafficMetrics(SYNC_DAYS);
    const cwvSynced = await syncService.syncCWVData(SYNC_DAYS);
    await configService.updateLastSyncAt(config.projectId);
    
    console.log(`   ✅ Synced ${trafficSynced} days of traffic + ${cwvSynced} CWV results`);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return false;
  }
}

async function runSyncAllProjects(pool: Pool): Promise<void> {
  const configService = new ProjectConfigService(pool);
  const projects = await configService.getGA4EnabledProjects();

  console.log(`\n============================================================`);
  console.log(`[${new Date().toISOString()}] Starting GA4 sync cycle`);
  console.log(`Found ${projects.length} project(s) with GA4 enabled`);
  console.log(`============================================================`);

  if (projects.length === 0) {
    console.log('\n⚠️  No projects with GA4 sync enabled');
    console.log('   Run: npm run setup-project -- --list');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const project of projects) {
    const ok = await syncProject(pool, project, configService);
    if (ok) success++;
    else failed++;
  }

  console.log(`\n============================================================`);
  console.log(`Sync cycle complete: ${success} success, ${failed} failed`);
  console.log(`Next sync in ${SYNC_INTERVAL_HOURS} hours`);
  console.log(`============================================================\n`);
}

async function main() {
  console.log('============================================================');
  console.log('GA4 Worker - Multi-Project Sync');
  console.log('============================================================');
  console.log(`Sync interval: ${SYNC_INTERVAL_HOURS} hours`);
  console.log(`Sync days: ${SYNC_DAYS}`);

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  // Initial sync
  await runSyncAllProjects(pool);

  // Schedule periodic sync
  setInterval(async () => {
    await runSyncAllProjects(pool);
  }, SYNC_INTERVAL_HOURS * 60 * 60 * 1000);

  console.log('Worker running. Press Ctrl+C to stop.');
}

main().catch(console.error);
