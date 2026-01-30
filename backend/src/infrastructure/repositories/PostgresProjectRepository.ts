/**
 * PostgreSQL Repository for Projects
 * Stores SEO project information and provides CRUD operations
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';
import { DatabaseError } from '../../shared/errors';

// =============================================================================
// TYPES
// =============================================================================

export type ProjectStatus = 'active' | 'paused' | 'archived';
export type ProjectAccessRole = 'viewer' | 'editor' | 'admin' | 'owner';

export interface ProjectSettings {
  industry?: string;
  target_audience?: string;
  competitors?: string[];
  seo_goals?: {
    monthly_traffic_target?: number;
    keyword_top10_target?: number;
  };
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  language: string;
  status: ProjectStatus;
  ownerId: string;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  domain: string;
  language?: string;
  ownerId: string;
  settings?: ProjectSettings;
}

export interface UpdateProjectInput {
  name?: string;
  language?: string;
  status?: ProjectStatus;
  settings?: ProjectSettings;
}

interface ProjectRow {
  id: string;
  name: string;
  domain: string;
  language: string;
  status: string;
  owner_id: string;
  settings: ProjectSettings;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// REPOSITORY
// =============================================================================

export class PostgresProjectRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresProjectRepository');
  }

  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO projects (id, name, domain, language, status, owner_id, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id,
      input.name,
      input.domain,
      input.language || 'vi',
      'active',
      input.ownerId,
      JSON.stringify(input.settings || {}),
      now,
      now,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapRowToProject(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique violation - domain already exists
        throw new DatabaseError(`Project with domain ${input.domain} already exists`);
      }
      this.logger.error('Failed to create project', { error });
      throw new DatabaseError('Failed to create project');
    }
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE id = $1';

    try {
      this.logger.debug('Finding project by ID', { id });
      const result = await this.pool.query(query, [id]);
      this.logger.debug('Query result', { rowCount: result.rows.length });
      if (result.rows.length === 0) return null;
      return this.mapRowToProject(result.rows[0]);
    } catch (error: any) {
      this.logger.error('Failed to find project by ID', { 
        error: error.message, 
        code: error.code,
        stack: error.stack,
        id 
      });
      throw new DatabaseError('Failed to find project');
    }
  }

  /**
   * Find project by domain
   */
  async findByDomain(domain: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE domain = $1';

    try {
      const result = await this.pool.query(query, [domain]);
      if (result.rows.length === 0) return null;
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to find project by domain', { error, domain });
      throw new DatabaseError('Failed to find project');
    }
  }

  /**
   * Find all projects for a user
   */
  async findByUserId(userId: string): Promise<Project[]> {
    const query = `
      SELECT p.* FROM projects p
      LEFT JOIN project_access pa ON p.id = pa.project_id
      WHERE p.owner_id = $1 OR pa.user_id = $1
      ORDER BY p.updated_at DESC
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => this.mapRowToProject(row));
    } catch (error) {
      this.logger.error('Failed to find projects by user ID', { error, userId });
      throw new DatabaseError('Failed to find projects');
    }
  }

  /**
   * Find all active projects
   */
  async findAllActive(): Promise<Project[]> {
    const query = `SELECT * FROM projects WHERE status = 'active' ORDER BY updated_at DESC`;

    try {
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRowToProject(row));
    } catch (error) {
      this.logger.error('Failed to find active projects', { error });
      throw new DatabaseError('Failed to find projects');
    }
  }

  /**
   * Update project
   */
  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.language !== undefined) {
      updates.push(`language = $${paramIndex++}`);
      values.push(input.language);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(input.settings));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) return null;
      return this.mapRowToProject(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to update project', { error, id });
      throw new DatabaseError('Failed to update project');
    }
  }

  /**
   * Delete project (soft delete by setting status to archived)
   */
  async delete(id: string): Promise<boolean> {
    const query = `
      UPDATE projects 
      SET status = 'archived', updated_at = $1 
      WHERE id = $2 AND status != 'archived'
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [new Date(), id]);
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to delete project', { error, id });
      throw new DatabaseError('Failed to delete project');
    }
  }

  /**
   * Hard delete project (use with caution)
   */
  async hardDelete(id: string): Promise<boolean> {
    const query = 'DELETE FROM projects WHERE id = $1 RETURNING id';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to hard delete project', { error, id });
      throw new DatabaseError('Failed to delete project');
    }
  }

  /**
   * Check if user has access to project
   */
  async checkUserAccess(projectId: string, userId: string): Promise<ProjectAccessRole | null> {
    const query = `
      SELECT 
        CASE 
          WHEN p.owner_id = $2 THEN 'owner'
          ELSE pa.role
        END as role
      FROM projects p
      LEFT JOIN project_access pa ON p.id = pa.project_id AND pa.user_id = $2
      WHERE p.id = $1 AND (p.owner_id = $2 OR pa.user_id = $2)
    `;

    try {
      const result = await this.pool.query(query, [projectId, userId]);
      if (result.rows.length === 0) return null;
      return result.rows[0].role as ProjectAccessRole;
    } catch (error) {
      this.logger.error('Failed to check user access', { error, projectId, userId });
      throw new DatabaseError('Failed to check user access');
    }
  }

  /**
   * Map database row to Project entity
   */
  private mapRowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      language: row.language,
      status: row.status as ProjectStatus,
      ownerId: row.owner_id,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
