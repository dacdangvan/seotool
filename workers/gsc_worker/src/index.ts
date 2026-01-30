/**
 * GSC Worker - Google Search Console Data Sync
 * 
 * Fetches search analytics, URL inspection, and sitemap data from GSC
 * for all configured projects
 */

import { Pool } from 'pg';
import { google, searchconsole_v1 } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_seo_tool',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface ProjectGSCConfig {
  id: string;
  name: string;
  domain: string;
  gsc_property_url: string;
  gsc_credentials: {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
  gsc_sync_enabled: boolean;
}

interface SearchAnalyticsRow {
  date: string;
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Get GSC client for a project
 */
async function getGSCClient(credentials: ProjectGSCConfig['gsc_credentials']): Promise<searchconsole_v1.Searchconsole> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/webmasters',
    ],
  });

  const authClient = await auth.getClient();
  google.options({ auth: authClient as any });

  return google.searchconsole('v1');
}

/**
 * Fetch search analytics data from GSC
 */
async function fetchSearchAnalytics(
  gsc: searchconsole_v1.Searchconsole,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ['date', 'query', 'page', 'country', 'device']
): Promise<SearchAnalyticsRow[]> {
  const results: SearchAnalyticsRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;
  let hasMore = true;

  console.log(`  Fetching search analytics for ${siteUrl} from ${startDate} to ${endDate}`);

  while (hasMore) {
    try {
      const response = await gsc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
          dataState: 'final',
        },
      });

      const rows = response.data.rows || [];
      console.log(`    Fetched ${rows.length} rows (offset: ${startRow})`);

      for (const row of rows) {
        const keys = row.keys || [];
        results.push({
          date: keys[0] || startDate,
          query: dimensions.includes('query') ? keys[dimensions.indexOf('query')] : undefined,
          page: dimensions.includes('page') ? keys[dimensions.indexOf('page')] : undefined,
          country: dimensions.includes('country') ? keys[dimensions.indexOf('country')] : undefined,
          device: dimensions.includes('device') ? keys[dimensions.indexOf('device')] : undefined,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        });
      }

      hasMore = rows.length === rowLimit;
      startRow += rowLimit;

      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`    Error fetching analytics: ${err.message}`);
      hasMore = false;
    }
  }

  return results;
}

/**
 * Store search analytics data in database
 */
async function storeSearchAnalytics(
  projectId: string,
  data: SearchAnalyticsRow[]
): Promise<number> {
  if (data.length === 0) return 0;

  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    // Batch insert with ON CONFLICT UPDATE
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const values: (string | number | null)[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((row, idx) => {
        const offset = idx * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        values.push(
          projectId,
          row.date,
          row.query || null,
          row.page || null,
          row.country || null,
          row.device || null,
          row.clicks,
          row.impressions,
          row.ctr,
          row.position
        );
      });

      const query = `
        INSERT INTO gsc_search_analytics 
          (project_id, date, query, page, country, device, clicks, impressions, ctr, position)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (project_id, date, query, page, country, device)
        DO UPDATE SET
          clicks = EXCLUDED.clicks,
          impressions = EXCLUDED.impressions,
          ctr = EXCLUDED.ctr,
          position = EXCLUDED.position,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, values);
      inserted += batch.length;
    }

    await client.query('COMMIT');
    console.log(`    Stored ${inserted} search analytics rows`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return inserted;
}

/**
 * Fetch sitemaps from GSC
 */
async function fetchSitemaps(
  gsc: searchconsole_v1.Searchconsole,
  siteUrl: string
): Promise<searchconsole_v1.Schema$WmxSitemap[]> {
  try {
    const response = await gsc.sitemaps.list({ siteUrl });
    return response.data.sitemap || [];
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`    Error fetching sitemaps: ${err.message}`);
    return [];
  }
}

/**
 * Store sitemaps data
 */
async function storeSitemaps(
  projectId: string,
  sitemaps: searchconsole_v1.Schema$WmxSitemap[]
): Promise<number> {
  if (sitemaps.length === 0) return 0;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const sitemap of sitemaps) {
      await client.query(`
        INSERT INTO gsc_sitemaps 
          (project_id, path, type, last_submitted, last_downloaded, warnings_count, errors_count, contents)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (project_id, path)
        DO UPDATE SET
          type = EXCLUDED.type,
          last_submitted = EXCLUDED.last_submitted,
          last_downloaded = EXCLUDED.last_downloaded,
          warnings_count = EXCLUDED.warnings_count,
          errors_count = EXCLUDED.errors_count,
          contents = EXCLUDED.contents,
          updated_at = CURRENT_TIMESTAMP
      `, [
        projectId,
        sitemap.path,
        sitemap.type,
        sitemap.lastSubmitted,
        sitemap.lastDownloaded,
        sitemap.warnings || 0,
        sitemap.errors || 0,
        JSON.stringify(sitemap.contents || [])
      ]);
    }

    await client.query('COMMIT');
    console.log(`    Stored ${sitemaps.length} sitemaps`);
    return sitemaps.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update project sync timestamp
 */
async function updateSyncTimestamp(projectId: string): Promise<void> {
  await pool.query(`
    UPDATE projects 
    SET gsc_last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [projectId]);
}

/**
 * Get all projects with GSC sync enabled
 */
async function getGSCEnabledProjects(): Promise<ProjectGSCConfig[]> {
  const result = await pool.query(`
    SELECT 
      id, name, domain,
      gsc_property_url,
      gsc_credentials,
      gsc_sync_enabled
    FROM projects
    WHERE gsc_sync_enabled = true
      AND gsc_property_url IS NOT NULL
      AND gsc_credentials IS NOT NULL
  `);

  return result.rows;
}

/**
 * Get project by ID
 */
async function getProjectById(projectId: string): Promise<ProjectGSCConfig | null> {
  const result = await pool.query(`
    SELECT 
      id, name, domain,
      gsc_property_url,
      gsc_credentials,
      gsc_sync_enabled
    FROM projects
    WHERE id = $1
  `, [projectId]);

  return result.rows[0] || null;
}

/**
 * Sync GSC data for a single project
 */
async function syncProject(project: ProjectGSCConfig, days: number = 30): Promise<{
  success: boolean;
  analyticsRows: number;
  sitemapsCount: number;
  error?: string;
}> {
  console.log(`\nSyncing GSC data for project: ${project.name}`);
  console.log(`  Property URL: ${project.gsc_property_url}`);

  try {
    const gsc = await getGSCClient(project.gsc_credentials);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch and store search analytics
    const analyticsData = await fetchSearchAnalytics(
      gsc,
      project.gsc_property_url,
      startDateStr,
      endDateStr
    );
    const analyticsRows = await storeSearchAnalytics(project.id, analyticsData);

    // Fetch and store sitemaps
    const sitemaps = await fetchSitemaps(gsc, project.gsc_property_url);
    const sitemapsCount = await storeSitemaps(project.id, sitemaps);

    // Update sync timestamp
    await updateSyncTimestamp(project.id);

    console.log(`  ✅ Sync completed: ${analyticsRows} analytics rows, ${sitemapsCount} sitemaps`);

    return {
      success: true,
      analyticsRows,
      sitemapsCount,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`  ❌ Sync failed: ${err.message}`);
    return {
      success: false,
      analyticsRows: 0,
      sitemapsCount: 0,
      error: err.message,
    };
  }
}

/**
 * Sync all GSC-enabled projects
 */
async function syncAllProjects(days: number = 30): Promise<void> {
  console.log('='.repeat(60));
  console.log('GSC Worker - Starting sync for all enabled projects');
  console.log('='.repeat(60));

  const projects = await getGSCEnabledProjects();
  console.log(`Found ${projects.length} projects with GSC sync enabled`);

  const results = {
    total: projects.length,
    success: 0,
    failed: 0,
    totalAnalyticsRows: 0,
    totalSitemaps: 0,
  };

  for (const project of projects) {
    const result = await syncProject(project, days);
    
    if (result.success) {
      results.success++;
      results.totalAnalyticsRows += result.analyticsRows;
      results.totalSitemaps += result.sitemapsCount;
    } else {
      results.failed++;
    }

    // Rate limiting between projects
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('GSC Sync Summary:');
  console.log(`  Total projects: ${results.total}`);
  console.log(`  Successful: ${results.success}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total analytics rows: ${results.totalAnalyticsRows}`);
  console.log(`  Total sitemaps: ${results.totalSitemaps}`);
  console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--sync')) {
      // Sync all enabled projects
      const daysIndex = args.indexOf('--days');
      const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) || 30 : 30;
      await syncAllProjects(days);
    } else if (args.includes('--project')) {
      // Sync specific project
      const projectIndex = args.indexOf('--project');
      const projectId = args[projectIndex + 1];
      
      if (!projectId) {
        console.error('Please provide project ID: --project <project-id>');
        process.exit(1);
      }

      const project = await getProjectById(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      if (!project.gsc_property_url || !project.gsc_credentials) {
        console.error('Project does not have GSC configured');
        process.exit(1);
      }

      const daysIndex = args.indexOf('--days');
      const days = daysIndex !== -1 ? parseInt(args[daysIndex + 1]) || 30 : 30;
      
      await syncProject(project, days);
    } else {
      console.log('GSC Worker - Google Search Console Data Sync');
      console.log('');
      console.log('Usage:');
      console.log('  npm run sync                    Sync all GSC-enabled projects');
      console.log('  npm run sync -- --days 60       Sync with custom date range');
      console.log('  npm run sync:project <id>       Sync specific project');
      console.log('');
      console.log('Options:');
      console.log('  --sync          Sync all enabled projects');
      console.log('  --project <id>  Sync specific project by ID');
      console.log('  --days <n>      Number of days to sync (default: 30)');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for programmatic use
export {
  syncProject,
  syncAllProjects,
  getGSCEnabledProjects,
  getProjectById,
  fetchSearchAnalytics,
  fetchSitemaps,
};

// Run if executed directly
main();
