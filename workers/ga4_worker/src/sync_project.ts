/**
 * Sync GA4 data for a specific project or all enabled projects
 * Usage: 
 *   npm run sync-project -- --project-id=xxx [--days=30]
 *   npm run sync-all [--days=30]
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { GA4Client } from './ga4_client.js';
import { GA4DatabaseSync } from './db_sync.js';
import { ProjectConfigService, ProjectGA4Config } from './project_config.js';

dotenv.config();

interface SyncArgs {
  projectId?: string;
  days: number;
  all: boolean;
}

function parseArgs(): SyncArgs {
  const args: SyncArgs = {
    days: 30,
    all: false,
  };
  
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--project-id=')) {
      args.projectId = arg.split('=')[1];
    } else if (arg.startsWith('--days=')) {
      args.days = parseInt(arg.split('=')[1]) || 30;
    } else if (arg === '--all') {
      args.all = true;
    }
  }
  
  return args;
}

async function syncProject(
  pool: Pool,
  config: ProjectGA4Config,
  days: number
): Promise<{ success: boolean; daysSynced: number; error?: string }> {
  console.log(`\n📊 Syncing: ${config.projectName} (${config.domain})`);
  console.log(`   GA4 Property: ${config.ga4PropertyId}`);

  if (!config.ga4PropertyId) {
    return { success: false, daysSynced: 0, error: 'GA4 Property ID not configured' };
  }

  if (!config.ga4Credentials) {
    return { success: false, daysSynced: 0, error: 'GA4 credentials not configured' };
  }

  try {
    // Create GA4 client for this project
    const ga4Client = new GA4Client({
      propertyId: config.ga4PropertyId,
      credentials: config.ga4Credentials,
    });

    // Create sync instance
    const sync = new GA4DatabaseSync({
      pool,
      projectId: config.projectId,
      ga4Client,
    });

    // Run sync
    const daysSynced = await sync.syncTrafficMetrics(days);

    // Update last sync timestamp
    const configService = new ProjectConfigService(pool);
    await configService.updateLastSyncAt(config.projectId);

    console.log(`   ✅ Synced ${daysSynced} days`);
    return { success: true, daysSynced };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMessage}`);
    return { success: false, daysSynced: 0, error: errorMessage };
  }
}

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('GA4 Project Sync');
  console.log('============================================================');

  const args = parseArgs();

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const configService = new ProjectConfigService(pool);

  try {
    let projectsToSync: ProjectGA4Config[] = [];

    if (args.projectId) {
      // Sync specific project
      const config = await configService.getProjectGA4Config(args.projectId);
      if (!config) {
        console.log(`\n❌ Project not found: ${args.projectId}`);
        await pool.end();
        process.exit(1);
      }
      projectsToSync = [config];
    } else if (args.all) {
      // Sync all enabled projects
      projectsToSync = await configService.getGA4EnabledProjects();
      if (projectsToSync.length === 0) {
        console.log('\n⚠️  No projects with GA4 sync enabled');
        console.log('   Use setup-project to configure GA4 for projects');
        await pool.end();
        return;
      }
    } else {
      console.log('\n📝 Usage:');
      console.log('   Sync specific project:');
      console.log('   npm run sync-project -- --project-id=<UUID> [--days=30]');
      console.log('');
      console.log('   Sync all enabled projects:');
      console.log('   npm run sync-all [--days=30]');
      console.log('');
      console.log('   List projects:');
      console.log('   npm run setup-project -- --list');
      await pool.end();
      return;
    }

    console.log(`\n🔄 Syncing ${projectsToSync.length} project(s) - ${args.days} days each`);

    const results = {
      success: 0,
      failed: 0,
      totalDays: 0,
    };

    for (const projectConfig of projectsToSync) {
      const result = await syncProject(pool, projectConfig, args.days);
      if (result.success) {
        results.success++;
        results.totalDays += result.daysSynced;
      } else {
        results.failed++;
      }
    }

    console.log('\n============================================================');
    console.log('Sync Summary');
    console.log('============================================================');
    console.log(`   Projects synced: ${results.success}/${projectsToSync.length}`);
    console.log(`   Total days synced: ${results.totalDays}`);
    if (results.failed > 0) {
      console.log(`   Failed: ${results.failed}`);
    }

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
