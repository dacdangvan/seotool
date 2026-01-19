/**
 * Partial Execution Controller v1.3
 * 
 * Manages partial auto-execution for medium-confidence actions.
 * 
 * Responsibilities:
 * - Execute only a subset of the action within constraints
 * - Limit % content change
 * - Limit number of internal links
 * - Apply to sample pages only when required
 * - Flag remaining scope for manual approval
 * - Ensure idempotent execution
 * - Maintain rollback availability
 */

import {
  PartialExecutionConstraints,
  PartialExecutionResult,
  ExecutedScope,
  RemainingScope,
  ManualApprovalItem,
  ExecutionModeResult,
  ExecutionMode,
} from './models_v2';
import { SEOAction, ActionType } from '../autonomous_agent/models';
import { 
  ExecutionOutcome, 
  ExecutionStatus, 
  ExecutionSnapshot,
  CMSAdapter,
  PageContent,
} from '../autonomous_agent_v1_1/models';

/**
 * Page selection for partial execution
 */
interface PageSelection {
  selectedPages: string[];
  excludedPages: string[];
  selectionMethod: 'random_sample' | 'priority_based' | 'all_within_limit';
  reason: string;
}

/**
 * Content change calculation
 */
interface ContentChangeAnalysis {
  originalLength: number;
  changedLength: number;
  changePercent: number;
  withinLimit: boolean;
  truncatedContent?: string;
}

export class PartialExecutionController {
  private cmsAdapter?: CMSAdapter;
  private logger: Console;
  private executionHistory: Map<string, PartialExecutionResult[]> = new Map();
  
  constructor(cmsAdapter?: CMSAdapter) {
    this.cmsAdapter = cmsAdapter;
    this.logger = console;
  }
  
  /**
   * Set CMS adapter
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
  }
  
  /**
   * Execute action partially within constraints
   */
  async executePartial(
    action: SEOAction,
    modeResult: ExecutionModeResult,
    projectId: string,
    availablePages?: string[]
  ): Promise<PartialExecutionResult> {
    const startTime = Date.now();
    
    // Validate we're in partial mode
    if (modeResult.mode !== ExecutionMode.PARTIAL_AUTO) {
      throw new Error(`Partial execution requires PARTIAL_AUTO mode, got ${modeResult.mode}`);
    }
    
    if (!modeResult.partialConstraints) {
      throw new Error('No partial constraints provided');
    }
    
    const constraints = modeResult.partialConstraints;
    this.logger.log(`[PartialExecution] Starting partial execution for ${action.id}`);
    this.logger.log(`[PartialExecution] Constraints:`, constraints);
    
    // Select pages for execution
    const pageSelection = this.selectPages(
      action,
      constraints,
      availablePages || []
    );
    
    // Execute on selected pages
    const executedScope = await this.executeOnPages(
      action,
      pageSelection.selectedPages,
      constraints
    );
    
    // Calculate remaining scope
    const remainingScope = this.calculateRemainingScope(
      action,
      pageSelection,
      constraints
    );
    
    // Update constraints with manual approval items
    constraints.manualApprovalRequired = remainingScope.itemsFlaggedForManual;
    
    const result: PartialExecutionResult = {
      actionId: action.id,
      executedScope,
      remainingScope,
      constraints,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
    
    // Record in history
    this.recordExecution(projectId, result);
    
    return result;
  }
  
  /**
   * Select pages for partial execution
   */
  private selectPages(
    action: SEOAction,
    constraints: PartialExecutionConstraints,
    availablePages: string[]
  ): PageSelection {
    const maxPages = constraints.maxPagesAffected;
    
    // If specific pages are allowed, use those
    if (constraints.allowedPageIds && constraints.allowedPageIds.length > 0) {
      const selected = constraints.allowedPageIds.slice(0, maxPages);
      return {
        selectedPages: selected,
        excludedPages: constraints.allowedPageIds.slice(maxPages),
        selectionMethod: 'priority_based',
        reason: 'Using pre-approved page list',
      };
    }
    
    // If sample pages only, select a sample
    if (constraints.samplePagesOnly) {
      const sampleSize = constraints.sampleSize || Math.ceil(maxPages * 0.3);
      const selected = this.selectSamplePages(availablePages, sampleSize);
      return {
        selectedPages: selected,
        excludedPages: availablePages.filter(p => !selected.includes(p)),
        selectionMethod: 'random_sample',
        reason: `Random sample of ${sampleSize} pages for initial validation`,
      };
    }
    
    // Otherwise, take up to maxPages
    const selected = availablePages.slice(0, maxPages);
    return {
      selectedPages: selected,
      excludedPages: availablePages.slice(maxPages),
      selectionMethod: 'all_within_limit',
      reason: `First ${maxPages} pages within constraint limit`,
    };
  }
  
  /**
   * Select sample pages (simple random selection)
   */
  private selectSamplePages(pages: string[], sampleSize: number): string[] {
    if (pages.length <= sampleSize) {
      return pages;
    }
    
    // Simple shuffle and take first n
    const shuffled = [...pages].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }
  
  /**
   * Execute action on selected pages
   */
  private async executeOnPages(
    action: SEOAction,
    pages: string[],
    constraints: PartialExecutionConstraints
  ): Promise<ExecutedScope> {
    let pagesAffected = 0;
    let totalContentChangePercent = 0;
    let linksAdded = 0;
    const details: Record<string, unknown> = { pageResults: [] };
    
    for (const pageUrl of pages) {
      try {
        const pageResult = await this.executeOnSinglePage(
          action,
          pageUrl,
          constraints,
          linksAdded
        );
        
        if (pageResult.executed) {
          pagesAffected++;
          totalContentChangePercent += pageResult.contentChangePercent;
          linksAdded += pageResult.linksAdded;
          (details.pageResults as unknown[]).push(pageResult);
        }
        
        // Check if we've hit link limit
        if (linksAdded >= constraints.maxInternalLinks) {
          this.logger.log(`[PartialExecution] Link limit reached (${linksAdded})`);
          break;
        }
      } catch (error) {
        this.logger.warn(`[PartialExecution] Failed on page ${pageUrl}:`, error);
        (details.pageResults as unknown[]).push({
          url: pageUrl,
          executed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return {
      pagesAffected,
      contentChangePercent: pagesAffected > 0 
        ? totalContentChangePercent / pagesAffected 
        : 0,
      linksAdded,
      details,
    };
  }
  
  /**
   * Execute on a single page with constraint checking
   */
  private async executeOnSinglePage(
    action: SEOAction,
    pageUrl: string,
    constraints: PartialExecutionConstraints,
    currentLinksAdded: number
  ): Promise<{
    url: string;
    executed: boolean;
    contentChangePercent: number;
    linksAdded: number;
    snapshot?: ExecutionSnapshot;
  }> {
    if (!this.cmsAdapter) {
      // Dry run mode
      return {
        url: pageUrl,
        executed: true,
        contentChangePercent: 2, // Simulated
        linksAdded: action.type === ActionType.ADD_INTERNAL_LINK ? 1 : 0,
      };
    }
    
    // Get current page content
    const page = await this.cmsAdapter.getPage(pageUrl);
    const originalContent = page.content || page.html;
    
    // Create snapshot
    const snapshot: ExecutionSnapshot = {
      url: pageUrl,
      contentBefore: originalContent,
      metadataBefore: {
        title: page.title,
        description: page.description || page.meta?.description,
      },
      timestamp: new Date().toISOString(),
      checksum: this.calculateChecksum(originalContent),
    };
    
    // Generate modified content based on action type
    const { modifiedContent, linksAdded } = this.generateModifiedContent(
      action,
      originalContent,
      constraints,
      currentLinksAdded
    );
    
    // Analyze content change
    const changeAnalysis = this.analyzeContentChange(
      originalContent,
      modifiedContent,
      constraints.maxContentChangePercent
    );
    
    // Check if within limits
    if (!changeAnalysis.withinLimit) {
      this.logger.log(
        `[PartialExecution] Change ${changeAnalysis.changePercent.toFixed(1)}% exceeds limit ${constraints.maxContentChangePercent}%`
      );
      
      // Use truncated content if available
      if (changeAnalysis.truncatedContent) {
        const truncatedAnalysis = this.analyzeContentChange(
          originalContent,
          changeAnalysis.truncatedContent,
          constraints.maxContentChangePercent
        );
        
        if (truncatedAnalysis.withinLimit) {
          // Apply truncated version
          const updatedPage: PageContent = {
            ...page,
            content: changeAnalysis.truncatedContent,
            html: changeAnalysis.truncatedContent,
          };
          
          await this.cmsAdapter.updatePage(pageUrl, updatedPage, {
            reason: `Partial auto-execution (truncated): ${action.title}`,
            actionId: action.id,
          });
          
          return {
            url: pageUrl,
            executed: true,
            contentChangePercent: truncatedAnalysis.changePercent,
            linksAdded: 0, // Truncated = no links in this version
            snapshot,
          };
        }
      }
      
      // Cannot execute within constraints
      return {
        url: pageUrl,
        executed: false,
        contentChangePercent: changeAnalysis.changePercent,
        linksAdded: 0,
        snapshot,
      };
    }
    
    // Apply the change
    const updatedPage: PageContent = {
      ...page,
      content: modifiedContent,
      html: modifiedContent,
    };
    
    await this.cmsAdapter.updatePage(pageUrl, updatedPage, {
      reason: `Partial auto-execution: ${action.title}`,
      actionId: action.id,
    });
    
    return {
      url: pageUrl,
      executed: true,
      contentChangePercent: changeAnalysis.changePercent,
      linksAdded,
      snapshot,
    };
  }
  
  /**
   * Generate modified content based on action type
   */
  private generateModifiedContent(
    action: SEOAction,
    originalContent: string,
    constraints: PartialExecutionConstraints,
    currentLinksAdded: number
  ): { modifiedContent: string; linksAdded: number } {
    switch (action.type) {
      case ActionType.ADD_INTERNAL_LINK:
        return this.generateInternalLinkChange(
          originalContent,
          action,
          constraints.maxInternalLinks - currentLinksAdded
        );
      
      case ActionType.OPTIMIZE_CONTENT:
        return {
          modifiedContent: this.generateContentOptimization(originalContent, action),
          linksAdded: 0,
        };
      
      case ActionType.FIX_SCHEMA_MARKUP:
        return {
          modifiedContent: this.generateSchemaFix(originalContent, action),
          linksAdded: 0,
        };
      
      default:
        return { modifiedContent: originalContent, linksAdded: 0 };
    }
  }
  
  /**
   * Generate internal link changes
   */
  private generateInternalLinkChange(
    content: string,
    action: SEOAction,
    maxLinks: number
  ): { modifiedContent: string; linksAdded: number } {
    if (maxLinks <= 0) {
      return { modifiedContent: content, linksAdded: 0 };
    }
    
    // Simple link insertion (in production, would be more sophisticated)
    const linkHtml = `<a href="${action.targetUrl}">Learn more</a>`;
    
    // Find last paragraph and insert
    const lastPIndex = content.lastIndexOf('</p>');
    if (lastPIndex === -1) {
      return { 
        modifiedContent: content + ` ${linkHtml}`, 
        linksAdded: 1 
      };
    }
    
    return {
      modifiedContent: content.slice(0, lastPIndex) + ` ${linkHtml}` + content.slice(lastPIndex),
      linksAdded: 1,
    };
  }
  
  /**
   * Generate content optimization
   */
  private generateContentOptimization(content: string, action: SEOAction): string {
    // Placeholder - in production, would apply specific optimizations
    // For partial execution, we limit changes
    return content;
  }
  
  /**
   * Generate schema fix
   */
  private generateSchemaFix(content: string, action: SEOAction): string {
    // Placeholder - in production, would add/fix schema markup
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: action.title,
    };
    
    const schemaScript = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    
    const headClose = content.indexOf('</head>');
    if (headClose !== -1) {
      return content.slice(0, headClose) + schemaScript + '\n' + content.slice(headClose);
    }
    
    return content + '\n' + schemaScript;
  }
  
  /**
   * Analyze content change percentage
   */
  private analyzeContentChange(
    original: string,
    modified: string,
    maxChangePercent: number
  ): ContentChangeAnalysis {
    const originalLength = original.length;
    const modifiedLength = modified.length;
    
    // Calculate Levenshtein-style change (simplified)
    const changeLength = Math.abs(modifiedLength - originalLength);
    const changePercent = (changeLength / originalLength) * 100;
    
    const withinLimit = changePercent <= maxChangePercent;
    
    // If over limit, try to create truncated version
    let truncatedContent: string | undefined;
    if (!withinLimit && modifiedLength > originalLength) {
      // Calculate how much we can add
      const maxAddition = Math.floor(originalLength * (maxChangePercent / 100));
      const currentAddition = modifiedLength - originalLength;
      
      if (currentAddition > maxAddition) {
        // Truncate the addition
        const truncateAmount = currentAddition - maxAddition;
        truncatedContent = modified.slice(0, -truncateAmount);
      }
    }
    
    return {
      originalLength,
      changedLength: modifiedLength,
      changePercent,
      withinLimit,
      truncatedContent,
    };
  }
  
  /**
   * Calculate remaining scope for manual approval
   */
  private calculateRemainingScope(
    action: SEOAction,
    pageSelection: PageSelection,
    constraints: PartialExecutionConstraints
  ): RemainingScope {
    const excludedPages = pageSelection.excludedPages;
    const itemsFlaggedForManual: ManualApprovalItem[] = [];
    
    // Flag excluded pages
    if (excludedPages.length > 0) {
      itemsFlaggedForManual.push({
        description: `Apply action to remaining ${excludedPages.length} pages`,
        scope: excludedPages.slice(0, 5).join(', ') + (excludedPages.length > 5 ? '...' : ''),
        reason: pageSelection.selectionMethod === 'random_sample'
          ? 'Sample pages executed first for validation'
          : `Exceeded max pages limit (${constraints.maxPagesAffected})`,
        estimatedImpact: excludedPages.length > 10 ? 'high' : 'medium',
      });
    }
    
    // Flag if links were limited
    if (action.type === ActionType.ADD_INTERNAL_LINK) {
      itemsFlaggedForManual.push({
        description: 'Review link insertion strategy',
        scope: 'All pages with new internal links',
        reason: 'Partial execution limited link count',
        estimatedImpact: 'low',
      });
    }
    
    return {
      pagesRemaining: excludedPages.length,
      itemsFlaggedForManual,
      estimatedRemainingWork: excludedPages.length > 0
        ? `${excludedPages.length} pages pending manual review`
        : 'No remaining work',
    };
  }
  
  /**
   * Calculate simple checksum
   */
  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  /**
   * Record execution in history
   */
  private recordExecution(projectId: string, result: PartialExecutionResult): void {
    if (!this.executionHistory.has(projectId)) {
      this.executionHistory.set(projectId, []);
    }
    this.executionHistory.get(projectId)!.push(result);
  }
  
  /**
   * Get execution history
   */
  getExecutionHistory(projectId: string): PartialExecutionResult[] {
    return this.executionHistory.get(projectId) || [];
  }
  
  /**
   * Explain partial execution result
   */
  explainResult(result: PartialExecutionResult): string {
    let explanation = `## Partial Execution Result\n\n`;
    
    explanation += `**Action ID**: ${result.actionId}\n`;
    explanation += `**Duration**: ${result.durationMs}ms\n\n`;
    
    explanation += `### Executed Scope\n`;
    explanation += `- Pages affected: ${result.executedScope.pagesAffected}\n`;
    explanation += `- Content change: ${result.executedScope.contentChangePercent.toFixed(1)}% average\n`;
    explanation += `- Links added: ${result.executedScope.linksAdded}\n\n`;
    
    explanation += `### Remaining Scope\n`;
    explanation += `- Pages remaining: ${result.remainingScope.pagesRemaining}\n`;
    explanation += `- Estimated work: ${result.remainingScope.estimatedRemainingWork}\n\n`;
    
    if (result.remainingScope.itemsFlaggedForManual.length > 0) {
      explanation += `### Items Requiring Manual Approval\n`;
      for (const item of result.remainingScope.itemsFlaggedForManual) {
        explanation += `- **${item.description}**\n`;
        explanation += `  - Scope: ${item.scope}\n`;
        explanation += `  - Reason: ${item.reason}\n`;
        explanation += `  - Impact: ${item.estimatedImpact}\n`;
      }
    }
    
    return explanation;
  }
}
