/**
 * Project GA4 Configuration Service
 * Manages GA4 settings per project from database
 */

import { Pool } from 'pg';

export interface ProjectGA4Config {
  projectId: string;
  projectName: string;
  domain: string;
  ga4PropertyId: string | null;
  ga4Credentials: {
    client_email: string;
    private_key: string;
  } | null;
  ga4LastSyncAt: Date | null;
  ga4SyncEnabled: boolean;
}

export class ProjectConfigService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get all projects with GA4 sync enabled
   */
  async getGA4EnabledProjects(): Promise<ProjectGA4Config[]> {
    const result = await this.pool.query(`
      SELECT 
        id as project_id,
        name as project_name,
        domain,
        ga4_property_id,
        ga4_credentials,
        ga4_last_sync_at,
        ga4_sync_enabled
      FROM projects
      WHERE ga4_sync_enabled = true
        AND ga4_property_id IS NOT NULL
      ORDER BY name
    `);

    return result.rows.map(row => ({
      projectId: row.project_id,
      projectName: row.project_name,
      domain: row.domain,
      ga4PropertyId: row.ga4_property_id,
      ga4Credentials: row.ga4_credentials,
      ga4LastSyncAt: row.ga4_last_sync_at,
      ga4SyncEnabled: row.ga4_sync_enabled,
    }));
  }

  /**
   * Get single project GA4 config
   */
  async getProjectGA4Config(projectId: string): Promise<ProjectGA4Config | null> {
    const result = await this.pool.query(`
      SELECT 
        id as project_id,
        name as project_name,
        domain,
        ga4_property_id,
        ga4_credentials,
        ga4_last_sync_at,
        ga4_sync_enabled
      FROM projects
      WHERE id = $1
    `, [projectId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      projectId: row.project_id,
      projectName: row.project_name,
      domain: row.domain,
      ga4PropertyId: row.ga4_property_id,
      ga4Credentials: row.ga4_credentials,
      ga4LastSyncAt: row.ga4_last_sync_at,
      ga4SyncEnabled: row.ga4_sync_enabled,
    };
  }

  /**
   * Update project GA4 configuration
   */
  async updateProjectGA4Config(
    projectId: string,
    config: {
      ga4PropertyId?: string;
      ga4Credentials?: { client_email: string; private_key: string };
      ga4SyncEnabled?: boolean;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (config.ga4PropertyId !== undefined) {
      updates.push(`ga4_property_id = $${paramIndex++}`);
      values.push(config.ga4PropertyId);
    }

    if (config.ga4Credentials !== undefined) {
      updates.push(`ga4_credentials = $${paramIndex++}`);
      values.push(JSON.stringify(config.ga4Credentials));
    }

    if (config.ga4SyncEnabled !== undefined) {
      updates.push(`ga4_sync_enabled = $${paramIndex++}`);
      values.push(config.ga4SyncEnabled);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(projectId);

    await this.pool.query(`
      UPDATE projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values);
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSyncAt(projectId: string): Promise<void> {
    await this.pool.query(`
      UPDATE projects 
      SET ga4_last_sync_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [projectId]);
  }

  /**
   * List all projects with their GA4 status
   */
  async listAllProjectsGA4Status(): Promise<Array<{
    projectId: string;
    projectName: string;
    domain: string;
    ga4Configured: boolean;
    ga4SyncEnabled: boolean;
    lastSyncAt: Date | null;
  }>> {
    const result = await this.pool.query(`
      SELECT 
        id as project_id,
        name as project_name,
        domain,
        ga4_property_id IS NOT NULL as ga4_configured,
        COALESCE(ga4_sync_enabled, false) as ga4_sync_enabled,
        ga4_last_sync_at as last_sync_at
      FROM projects
      ORDER BY name
    `);

    return result.rows.map(row => ({
      projectId: row.project_id,
      projectName: row.project_name,
      domain: row.domain,
      ga4Configured: row.ga4_configured,
      ga4SyncEnabled: row.ga4_sync_enabled,
      lastSyncAt: row.last_sync_at,
    }));
  }
}
