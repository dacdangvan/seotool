/**
 * GA4 Worker - Sync Script
 * 
 * Run manually or via cron to sync GA4 data to database
 * 
 * Usage:
 *   npm run sync
 *   npm run sync -- --days=7
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { GA4Client } from './ga4_client.js';
import { GA4DatabaseSync } from './db_sync.js';

async function main() {
  console.log('='.repeat(60));
  console.log('GA4 Data Sync Worker');
  console.log('='.repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  const daysArg = args.find(a => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1]) : 30;

  // Validate config
  const propertyId = process.env.GA4_PROPERTY_ID;
  const projectId = process.env.PROJECT_ID;

  if (!propertyId) {
    console.error('❌ Missing GA4_PROPERTY_ID in environment');
    console.log('\nSetup instructions:');
    console.log('1. Go to Google Cloud Console: https://console.cloud.google.com');
    console.log('2. Create a Service Account with "Analytics Viewer" role');
    console.log('3. Download JSON key file');
    console.log('4. Add Service Account email to GA4 property (Admin > Property Access Management)');
    console.log('5. Copy .env.example to .env and fill in values');
    process.exit(1);
  }

  if (!projectId) {
    console.error('❌ Missing PROJECT_ID in environment');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  GA4 Property ID: ${propertyId}`);
  console.log(`  SEO Tool Project ID: ${projectId}`);
  console.log(`  Days to sync: ${days}`);

  // Create database pool
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_seo_tool',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected');

    // Create GA4 client
    let ga4Client: GA4Client;
    
    if (process.env.GA4_KEY_FILE_PATH) {
      console.log(`  Using key file: ${process.env.GA4_KEY_FILE_PATH}`);
      ga4Client = new GA4Client({
        propertyId,
        keyFilePath: process.env.GA4_KEY_FILE_PATH,
      });
    } else if (process.env.GA4_SERVICE_ACCOUNT_EMAIL && process.env.GA4_PRIVATE_KEY) {
      console.log(`  Using service account: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL}`);
      ga4Client = new GA4Client({
        propertyId,
        credentials: {
          client_email: process.env.GA4_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GA4_PRIVATE_KEY,
        },
      });
    } else {
      console.log('  Using Application Default Credentials');
      ga4Client = new GA4Client({ propertyId });
    }

    // Create sync service
    const syncService = new GA4DatabaseSync({
      projectId,
      pool,
      ga4Client,
    });

    // Check current sync status
    const status = await syncService.getSyncStatus();
    console.log(`\nCurrent status:`);
    console.log(`  Last sync date: ${status.lastSync || 'Never'}`);
    console.log(`  Days in database: ${status.daysSynced}`);

    // Run sync
    console.log(`\n🔄 Starting sync...`);
    const startTime = Date.now();

    const synced = await syncService.syncTrafficMetrics(days);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Sync completed!`);
    console.log(`  Records synced: ${synced}`);
    console.log(`  Duration: ${duration}s`);

    // Verify
    const newStatus = await syncService.getSyncStatus();
    console.log(`\nNew status:`);
    console.log(`  Last sync date: ${newStatus.lastSync}`);
    console.log(`  Days in database: ${newStatus.daysSynced}`);

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    
    if ((error as any).code === '7' || (error as any).message?.includes('PERMISSION_DENIED')) {
      console.log('\nPermission denied. Make sure:');
      console.log('1. Service Account has "Viewer" role on GA4 property');
      console.log('2. GA4 Data API is enabled in Google Cloud Console');
      console.log('3. Service Account email is added to GA4 property access');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
