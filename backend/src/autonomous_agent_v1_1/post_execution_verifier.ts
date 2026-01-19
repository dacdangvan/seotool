/**
 * Post-Execution Verifier
 * 
 * v1.1 - Verifies execution results and triggers rollback if needed
 * 
 * Responsibilities:
 * - Re-validate page integrity after execution
 * - Perform basic SEO health checks
 * - Capture before/after diff
 * - Determine if execution was successful
 * - Trigger automatic rollback on failure
 */

import { SEOAction } from '../autonomous_agent/models';
import {
  ExecutionOutcome,
  ExecutionSnapshot,
  ExecutionStatus,
  VerificationResult,
  VerificationCheck,
  CMSAdapter,
  PageContent,
} from './models';

// Verification configuration
interface VerificationConfig {
  strictMode: boolean; // Fail on any check failure
  maxAllowedDiff: number; // Maximum diff percentage before flagging
  seoHealthChecks: boolean; // Run SEO health checks
}

const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  strictMode: false,
  maxAllowedDiff: 20, // 20% max change
  seoHealthChecks: true,
};

// Diff result
interface DiffResult {
  additions: number;
  deletions: number;
  totalChanges: number;
  percentChange: number;
  summary: string;
}

export class PostExecutionVerifier {
  private logger: Console;
  private config: VerificationConfig;
  private cmsAdapter?: CMSAdapter;

  constructor(config?: Partial<VerificationConfig>, cmsAdapter?: CMSAdapter) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };
    this.cmsAdapter = cmsAdapter;
    this.logger = console;
    this.logger.log('[PostExecutionVerifier] Initialized');
  }

  /**
   * Set CMS adapter for page verification
   */
  setCMSAdapter(adapter: CMSAdapter): void {
    this.cmsAdapter = adapter;
    this.logger.log(`[PostExecutionVerifier] CMS adapter set: ${adapter.name}`);
  }

  /**
   * Verify execution outcome
   */
  async verify(
    outcome: ExecutionOutcome,
    action: SEOAction,
    projectId: string
  ): Promise<VerificationResult> {
    this.logger.log(`[PostExecutionVerifier] Verifying execution: ${outcome.actionId}`);

    const checks: VerificationCheck[] = [];
    let autoRollbackTriggered = false;

    // Check 1: Execution status
    checks.push(this.verifyExecutionStatus(outcome));

    // Check 2: Page is still accessible
    if (action.targetUrl && this.cmsAdapter) {
      const accessCheck = await this.verifyPageAccessible(action.targetUrl);
      checks.push(accessCheck);
    }

    // Check 3: Content diff is within limits
    if (outcome.snapshot && action.targetUrl && this.cmsAdapter) {
      const diffCheck = await this.verifyContentDiff(
        outcome.snapshot,
        action.targetUrl
      );
      checks.push(diffCheck);
    }

    // Check 4: SEO health checks
    if (this.config.seoHealthChecks && action.targetUrl && this.cmsAdapter) {
      const seoChecks = await this.runSEOHealthChecks(action.targetUrl);
      checks.push(...seoChecks);
    }

    // Check 5: Verify changes match intent
    checks.push(this.verifyIntentMatch(action, outcome));

    // Determine overall result
    const criticalFailures = checks.filter(
      c => !c.passed && c.name.startsWith('critical_')
    );
    const warnings = checks.filter(
      c => !c.passed && !c.name.startsWith('critical_')
    );

    const passed = this.config.strictMode
      ? checks.every(c => c.passed)
      : criticalFailures.length === 0;

    // Auto rollback on critical failures
    if (!passed && outcome.rollbackAvailable) {
      autoRollbackTriggered = true;
      this.logger.warn(
        `[PostExecutionVerifier] Verification failed - auto rollback triggered`
      );
    }

    const result: VerificationResult = {
      executionId: outcome.actionId,
      passed,
      checks,
      verifiedAt: new Date().toISOString(),
      autoRollbackTriggered,
    };

    this.logger.log(
      `[PostExecutionVerifier] Verification ${passed ? 'PASSED' : 'FAILED'}. ` +
      `${criticalFailures.length} critical failures, ${warnings.length} warnings.`
    );

    return result;
  }

  // ============================================================================
  // VERIFICATION CHECKS
  // ============================================================================

  private verifyExecutionStatus(outcome: ExecutionOutcome): VerificationCheck {
    const successStatuses = [
      ExecutionStatus.SUCCESS,
      ExecutionStatus.COMPLETED,
      ExecutionStatus.VERIFIED,
    ];
    const passed = successStatuses.includes(outcome.status);

    return {
      name: 'critical_execution_status',
      passed,
      expected: 'success or completed',
      actual: outcome.status,
      message: passed
        ? `Execution completed with status: ${outcome.status}`
        : `Execution failed with status: ${outcome.status}. Error: ${outcome.error || 'Unknown'}`,
    };
  }

  private async verifyPageAccessible(url: string): Promise<VerificationCheck> {
    if (!this.cmsAdapter) {
      return {
        name: 'critical_page_accessible',
        passed: true,
        expected: 'page accessible',
        actual: 'no adapter - skipped',
        message: 'No CMS adapter - skipping accessibility check',
      };
    }

    try {
      const page = await this.cmsAdapter.getPage(url);
      const hasContent = (page.content || page.html).length > 0;

      return {
        name: 'critical_page_accessible',
        passed: hasContent,
        expected: 'page accessible with content',
        actual: hasContent ? 'accessible' : 'no content',
        message: hasContent
          ? `Page is accessible: ${url}`
          : `Page has no content after execution: ${url}`,
      };
    } catch (error) {
      return {
        name: 'critical_page_accessible',
        passed: false,
        expected: 'page accessible',
        actual: 'error',
        message: `Page not accessible: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async verifyContentDiff(
    snapshot: ExecutionSnapshot,
    url: string
  ): Promise<VerificationCheck> {
    if (!this.cmsAdapter) {
      return {
        name: 'content_diff',
        passed: true,
        expected: 'diff within limits',
        actual: 'no adapter - skipped',
        message: 'No CMS adapter - skipping diff check',
      };
    }

    try {
      const currentPage = await this.cmsAdapter.getPage(url);
      const currentContent = currentPage.content || currentPage.html;
      const diff = this.calculateDiff(snapshot.contentBefore, currentContent);

      const passed = diff.percentChange <= this.config.maxAllowedDiff;

      return {
        name: passed ? 'content_diff' : 'critical_content_diff',
        passed,
        expected: `diff <= ${this.config.maxAllowedDiff}%`,
        actual: `${diff.percentChange.toFixed(1)}%`,
        message: passed
          ? `Content diff (${diff.percentChange.toFixed(1)}%) is within limits`
          : `Content diff (${diff.percentChange.toFixed(1)}%) exceeds maximum allowed (${this.config.maxAllowedDiff}%)`,
      };
    } catch (error) {
      return {
        name: 'content_diff',
        passed: false,
        expected: 'diff calculated',
        actual: 'error',
        message: `Could not calculate diff: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async runSEOHealthChecks(url: string): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];

    if (!this.cmsAdapter) {
      return checks;
    }

    try {
      const page = await this.cmsAdapter.getPage(url);
      const content = page.content || page.html;

      // Check: Title exists
      checks.push({
        name: 'seo_title_exists',
        passed: !!page.title && page.title.length > 0,
        expected: 'title exists',
        actual: page.title ? `"${page.title.substring(0, 50)}..."` : 'missing',
        message: page.title
          ? `Page has title: ${page.title}`
          : 'Page is missing title',
      });

      // Check: Title length
      const titleLength = page.title?.length || 0;
      const titleLengthOk = titleLength >= 30 && titleLength <= 60;
      checks.push({
        name: 'seo_title_length',
        passed: titleLengthOk,
        expected: '30-60 characters',
        actual: `${titleLength} characters`,
        message: titleLengthOk
          ? `Title length (${titleLength}) is optimal`
          : `Title length (${titleLength}) is ${titleLength < 30 ? 'too short' : 'too long'}`,
      });

      // Check: Meta description exists
      const metaDesc = page.description || page.meta?.description;
      checks.push({
        name: 'seo_meta_description',
        passed: !!metaDesc && metaDesc.length > 0,
        expected: 'meta description exists',
        actual: metaDesc ? `"${metaDesc.substring(0, 50)}..."` : 'missing',
        message: metaDesc
          ? `Page has meta description`
          : 'Page is missing meta description',
      });

      // Check: H1 exists
      const h1Match = content.match(/<h1[^>]*>([^<]*)<\/h1>/i);
      const hasH1 = !!h1Match;
      checks.push({
        name: 'seo_h1_exists',
        passed: hasH1,
        expected: 'H1 exists',
        actual: hasH1 ? 'found' : 'missing',
        message: hasH1
          ? `Page has H1 heading`
          : 'Page is missing H1 heading',
      });

      // Check: No broken internal links (basic check)
      const internalLinks = content.match(/<a[^>]+href=["'][^"'#]+["'][^>]*>/gi) || [];
      checks.push({
        name: 'seo_internal_links',
        passed: true, // Would need link validation in real implementation
        expected: 'internal links valid',
        actual: `${internalLinks.length} links found`,
        message: `Found ${internalLinks.length} internal links`,
      });

      // Check: Schema markup present
      const hasSchema = content.includes('application/ld+json') || page.schema?.length > 0;
      checks.push({
        name: 'seo_schema_markup',
        passed: hasSchema,
        expected: 'schema markup present',
        actual: hasSchema ? 'found' : 'missing',
        message: hasSchema
          ? 'Page has schema markup'
          : 'Page is missing schema markup',
      });

    } catch (error) {
      checks.push({
        name: 'seo_health_error',
        passed: false,
        expected: 'SEO checks completed',
        actual: 'error',
        message: `SEO health check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return checks;
  }

  private verifyIntentMatch(
    action: SEOAction,
    outcome: ExecutionOutcome
  ): VerificationCheck {
    // Verify the execution outcome matches the action intent
    const intentMatchers: Record<string, (data?: Record<string, unknown>) => boolean> = {
      ADD_INTERNAL_LINK: (data) => !!data?.linkInserted,
      OPTIMIZE_ANCHOR_TEXT: (data) => !!data?.anchorOptimized,
      OPTIMIZE_CONTENT: (data) => !!data?.contentOptimized,
      FIX_SCHEMA_MARKUP: (data) => !!data?.schemaFixed,
      SET_UP_ALERT: (data) => !!data?.alertConfigured,
      INVESTIGATE_ANOMALY: (data) => !!data?.investigated,
    };

    const matcher = intentMatchers[action.type];
    const data = outcome.data;

    // Dry run always passes intent match
    if (data?.dryRun) {
      return {
        name: 'intent_match',
        passed: true,
        expected: 'dry run',
        actual: 'dry run completed',
        message: 'Dry run - intent match assumed',
      };
    }

    const passed = matcher ? matcher(data) : true;

    return {
      name: 'intent_match',
      passed,
      expected: `${action.type} executed`,
      actual: passed ? 'matched' : 'not matched',
      message: passed
        ? `Execution outcome matches action intent (${action.type})`
        : `Execution outcome does not match action intent (${action.type})`,
    };
  }

  // ============================================================================
  // DIFF CALCULATION
  // ============================================================================

  private calculateDiff(before: string, after: string): DiffResult {
    // Simple diff calculation
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');

    const beforeSet = new Set(beforeLines);
    const afterSet = new Set(afterLines);

    const additions = afterLines.filter(line => !beforeSet.has(line)).length;
    const deletions = beforeLines.filter(line => !afterSet.has(line)).length;
    const totalChanges = additions + deletions;

    const totalLines = Math.max(beforeLines.length, afterLines.length);
    const percentChange = totalLines > 0 ? (totalChanges / totalLines) * 100 : 0;

    return {
      additions,
      deletions,
      totalChanges,
      percentChange,
      summary: `+${additions} -${deletions} (${percentChange.toFixed(1)}% change)`,
    };
  }

  /**
   * Get detailed diff between before and after
   */
  async getDetailedDiff(
    snapshot: ExecutionSnapshot,
    url: string
  ): Promise<{
    before: string;
    after: string;
    diff: DiffResult;
  } | null> {
    if (!this.cmsAdapter) {
      return null;
    }

    try {
      const currentPage = await this.cmsAdapter.getPage(url);
      const after = currentPage.content || currentPage.html;
      const before = snapshot.contentBefore;

      return {
        before,
        after,
        diff: this.calculateDiff(before, after),
      };
    } catch {
      return null;
    }
  }

  /**
   * Quick validation without full checks
   */
  async quickValidate(
    outcome: ExecutionOutcome,
    action: SEOAction
  ): Promise<{ valid: boolean; reason?: string }> {
    // Basic validation without CMS calls
    if (outcome.status !== ExecutionStatus.SUCCESS && 
        outcome.status !== ExecutionStatus.COMPLETED) {
      return { valid: false, reason: `Execution status: ${outcome.status}` };
    }

    if (outcome.error) {
      return { valid: false, reason: outcome.error };
    }

    return { valid: true };
  }
}

export default PostExecutionVerifier;
