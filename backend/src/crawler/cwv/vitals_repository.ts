/**
 * CWV Repository
 * 
 * Database operations for Core Web Vitals results
 */

import { Pool, PoolClient } from 'pg';
import { CWVResult, DeviceProfile, CWVStatus, CoreWebVitals } from './cwv_types';
import { v4 as uuidv4 } from 'uuid';

export interface CWVSummary {
  projectId: string;
  totalPages: number;
  avgPerformanceScore: number;
  avgLcp: number;
  avgCls: number;
  avgFcp: number;
  avgTtfb: number;
  statusBreakdown: {
    good: number;
    needsImprovement: number;
    poor: number;
  };
  deviceBreakdown: {
    mobile: number;
    desktop: number;
  };
  lastMeasuredAt: Date;
}

export interface CWVQueryOptions {
  projectId?: string;
  device?: DeviceProfile;
  status?: CWVStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'performanceScore' | 'lcp' | 'cls' | 'measuredAt';
  orderDir?: 'asc' | 'desc';
}

export class CWVRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Save CWV result (upsert - update if exists for same URL + device)
   */
  async save(result: CWVResult): Promise<CWVResult> {
    const id = result.id || uuidv4();
    
    const query = `
      INSERT INTO cwv_results (
        id,
        project_id,
        url,
        device,
        lcp_value,
        lcp_status,
        inp_value,
        inp_status,
        cls_value,
        cls_status,
        fcp_value,
        fcp_status,
        ttfb_value,
        ttfb_status,
        si_value,
        si_status,
        tbt_value,
        tbt_status,
        performance_score,
        overall_status,
        lighthouse_version,
        user_agent,
        raw_report,
        measured_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW(), NOW()
      )
      ON CONFLICT (project_id, url, device)
      DO UPDATE SET
        lcp_value = EXCLUDED.lcp_value,
        lcp_status = EXCLUDED.lcp_status,
        inp_value = EXCLUDED.inp_value,
        inp_status = EXCLUDED.inp_status,
        cls_value = EXCLUDED.cls_value,
        cls_status = EXCLUDED.cls_status,
        fcp_value = EXCLUDED.fcp_value,
        fcp_status = EXCLUDED.fcp_status,
        ttfb_value = EXCLUDED.ttfb_value,
        ttfb_status = EXCLUDED.ttfb_status,
        si_value = EXCLUDED.si_value,
        si_status = EXCLUDED.si_status,
        tbt_value = EXCLUDED.tbt_value,
        tbt_status = EXCLUDED.tbt_status,
        performance_score = EXCLUDED.performance_score,
        overall_status = EXCLUDED.overall_status,
        lighthouse_version = EXCLUDED.lighthouse_version,
        user_agent = EXCLUDED.user_agent,
        raw_report = EXCLUDED.raw_report,
        measured_at = EXCLUDED.measured_at,
        updated_at = NOW()
      RETURNING id
    `;

    const values = [
      id,
      result.projectId,
      result.url,
      result.device,
      result.vitals.lcp.value,
      result.vitals.lcp.status,
      result.vitals.inp?.value ?? null,
      result.vitals.inp?.status ?? null,
      result.vitals.cls.value,
      result.vitals.cls.status,
      result.vitals.fcp.value,
      result.vitals.fcp.status,
      result.vitals.ttfb.value,
      result.vitals.ttfb.status,
      result.vitals.si.value,
      result.vitals.si.status,
      result.vitals.tbt.value,
      result.vitals.tbt.status,
      result.vitals.performanceScore,
      result.overallStatus,
      result.lighthouseVersion,
      result.userAgent,
      result.rawReport ? JSON.stringify(result.rawReport) : null,
      result.measuredAt,
    ];

    const { rows } = await this.pool.query(query, values);
    
    return { ...result, id: rows[0].id };
  }

  /**
   * Save multiple CWV results in a transaction
   */
  async saveMany(results: CWVResult[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const result of results) {
        await this.saveWithClient(client, result);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save with existing client (for transactions)
   */
  private async saveWithClient(client: PoolClient, result: CWVResult): Promise<void> {
    const id = result.id || uuidv4();
    
    const query = `
      INSERT INTO cwv_results (
        id,
        project_id,
        url,
        device,
        lcp_value,
        lcp_status,
        inp_value,
        inp_status,
        cls_value,
        cls_status,
        fcp_value,
        fcp_status,
        ttfb_value,
        ttfb_status,
        si_value,
        si_status,
        tbt_value,
        tbt_status,
        performance_score,
        overall_status,
        lighthouse_version,
        user_agent,
        raw_report,
        measured_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW(), NOW()
      )
      ON CONFLICT (project_id, url, device)
      DO UPDATE SET
        lcp_value = EXCLUDED.lcp_value,
        lcp_status = EXCLUDED.lcp_status,
        inp_value = EXCLUDED.inp_value,
        inp_status = EXCLUDED.inp_status,
        cls_value = EXCLUDED.cls_value,
        cls_status = EXCLUDED.cls_status,
        fcp_value = EXCLUDED.fcp_value,
        fcp_status = EXCLUDED.fcp_status,
        ttfb_value = EXCLUDED.ttfb_value,
        ttfb_status = EXCLUDED.ttfb_status,
        si_value = EXCLUDED.si_value,
        si_status = EXCLUDED.si_status,
        tbt_value = EXCLUDED.tbt_value,
        tbt_status = EXCLUDED.tbt_status,
        performance_score = EXCLUDED.performance_score,
        overall_status = EXCLUDED.overall_status,
        lighthouse_version = EXCLUDED.lighthouse_version,
        user_agent = EXCLUDED.user_agent,
        raw_report = EXCLUDED.raw_report,
        measured_at = EXCLUDED.measured_at,
        updated_at = NOW()
    `;

    const values = [
      id,
      result.projectId,
      result.url,
      result.device,
      result.vitals.lcp.value,
      result.vitals.lcp.status,
      result.vitals.inp?.value ?? null,
      result.vitals.inp?.status ?? null,
      result.vitals.cls.value,
      result.vitals.cls.status,
      result.vitals.fcp.value,
      result.vitals.fcp.status,
      result.vitals.ttfb.value,
      result.vitals.ttfb.status,
      result.vitals.si.value,
      result.vitals.si.status,
      result.vitals.tbt.value,
      result.vitals.tbt.status,
      result.vitals.performanceScore,
      result.overallStatus,
      result.lighthouseVersion,
      result.userAgent,
      result.rawReport ? JSON.stringify(result.rawReport) : null,
      result.measuredAt,
    ];

    await client.query(query, values);
  }

  /**
   * Get CWV results by project
   */
  async getByProject(
    projectId: string,
    options: Omit<CWVQueryOptions, 'projectId'> = {}
  ): Promise<CWVResult[]> {
    return this.query({ ...options, projectId });
  }

  /**
   * Query CWV results
   */
  async query(options: CWVQueryOptions = {}): Promise<CWVResult[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.projectId) {
      conditions.push(`project_id = $${paramIndex++}`);
      values.push(options.projectId);
    }

    if (options.device) {
      conditions.push(`device = $${paramIndex++}`);
      values.push(options.device);
    }

    if (options.status) {
      conditions.push(`overall_status = $${paramIndex++}`);
      values.push(options.status);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const orderBy = options.orderBy || 'measured_at';
    const orderDir = options.orderDir || 'desc';
    const orderColumn = this.mapOrderColumn(orderBy);
    
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const query = `
      SELECT *
      FROM cwv_results
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex}
    `;

    values.push(limit, offset);

    const { rows } = await this.pool.query(query, values);

    return rows.map(row => this.mapRowToResult(row));
  }

  /**
   * Get CWV summary for a project
   */
  async getSummary(projectId: string): Promise<CWVSummary | null> {
    const query = `
      SELECT 
        project_id,
        COUNT(*) as total_pages,
        AVG(performance_score) as avg_performance_score,
        AVG(lcp_value) as avg_lcp,
        AVG(cls_value) as avg_cls,
        AVG(fcp_value) as avg_fcp,
        AVG(ttfb_value) as avg_ttfb,
        SUM(CASE WHEN overall_status = 'good' THEN 1 ELSE 0 END) as good_count,
        SUM(CASE WHEN overall_status = 'needs_improvement' THEN 1 ELSE 0 END) as needs_improvement_count,
        SUM(CASE WHEN overall_status = 'poor' THEN 1 ELSE 0 END) as poor_count,
        SUM(CASE WHEN device = 'mobile' THEN 1 ELSE 0 END) as mobile_count,
        SUM(CASE WHEN device = 'desktop' THEN 1 ELSE 0 END) as desktop_count,
        MAX(measured_at) as last_measured_at
      FROM cwv_results
      WHERE project_id = $1
      GROUP BY project_id
    `;

    const { rows } = await this.pool.query(query, [projectId]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      projectId: row.project_id,
      totalPages: parseInt(row.total_pages),
      avgPerformanceScore: Math.round(parseFloat(row.avg_performance_score) || 0),
      avgLcp: Math.round(parseFloat(row.avg_lcp) || 0),
      avgCls: parseFloat(row.avg_cls) || 0,
      avgFcp: Math.round(parseFloat(row.avg_fcp) || 0),
      avgTtfb: Math.round(parseFloat(row.avg_ttfb) || 0),
      statusBreakdown: {
        good: parseInt(row.good_count),
        needsImprovement: parseInt(row.needs_improvement_count),
        poor: parseInt(row.poor_count),
      },
      deviceBreakdown: {
        mobile: parseInt(row.mobile_count),
        desktop: parseInt(row.desktop_count),
      },
      lastMeasuredAt: row.last_measured_at,
    };
  }

  /**
   * Delete CWV results by project
   */
  async deleteByProject(projectId: string): Promise<number> {
    const query = `
      DELETE FROM cwv_results
      WHERE project_id = $1
    `;

    const { rowCount } = await this.pool.query(query, [projectId]);
    return rowCount || 0;
  }

  /**
   * Get worst performing pages
   */
  async getWorstPages(
    projectId: string,
    limit: number = 10
  ): Promise<CWVResult[]> {
    return this.query({
      projectId,
      orderBy: 'performanceScore',
      orderDir: 'asc',
      limit,
    });
  }

  /**
   * Get pages with specific status
   */
  async getPagesByStatus(
    projectId: string,
    status: CWVStatus
  ): Promise<CWVResult[]> {
    return this.query({ projectId, status });
  }

  /**
   * Map order column
   */
  private mapOrderColumn(orderBy: string): string {
    const columnMap: Record<string, string> = {
      performanceScore: 'performance_score',
      lcp: 'lcp_value',
      cls: 'cls_value',
      measuredAt: 'measured_at',
    };

    return columnMap[orderBy] || 'measured_at';
  }

  /**
   * Map database row to CWVResult
   */
  private mapRowToResult(row: any): CWVResult {
    const vitals: CoreWebVitals = {
      lcp: {
        value: parseFloat(row.lcp_value),
        unit: 'ms',
        status: row.lcp_status,
      },
      inp: row.inp_value !== null ? {
        value: parseFloat(row.inp_value),
        unit: 'ms',
        status: row.inp_status,
      } : null,
      cls: {
        value: parseFloat(row.cls_value),
        unit: 'ratio',
        status: row.cls_status,
      },
      fcp: {
        value: parseFloat(row.fcp_value),
        unit: 'ms',
        status: row.fcp_status,
      },
      ttfb: {
        value: parseFloat(row.ttfb_value),
        unit: 'ms',
        status: row.ttfb_status,
      },
      si: {
        value: parseFloat(row.si_value || 0),
        unit: 'ms',
        status: row.si_status || 'good',
      },
      tbt: {
        value: parseFloat(row.tbt_value || 0),
        unit: 'ms',
        status: row.tbt_status || 'good',
      },
      performanceScore: parseInt(row.performance_score),
    };

    return {
      id: row.id,
      projectId: row.project_id,
      url: row.url,
      device: row.device,
      vitals,
      overallStatus: row.overall_status,
      measuredAt: row.measured_at,
      lighthouseVersion: row.lighthouse_version,
      userAgent: row.user_agent,
      rawReport: row.raw_report ? JSON.parse(row.raw_report) : undefined,
    };
  }
}

export default CWVRepository;
