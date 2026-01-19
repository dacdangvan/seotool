/**
 * Rollback Manager
 * 
 * v1.1 - Manages rollback of auto-executed actions
 * 
 * Responsibilities:
 * - Store execution snapshots before changes
 * - Support automatic rollback on verification failure
 * - Support manual rollback by Admin
 * - Maintain rollback history
 * - Ensure idempotent rollback operations
 */

import { SEOAction } from '../autonomous_agent/models';
import {
  ExecutionOutcome,
  ExecutionSnapshot,
  ExecutionStatus,
  RollbackRequest,
  RollbackResult,
  Snapshot,
  CMSAdapter,
  ContentStorageAdapter,
  PageContent,
} from './models';

// Rollback configuration
interface RollbackConfig {
  maxSnapshotAge: number; // Max age in hours before snapshot expires
  maxSnapshotsPerProject: number;
  autoCleanupEnabled: boolean;
}

const DEFAULT_ROLLBACK_CONFIG: RollbackConfig = {
  maxSnapshotAge: 168, // 7 days
  maxSnapshotsPerProject: 100,
  autoCleanupEnabled: true,
};

// Rollback history entry
interface RollbackHistoryEntry {
  request: RollbackRequest;
  result: RollbackResult;
  executedAt: string;
}

export class RollbackManager {
  private logger: Console;
  private config: RollbackConfig;
  private cmsAdapter?: CMSAdapter;
  private storageAdapter?: ContentStorageAdapter;
  
  // In-memory storage (replace with database in production)
  private snapshots: Map<string, Snapshot> = new Map();
  private rollbackHistory: Map<string, RollbackHistoryEntry[]> = new Map();
  private snapshotsByExecution: Map<string, string> = new Map(); // executionId -> snapshotId

  constructor(
    config?: Partial<RollbackConfig>,
    cmsAdapter?: CMSAdapter,
    storageAdapter?: ContentStorageAdapter
  ) {
    this.config = { ...DEFAULT_ROLLBACK_CONFIG, ...config };
    this.cmsAdapter = cmsAdapter;
    this.storageAdapter = storageAdapter;
    this.logger = console;
    this.logger.log('[RollbackManager] Initialized');
  }

  /**
   * Set CMS adapter
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
    this.logger.log(`[RollbackManager] CMS adapter set: ${adapter.name}`);
  }

  /**
   * Set storage adapter
   */
  setStorageAdapter(adapter: ContentStorageAdapter): void {
    this.storageAdapter = adapter;
    this.logger.log(`[RollbackManager] Storage adapter set: ${adapter.name}`);
  }

  // ============================================================================
  // SNAPSHOT OPERATIONS
  // ============================================================================

  /**
   * Create a snapshot before execution
   */
  async createSnapshot(
    executionId: string,
    projectId: string,
    targetUrl: string
  ): Promise<Snapshot | null> {
    this.logger.log(`[RollbackManager] Creating snapshot for execution: ${executionId}`);

    if (!this.cmsAdapter) {
      this.logger.warn('[RollbackManager] No CMS adapter - cannot create snapshot');
      return null;
    }

    try {
      // Fetch current page state
      const page = await this.cmsAdapter.getPage(targetUrl);
      const content = page.content || page.html;

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.config.maxSnapshotAge);

      const snapshotData: Omit<Snapshot, 'id'> = {
        executionId,
        projectId,
        targetUrl,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        content: {
          html: content,
          text: this.extractText(content),
          meta: page.meta || {},
          schema: page.schema || [],
        },
        contentHash: this.calculateHash(content),
      };

      // Save to storage
      let snapshot: Snapshot;
      if (this.storageAdapter) {
        snapshot = await this.storageAdapter.saveSnapshot(snapshotData);
      } else {
        // In-memory fallback
        const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        snapshot = { id, ...snapshotData };
        this.snapshots.set(id, snapshot);
      }

      // Map execution to snapshot
      this.snapshotsByExecution.set(executionId, snapshot.id);

      // Cleanup old snapshots if needed
      if (this.config.autoCleanupEnabled) {
        await this.cleanupProjectSnapshots(projectId);
      }

      this.logger.log(`[RollbackManager] Snapshot created: ${snapshot.id}`);
      return snapshot;
    } catch (error) {
      this.logger.error(
        `[RollbackManager] Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    if (this.storageAdapter) {
      return this.storageAdapter.getSnapshot(snapshotId);
    }
    return this.snapshots.get(snapshotId) || null;
  }

  /**
   * Get snapshot for an execution
   */
  async getSnapshotForExecution(executionId: string): Promise<Snapshot | null> {
    const snapshotId = this.snapshotsByExecution.get(executionId);
    if (!snapshotId) {
      return null;
    }
    return this.getSnapshot(snapshotId);
  }

  // ============================================================================
  // ROLLBACK OPERATIONS
  // ============================================================================

  /**
   * Request rollback of an execution
   */
  async requestRollback(
    executionId: string,
    requestedBy: string,
    reason: string
  ): Promise<RollbackRequest> {
    const snapshot = await this.getSnapshotForExecution(executionId);
    
    if (!snapshot) {
      throw new Error(`No snapshot found for execution: ${executionId}`);
    }

    const request: RollbackRequest = {
      id: `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      executionId,
      snapshotId: snapshot.id,
      requestedBy,
      reason,
      requestedAt: new Date().toISOString(),
    };

    this.logger.log(`[RollbackManager] Rollback requested: ${request.id}`);
    return request;
  }

  /**
   * Execute rollback
   */
  async executeRollback(request: RollbackRequest): Promise<RollbackResult> {
    this.logger.log(`[RollbackManager] Executing rollback: ${request.id}`);

    const startTime = Date.now();

    // Get snapshot
    const snapshot = await this.getSnapshot(request.snapshotId);
    if (!snapshot) {
      const result: RollbackResult = {
        requestId: request.id,
        executionId: request.executionId,
        status: 'failed',
        rolledBackAt: new Date().toISOString(),
        changesReverted: 0,
        error: `Snapshot not found: ${request.snapshotId}`,
      };
      this.recordRollback('unknown', request, result);
      return result;
    }

    // Check if snapshot is expired
    if (new Date(snapshot.expiresAt) < new Date()) {
      const result: RollbackResult = {
        requestId: request.id,
        executionId: request.executionId,
        status: 'failed',
        rolledBackAt: new Date().toISOString(),
        changesReverted: 0,
        error: 'Snapshot has expired',
      };
      this.recordRollback(snapshot.projectId, request, result);
      return result;
    }

    // Execute rollback via CMS
    if (!this.cmsAdapter) {
      const result: RollbackResult = {
        requestId: request.id,
        executionId: request.executionId,
        status: 'failed',
        rolledBackAt: new Date().toISOString(),
        changesReverted: 0,
        error: 'No CMS adapter configured',
      };
      this.recordRollback(snapshot.projectId, request, result);
      return result;
    }

    try {
      // Restore page content
      const restoredPage: PageContent = {
        url: snapshot.targetUrl,
        html: snapshot.content.html,
        content: snapshot.content.html,
        title: snapshot.content.meta.title || '',
        description: snapshot.content.meta.description,
        meta: snapshot.content.meta,
        schema: snapshot.content.schema,
        lastModified: new Date().toISOString(),
      };

      const success = await this.cmsAdapter.updatePage(
        snapshot.targetUrl,
        restoredPage,
        { reason: `Rollback: ${request.reason}`, actionId: request.executionId }
      );

      if (!success) {
        throw new Error('CMS update returned false');
      }

      // Verify restoration
      const currentPage = await this.cmsAdapter.getPage(snapshot.targetUrl);
      const currentContent = currentPage.content || currentPage.html;
      const currentHash = this.calculateHash(currentContent);
      const matched = currentHash === snapshot.contentHash;

      const result: RollbackResult = {
        requestId: request.id,
        executionId: request.executionId,
        status: matched ? 'success' : 'partial',
        rolledBackAt: new Date().toISOString(),
        changesReverted: 1,
        error: matched ? undefined : 'Content hash mismatch after restore',
      };

      this.recordRollback(snapshot.projectId, request, result);
      this.logger.log(
        `[RollbackManager] Rollback ${result.status}: ${request.id} (${Date.now() - startTime}ms)`
      );
      return result;
    } catch (error) {
      const result: RollbackResult = {
        requestId: request.id,
        executionId: request.executionId,
        status: 'failed',
        rolledBackAt: new Date().toISOString(),
        changesReverted: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      this.recordRollback(snapshot.projectId, request, result);
      return result;
    }
  }

  /**
   * Automatic rollback triggered by verification failure
   */
  async autoRollback(
    outcome: ExecutionOutcome,
    reason: string
  ): Promise<RollbackResult | null> {
    this.logger.log(`[RollbackManager] Auto-rollback triggered for: ${outcome.actionId}`);

    if (!outcome.rollbackAvailable) {
      this.logger.warn('[RollbackManager] Rollback not available for this execution');
      return null;
    }

    try {
      const request = await this.requestRollback(
        outcome.actionId,
        'system:auto-rollback',
        reason
      );

      return this.executeRollback(request);
    } catch (error) {
      this.logger.error(
        `[RollbackManager] Auto-rollback failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  // ============================================================================
  // HISTORY & CLEANUP
  // ============================================================================

  /**
   * Record rollback in history
   */
  private recordRollback(
    projectId: string,
    request: RollbackRequest,
    result: RollbackResult
  ): void {
    if (!this.rollbackHistory.has(projectId)) {
      this.rollbackHistory.set(projectId, []);
    }

    this.rollbackHistory.get(projectId)!.push({
      request,
      result,
      executedAt: new Date().toISOString(),
    });
  }

  /**
   * Get rollback history for a project
   */
  getRollbackHistory(projectId: string): RollbackHistoryEntry[] {
    return this.rollbackHistory.get(projectId) || [];
  }

  /**
   * Cleanup old snapshots for a project
   */
  async cleanupProjectSnapshots(projectId: string): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    // Remove expired snapshots
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.projectId === projectId && new Date(snapshot.expiresAt) < now) {
        this.snapshots.delete(id);
        cleaned++;
      }
    }

    // Enforce max snapshots per project
    const projectSnapshots = Array.from(this.snapshots.values())
      .filter(s => s.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (projectSnapshots.length > this.config.maxSnapshotsPerProject) {
      const toRemove = projectSnapshots.slice(this.config.maxSnapshotsPerProject);
      for (const snapshot of toRemove) {
        this.snapshots.delete(snapshot.id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`[RollbackManager] Cleaned up ${cleaned} snapshots for project: ${projectId}`);
    }

    return cleaned;
  }

  /**
   * Cleanup all expired snapshots
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    if (this.storageAdapter) {
      return this.storageAdapter.cleanupExpiredSnapshots();
    }

    const now = new Date();
    let cleaned = 0;

    for (const [id, snapshot] of this.snapshots) {
      if (new Date(snapshot.expiresAt) < now) {
        this.snapshots.delete(id);
        cleaned++;
      }
    }

    this.logger.log(`[RollbackManager] Cleaned up ${cleaned} expired snapshots`);
    return cleaned;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private extractText(html: string): string {
    // Simple HTML to text extraction
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateHash(content: string): string {
    // Simple hash (in production, use crypto hash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Check if rollback is available for an execution
   */
  async isRollbackAvailable(executionId: string): Promise<boolean> {
    const snapshot = await this.getSnapshotForExecution(executionId);
    if (!snapshot) {
      return false;
    }
    return new Date(snapshot.expiresAt) > new Date();
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    totalSnapshots: number;
    totalRollbacks: number;
    successfulRollbacks: number;
    projectsTracked: number;
  } {
    let totalRollbacks = 0;
    let successfulRollbacks = 0;

    for (const history of this.rollbackHistory.values()) {
      totalRollbacks += history.length;
      successfulRollbacks += history.filter(h => h.result.status === 'success').length;
    }

    return {
      totalSnapshots: this.snapshots.size,
      totalRollbacks,
      successfulRollbacks,
      projectsTracked: this.rollbackHistory.size,
    };
  }
}

export default RollbackManager;
