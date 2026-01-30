/**
 * Setup GA4 for a specific project
 * Usage: npm run setup-project -- --project-id=xxx --property-id=yyy --key-file=/path/to/key.json
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { Pool } from 'pg';
import { ProjectConfigService } from './project_config.js';

dotenv.config();

interface SetupArgs {
  projectId?: string;
  propertyId?: string;
  keyFile?: string;
  enable?: boolean;
  disable?: boolean;
  list?: boolean;
}

function parseArgs(): SetupArgs {
  const args: SetupArgs = {};
  
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--project-id=')) {
      args.projectId = arg.split('=')[1];
    } else if (arg.startsWith('--property-id=')) {
      args.propertyId = arg.split('=')[1];
    } else if (arg.startsWith('--key-file=')) {
      args.keyFile = arg.split('=')[1];
    } else if (arg === '--enable') {
      args.enable = true;
    } else if (arg === '--disable') {
      args.disable = true;
    } else if (arg === '--list') {
      args.list = true;
    }
  }
  
  return args;
}

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('GA4 Project Setup Tool');
  console.log('============================================================\n');

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
    // List all projects
    if (args.list || (!args.projectId && !args.propertyId)) {
      console.log('📋 All Projects GA4 Status:\n');
      const projects = await configService.listAllProjectsGA4Status();
      
      if (projects.length === 0) {
        console.log('   No projects found in database');
      } else {
        for (const project of projects) {
          const status = project.ga4Configured 
            ? (project.ga4SyncEnabled ? '✅ Enabled' : '⏸️  Disabled')
            : '❌ Not configured';
          const lastSync = project.lastSyncAt 
            ? `Last sync: ${project.lastSyncAt.toISOString()}`
            : 'Never synced';
          
          console.log(`   ${project.projectName}`);
          console.log(`   └─ ID: ${project.projectId}`);
          console.log(`   └─ Domain: ${project.domain}`);
          console.log(`   └─ GA4: ${status}`);
          console.log(`   └─ ${lastSync}`);
          console.log('');
        }
      }
      
      console.log('\n📝 Usage Examples:\n');
      console.log('   Setup GA4 for project:');
      console.log('   npm run setup-project -- --project-id=<UUID> --property-id=<GA4_ID> --key-file=/path/to/key.json\n');
      console.log('   Enable sync:');
      console.log('   npm run setup-project -- --project-id=<UUID> --enable\n');
      console.log('   Disable sync:');
      console.log('   npm run setup-project -- --project-id=<UUID> --disable\n');
      
      return;
    }

    // Validate project ID
    if (!args.projectId) {
      console.log('❌ --project-id is required');
      console.log('   Run with --list to see all projects');
      process.exit(1);
    }

    // Get current project config
    const currentConfig = await configService.getProjectGA4Config(args.projectId);
    if (!currentConfig) {
      console.log(`❌ Project not found: ${args.projectId}`);
      process.exit(1);
    }

    console.log(`📦 Project: ${currentConfig.projectName}`);
    console.log(`   Domain: ${currentConfig.domain}`);
    console.log(`   Current GA4 Property: ${currentConfig.ga4PropertyId || 'Not set'}`);
    console.log(`   Sync Enabled: ${currentConfig.ga4SyncEnabled ? 'Yes' : 'No'}`);
    console.log('');

    // Enable/Disable sync
    if (args.enable) {
      if (!currentConfig.ga4PropertyId) {
        console.log('❌ Cannot enable sync - GA4 Property ID not configured');
        console.log('   Use --property-id to set it first');
        process.exit(1);
      }
      
      await configService.updateProjectGA4Config(args.projectId, { ga4SyncEnabled: true });
      console.log('✅ GA4 sync enabled for this project');
      return;
    }

    if (args.disable) {
      await configService.updateProjectGA4Config(args.projectId, { ga4SyncEnabled: false });
      console.log('✅ GA4 sync disabled for this project');
      return;
    }

    // Setup GA4 configuration
    if (args.propertyId) {
      const updateConfig: { 
        ga4PropertyId?: string; 
        ga4Credentials?: { client_email: string; private_key: string };
        ga4SyncEnabled?: boolean;
      } = {
        ga4PropertyId: args.propertyId,
      };

      // Read credentials from key file
      if (args.keyFile) {
        if (!fs.existsSync(args.keyFile)) {
          console.log(`❌ Key file not found: ${args.keyFile}`);
          process.exit(1);
        }

        const keyContent = JSON.parse(fs.readFileSync(args.keyFile, 'utf-8'));
        
        if (!keyContent.client_email || !keyContent.private_key) {
          console.log('❌ Invalid key file - missing client_email or private_key');
          process.exit(1);
        }

        updateConfig.ga4Credentials = {
          client_email: keyContent.client_email,
          private_key: keyContent.private_key,
        };

        console.log(`🔑 Using service account: ${keyContent.client_email}`);
      }

      // Enable sync by default when configuring
      updateConfig.ga4SyncEnabled = true;

      await configService.updateProjectGA4Config(args.projectId, updateConfig);
      
      console.log('');
      console.log('✅ GA4 configuration saved!');
      console.log(`   Property ID: ${args.propertyId}`);
      console.log(`   Credentials: ${args.keyFile ? 'Saved from key file' : 'Not updated'}`);
      console.log(`   Sync: Enabled`);
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Run sync: npm run sync-project -- --project-id=' + args.projectId);
      console.log('   2. Or start worker: npm run dev (syncs all enabled projects)');
    } else {
      console.log('❌ --property-id is required to configure GA4');
      console.log('');
      console.log('📝 Example:');
      console.log(`   npm run setup-project -- --project-id=${args.projectId} --property-id=123456789 --key-file=/path/to/key.json`);
    }

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
