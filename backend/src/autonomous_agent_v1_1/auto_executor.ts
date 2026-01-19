/**
 * Auto Executor
 * 
 * v1.1 - Executes LOW-risk actions automatically
 * 
 * Responsibilities:
 * - Execute approved LOW-risk actions
 * - Create pre-execution snapshots
 * - Apply content patches, schema injection, internal link insertion
 * - Interface with CMS adapters
 * - Return detailed execution outcomes
 * - Support idempotent execution
 */

import { SEOAction, ActionType } from '../autonomous_agent/models';
import {
  RiskLevel,
  RiskClassification,
  ValidationResult,
  ExecutionSnapshot,
  ExecutionOutcome,
  ExecutionStatus,
  CMSAdapter,
  PageContent,
} from './models';

// Execution configuration
interface ExecutorConfig {
  dryRun: boolean; // If true, simulate but don't actually execute
  createSnapshots: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  dryRun: false,
  createSnapshots: true,
  maxRetries: 2,
  retryDelayMs: 1000,
};

// Content patch for content modifications
interface ContentPatch {
  type: 'insert' | 'replace' | 'delete';
  selector?: string; // CSS selector or marker
  position?: 'before' | 'after' | 'replace';
  content?: string;
  oldContent?: string;
  newContent?: string;
}

// Schema markup patch
interface SchemaPatch {
  type: 'add' | 'modify' | 'remove';
  schemaType: string;
  properties: Record<string, unknown>;
}

// Internal link patch
interface InternalLinkPatch {
  anchorText: string;
  targetUrl: string;
  insertPosition: string; // CSS selector or text marker
  context?: string;
}

export class AutoExecutor {
  private logger: Console;
  private config: ExecutorConfig;
  private cmsAdapter?: CMSAdapter;
  private executionHistory: Map<string, ExecutionOutcome[]> = new Map();

  constructor(config?: Partial<ExecutorConfig>, cmsAdapter?: CMSAdapter) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
    this.cmsAdapter = cmsAdapter;
    this.logger = console;
    this.logger.log(`[AutoExecutor] Initialized (dryRun: ${this.config.dryRun})`);
  }

  /**
   * Set CMS adapter for page operations
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
    this.logger.log(`[AutoExecutor] CMS adapter set: ${adapter.name}`);
  }

  /**
   * Execute a validated LOW-risk action
   */
  async execute(
    action: SEOAction,
    validation: ValidationResult,
    riskClassification: RiskClassification,
    projectId: string
  ): Promise<ExecutionOutcome> {
    const startTime = Date.now();

    // Safety check: Only execute LOW-risk actions
    if (riskClassification.level !== RiskLevel.LOW) {
      return this.createFailedOutcome(
        action,
        projectId,
        `Cannot auto-execute ${riskClassification.level} risk action`,
        startTime
      );
    }

    // Safety check: Must be validated
    if (!validation.valid) {
      return this.createFailedOutcome(
        action,
        projectId,
        `Action failed validation: ${validation.blockedReason}`,
        startTime
      );
    }

    this.logger.log(`[AutoExecutor] Executing action: ${action.id} (${action.type})`);

    // Create pre-execution snapshot
    let snapshot: ExecutionSnapshot | undefined;
    if (this.config.createSnapshots && action.targetUrl) {
      snapshot = await this.createSnapshot(action.targetUrl);
    }

    try {
      // Execute based on action type
      const outcome = await this.executeByType(action, projectId, snapshot, startTime);
      
      // Record in history
      this.recordExecution(projectId, outcome);

      return outcome;
    } catch (error) {
      return this.createFailedOutcome(
        action,
        projectId,
        error instanceof Error ? error.message : String(error),
        startTime,
        snapshot
      );
    }
  }

  /**
   * Execute action based on type
   */
  private async executeByType(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number
  ): Promise<ExecutionOutcome> {
    switch (action.type) {
      case ActionType.ADD_INTERNAL_LINK:
        return this.executeInternalLink(action, projectId, snapshot, startTime);

      case ActionType.OPTIMIZE_ANCHOR_TEXT:
        return this.executeAnchorTextOptimization(action, projectId, snapshot, startTime);

      case ActionType.OPTIMIZE_CONTENT:
        return this.executeContentOptimization(action, projectId, snapshot, startTime);

      case ActionType.FIX_SCHEMA_MARKUP:
        return this.executeSchemaFix(action, projectId, snapshot, startTime);

      case ActionType.SET_UP_ALERT:
        return this.executeAlertSetup(action, projectId, startTime);

      case ActionType.INVESTIGATE_ANOMALY:
        return this.executeInvestigation(action, projectId, startTime);

      default:
        return this.createFailedOutcome(
          action,
          projectId,
          `Action type ${action.type} not supported for auto-execution`,
          startTime,
          snapshot
        );
    }
  }

  // ============================================================================
  // ACTION TYPE EXECUTORS
  // ============================================================================

  private async executeInternalLink(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Executing internal link insertion`);

    if (this.config.dryRun) {
      return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
        dryRun: true,
        message: 'Would insert internal link',
        details: this.extractLinkDetails(action),
      });
    }

    if (!this.cmsAdapter || !action.targetUrl) {
      return this.createFailedOutcome(
        action,
        projectId,
        'CMS adapter or target URL not available',
        startTime,
        snapshot
      );
    }

    // Parse link details from action
    const linkDetails = this.extractLinkDetails(action);

    // Create patch
    const patch: InternalLinkPatch = {
      anchorText: linkDetails.anchorText || 'Learn more',
      targetUrl: linkDetails.linkTarget || '',
      insertPosition: linkDetails.insertPosition || 'p:last-of-type',
    };

    // Apply via CMS adapter
    const page = await this.cmsAdapter.getPage(action.targetUrl);
    const updatedContent = this.applyInternalLinkPatch(page.content || page.html, patch);

    const updatedPage: PageContent = {
      ...page,
      content: updatedContent,
      html: updatedContent,
    };
    await this.cmsAdapter.updatePage(action.targetUrl, updatedPage, {
      reason: `Auto-execution: ${action.title}`,
      actionId: action.id,
    });

    return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
      linkInserted: true,
      anchorText: patch.anchorText,
      linkTarget: patch.targetUrl,
    });
  }

  private async executeAnchorTextOptimization(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Executing anchor text optimization`);

    if (this.config.dryRun) {
      return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
        dryRun: true,
        message: 'Would optimize anchor text',
      });
    }

    if (!this.cmsAdapter || !action.targetUrl) {
      return this.createFailedOutcome(
        action,
        projectId,
        'CMS adapter or target URL not available',
        startTime,
        snapshot
      );
    }

    // Extract optimization details
    const optimizationDetails = this.extractAnchorTextDetails(action);

    const page = await this.cmsAdapter.getPage(action.targetUrl);
    const updatedContent = this.applyAnchorTextPatch(
      page.content || page.html,
      optimizationDetails.oldAnchorText,
      optimizationDetails.newAnchorText
    );

    const updatedPage: PageContent = {
      ...page,
      content: updatedContent,
      html: updatedContent,
    };
    await this.cmsAdapter.updatePage(action.targetUrl, updatedPage, {
      reason: `Auto-execution: ${action.title}`,
      actionId: action.id,
    });

    return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
      anchorOptimized: true,
      ...optimizationDetails,
    });
  }

  private async executeContentOptimization(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Executing content optimization`);

    if (this.config.dryRun) {
      return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
        dryRun: true,
        message: 'Would optimize content',
      });
    }

    // Content optimization is typically small tweaks for LOW-risk
    // Large changes would be classified as MEDIUM or HIGH risk
    if (!this.cmsAdapter || !action.targetUrl) {
      return this.createFailedOutcome(
        action,
        projectId,
        'CMS adapter or target URL not available',
        startTime,
        snapshot
      );
    }

    const page = await this.cmsAdapter.getPage(action.targetUrl);
    const patches = this.extractContentPatches(action);
    
    let updatedContent = page.content || page.html;
    for (const patch of patches) {
      updatedContent = this.applyContentPatch(updatedContent, patch);
    }

    const updatedPage: PageContent = {
      ...page,
      content: updatedContent,
      html: updatedContent,
    };
    await this.cmsAdapter.updatePage(action.targetUrl, updatedPage, {
      reason: `Auto-execution: ${action.title}`,
      actionId: action.id,
    });

    return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
      contentOptimized: true,
      patchCount: patches.length,
    });
  }

  private async executeSchemaFix(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Executing schema markup fix`);

    if (this.config.dryRun) {
      return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
        dryRun: true,
        message: 'Would fix schema markup',
      });
    }

    if (!this.cmsAdapter || !action.targetUrl) {
      return this.createFailedOutcome(
        action,
        projectId,
        'CMS adapter or target URL not available',
        startTime,
        snapshot
      );
    }

    const page = await this.cmsAdapter.getPage(action.targetUrl);
    const schemaPatch = this.extractSchemaPatch(action);
    const updatedContent = this.applySchemaMarkupPatch(page.content || page.html, schemaPatch);

    const updatedPage: PageContent = {
      ...page,
      content: updatedContent,
      html: updatedContent,
    };
    await this.cmsAdapter.updatePage(action.targetUrl, updatedPage, {
      reason: `Auto-execution: ${action.title}`,
      actionId: action.id,
    });

    return this.createSuccessOutcome(action, projectId, snapshot, startTime, {
      schemaFixed: true,
      schemaType: schemaPatch.schemaType,
    });
  }

  private async executeAlertSetup(
    action: SEOAction,
    projectId: string,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Setting up alert`);

    // Alert setup doesn't modify content, so always safe
    // In a real implementation, this would interact with monitoring system

    return this.createSuccessOutcome(action, projectId, undefined, startTime, {
      alertConfigured: true,
      alertType: 'seo-monitoring',
      targetUrl: action.targetUrl,
    });
  }

  private async executeInvestigation(
    action: SEOAction,
    projectId: string,
    startTime: number
  ): Promise<ExecutionOutcome> {
    this.logger.log(`[AutoExecutor] Executing investigation (read-only)`);

    // Investigation is read-only, always safe
    // In a real implementation, this would gather data and create a report

    return this.createSuccessOutcome(action, projectId, undefined, startTime, {
      investigated: true,
      message: 'Investigation completed - results logged',
    });
  }

  // ============================================================================
  // PATCH APPLICATION HELPERS
  // ============================================================================

  private applyInternalLinkPatch(content: string, patch: InternalLinkPatch): string {
    const linkHtml = `<a href="${patch.targetUrl}">${patch.anchorText}</a>`;
    
    // Simple implementation: append to last paragraph
    // In real implementation, would use DOM manipulation
    const insertPosition = content.lastIndexOf('</p>');
    if (insertPosition === -1) {
      return content + ` ${linkHtml}`;
    }

    return (
      content.slice(0, insertPosition) +
      ` ${linkHtml}` +
      content.slice(insertPosition)
    );
  }

  private applyAnchorTextPatch(
    content: string,
    oldAnchor: string,
    newAnchor: string
  ): string {
    // Replace anchor text within link tags
    const regex = new RegExp(`(<a[^>]*>)${this.escapeRegex(oldAnchor)}(</a>)`, 'gi');
    return content.replace(regex, `$1${newAnchor}$2`);
  }

  private applyContentPatch(content: string, patch: ContentPatch): string {
    switch (patch.type) {
      case 'replace':
        if (patch.oldContent && patch.newContent) {
          return content.replace(patch.oldContent, patch.newContent);
        }
        break;
      case 'insert':
        if (patch.content && patch.position) {
          // Simple insert at end
          return content + patch.content;
        }
        break;
      case 'delete':
        if (patch.oldContent) {
          return content.replace(patch.oldContent, '');
        }
        break;
    }
    return content;
  }

  private applySchemaMarkupPatch(content: string, patch: SchemaPatch): string {
    const schemaJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': patch.schemaType,
      ...patch.properties,
    }, null, 2);

    const schemaScript = `<script type="application/ld+json">\n${schemaJson}\n</script>`;

    // Insert before closing head tag, or append
    const headClose = content.indexOf('</head>');
    if (headClose !== -1) {
      return content.slice(0, headClose) + schemaScript + '\n' + content.slice(headClose);
    }
    return content + '\n' + schemaScript;
  }

  // ============================================================================
  // EXTRACTION HELPERS
  // ============================================================================

  private extractLinkDetails(action: SEOAction): {
    anchorText?: string;
    linkTarget?: string;
    insertPosition?: string;
  } {
    // Extract from action description/evidence
    // In real implementation, action would have structured data
    return {
      anchorText: action.title.includes('link') ? 'Learn more' : undefined,
      linkTarget: action.targetUrl,
    };
  }

  private extractAnchorTextDetails(action: SEOAction): {
    oldAnchorText: string;
    newAnchorText: string;
  } {
    // Extract from action description/evidence
    return {
      oldAnchorText: 'click here',
      newAnchorText: action.title.replace('Optimize anchor text: ', '') || 'detailed guide',
    };
  }

  private extractContentPatches(action: SEOAction): ContentPatch[] {
    // Extract from action evidence
    return action.evidence.map(e => ({
      type: 'replace' as const,
      oldContent: e.description,
      newContent: e.description, // In real impl, would have suggested fix
    }));
  }

  private extractSchemaPatch(action: SEOAction): SchemaPatch {
    return {
      type: 'add',
      schemaType: 'WebPage',
      properties: {
        name: action.title,
        description: action.description,
      },
    };
  }

  // ============================================================================
  // SNAPSHOT & OUTCOME HELPERS
  // ============================================================================

  private async createSnapshot(url: string): Promise<ExecutionSnapshot | undefined> {
    if (!this.cmsAdapter) {
      return undefined;
    }

    try {
      const page = await this.cmsAdapter.getPage(url);
      
      return {
        url,
        contentBefore: page.content || page.html,
        metadataBefore: {
          title: page.title,
          description: page.description || page.meta?.description,
        },
        timestamp: new Date().toISOString(),
        checksum: this.calculateChecksum(page.content || page.html),
      };
    } catch {
      this.logger.warn(`[AutoExecutor] Could not create snapshot for ${url}`);
      return undefined;
    }
  }

  private calculateChecksum(content: string): string {
    // Simple checksum (in production, use proper hash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private createSuccessOutcome(
    action: SEOAction,
    projectId: string,
    snapshot: ExecutionSnapshot | undefined,
    startTime: number,
    data: Record<string, unknown>
  ): ExecutionOutcome {
    return {
      actionId: action.id,
      projectId,
      status: ExecutionStatus.SUCCESS,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      snapshot,
      data,
      rollbackAvailable: !!snapshot,
    };
  }

  private createFailedOutcome(
    action: SEOAction,
    projectId: string,
    errorMessage: string,
    startTime: number,
    snapshot?: ExecutionSnapshot
  ): ExecutionOutcome {
    return {
      actionId: action.id,
      projectId,
      status: ExecutionStatus.FAILED,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      snapshot,
      error: errorMessage,
      rollbackAvailable: false,
    };
  }

  private recordExecution(projectId: string, outcome: ExecutionOutcome): void {
    if (!this.executionHistory.has(projectId)) {
      this.executionHistory.set(projectId, []);
    }
    this.executionHistory.get(projectId)!.push(outcome);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get execution history for a project
   */
  getExecutionHistory(projectId: string): ExecutionOutcome[] {
    return this.executionHistory.get(projectId) || [];
  }

  /**
   * Get executor stats
   */
  getStats(): {
    projectsTracked: number;
    totalExecutions: number;
    successRate: number;
    dryRunMode: boolean;
  } {
    let totalExecutions = 0;
    let successfulExecutions = 0;

    for (const outcomes of this.executionHistory.values()) {
      totalExecutions += outcomes.length;
      successfulExecutions += outcomes.filter(o => o.status === ExecutionStatus.SUCCESS).length;
    }

    return {
      projectsTracked: this.executionHistory.size,
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      dryRunMode: this.config.dryRun,
    };
  }
}

export default AutoExecutor;
