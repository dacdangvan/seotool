/**
 * Test GA4 Connection
 * Verify credentials and property access
 */

import * as dotenv from 'dotenv';
import { GA4Client, TrafficData } from './ga4_client.js';

dotenv.config();

async function testConnection(): Promise<void> {
  console.log('============================================================');
  console.log('GA4 Connection Test');
  console.log('============================================================\n');

  // Check environment variables
  const propertyId = process.env.GA4_PROPERTY_ID;
  const credentials = process.env.GA4_SERVICE_ACCOUNT_CREDENTIALS;
  const keyFile = process.env.GA4_SERVICE_ACCOUNT_KEY_FILE;

  console.log('📋 Configuration:');
  console.log(`   Property ID: ${propertyId || '❌ Not set'}`);
  console.log(`   Credentials JSON: ${credentials ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Key File: ${keyFile || 'Not set'}`);
  console.log('');

  if (!propertyId) {
    console.log('❌ GA4_PROPERTY_ID is required');
    console.log('');
    console.log('Where to find Property ID:');
    console.log('1. Go to Google Analytics: https://analytics.google.com');
    console.log('2. Click Admin (gear icon)');
    console.log('3. In Property column, click "Property Settings"');
    console.log('4. Property ID is shown at top (e.g., "123456789")');
    process.exit(1);
  }

  if (!credentials && !keyFile) {
    console.log('❌ Either GA4_SERVICE_ACCOUNT_CREDENTIALS or GA4_SERVICE_ACCOUNT_KEY_FILE is required');
    console.log('');
    console.log('Setup Service Account:');
    console.log('1. Go to Google Cloud Console: https://console.cloud.google.com');
    console.log('2. Create project or select existing');
    console.log('3. Go to APIs & Services > Enable APIs');
    console.log('4. Enable "Google Analytics Data API"');
    console.log('5. Go to IAM & Admin > Service Accounts');
    console.log('6. Create Service Account with any name');
    console.log('7. Click on service account > Keys > Add Key > JSON');
    console.log('8. Save the JSON file');
    console.log('');
    console.log('Option A: Set GA4_SERVICE_ACCOUNT_CREDENTIALS with JSON content');
    console.log('Option B: Set GA4_SERVICE_ACCOUNT_KEY_FILE with path to JSON file');
    process.exit(1);
  }

  try {
    console.log('🔄 Creating GA4 client...');
    
    const parsedCredentials = credentials ? JSON.parse(credentials) : undefined;
    const client = new GA4Client({
      propertyId,
      credentials: parsedCredentials,
      keyFilePath: keyFile
    });

    console.log('🔄 Testing connection (fetching 1 day of data)...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    // Format dates as YYYY-MM-DD
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const data = await client.getDailyTraffic(formatDate(startDate), formatDate(endDate));
    
    console.log('');
    console.log('✅ Connection successful!');
    console.log('');
    console.log('📊 Sample data from yesterday:');
    
    if (data.length === 0) {
      console.log('   No data for yesterday (this is normal for new properties)');
    } else {
      data.forEach((row: TrafficData) => {
        console.log(`   Date: ${row.date}`);
        console.log(`   Sessions: ${row.sessions.toLocaleString()}`);
        console.log(`   Page Views: ${row.pageviews.toLocaleString()}`);
        console.log(`   Users: ${row.users.toLocaleString()}`);
        console.log(`   Bounce Rate: ${(row.bounceRate * 100).toFixed(1)}%`);
        console.log(`   Avg Session Duration: ${row.avgSessionDuration.toFixed(0)}s`);
      });
    }

    console.log('');
    console.log('🔄 Testing realtime data...');
    try {
      const activeUsers = await client.getRealtimeActiveUsers();
      console.log(`   Active users right now: ${activeUsers}`);
    } catch (e) {
      console.log('   (Realtime API requires additional permissions)');
    }

    console.log('');
    console.log('============================================================');
    console.log('✅ All tests passed! You can now run: npm run sync');
    console.log('============================================================');

  } catch (error) {
    console.log('');
    console.log('❌ Connection failed!');
    console.log('');
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('permission')) {
      console.log('🔐 Permission Error:');
      console.log('   Make sure Service Account has access to GA4 property');
      console.log('   1. Go to Google Analytics > Admin > Property Access Management');
      console.log('   2. Click + button to add user');
      console.log('   3. Enter Service Account email (ends with @...iam.gserviceaccount.com)');
      console.log('   4. Set role to "Viewer" or higher');
    } else if (errorMessage.includes('API has not been')) {
      console.log('🔌 API Not Enabled:');
      console.log('   1. Go to Google Cloud Console');
      console.log('   2. Select your project');
      console.log('   3. Go to APIs & Services > Library');
      console.log('   4. Search for "Google Analytics Data API"');
      console.log('   5. Click Enable');
    } else if (errorMessage.includes('invalid_grant') || errorMessage.includes('credentials')) {
      console.log('🔑 Credentials Error:');
      console.log('   Check your service account JSON is valid');
      console.log('   Try downloading a new key from Google Cloud Console');
    } else {
      console.log('Error details:', errorMessage);
    }
    
    process.exit(1);
  }
}

testConnection().catch(console.error);
