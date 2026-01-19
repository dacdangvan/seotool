/**
 * Technical SEO Audit Runner
 * Orchestrates the full audit process
 */

import { v4 as uuid } from 'uuid';
import { Logger } from './logger';
import { loadConfig, Config } from './config';
import {
  TechnicalAuditTask,
  TechnicalAuditResult,
  AuditStatus,
  CrawledPage,
  SEOIssue,
  IssueCategory,
  IssueSeverity,
  DetectorContext,
  RobotsTxtInfo,
} from './models';
import { PageCrawler, createRateLimiter, fetchRobotsTxt, RobotsChecker } from './crawler';
import {
  Detector,
  IndexingDetector,
  CanonicalDetector,
  MetaDetector,
  HeadingDetector,
  LinkDetector,
  DuplicateDetector,
} from './detectors';
import { LighthouseRunner, CWVAnalyzer } from './cwv';

export class AuditRunner {
  private readonly detectors: Detector[];
  private readonly cwvAnalyzer: CWVAnalyzer;

  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {
    // Initialize all detectors
    this.detectors = [
      new IndexingDetector(),
      new CanonicalDetector(),
      new MetaDetector(),
      new HeadingDetector(),
      new LinkDetector(),
      new DuplicateDetector(),
    ];

    this.cwvAnalyzer = new CWVAnalyzer();
  }

  /**
   * Run a full technical SEO audit
   */
  async run(task: TechnicalAuditTask): Promise<TechnicalAuditResult> {
    const startTime = Date.now();
    this.logger.info({ taskId: task.id, url: task.targetUrl }, 'Starting technical SEO audit');

    try {
      // Phase 1: Fetch robots.txt
      let robotsChecker: RobotsChecker | null = null;
      let robotsTxtStatus: 'found' | 'not_found' | 'blocked' = 'not_found';

      if (task.respectRobotsTxt) {
        robotsChecker = await fetchRobotsTxt(task.targetUrl, this.logger);
        robotsTxtStatus = robotsChecker ? 'found' : 'not_found';
      }

      // Phase 2: Crawl pages
      const rateLimiter = createRateLimiter(task.rateLimit);
      const crawler = new PageCrawler(
        {
          userAgent: this.config.defaultUserAgent,
          timeout: this.config.crawlTimeoutMs,
          maxPages: task.maxPages,
          crawlDepth: task.crawlDepth,
          renderMode: task.renderMode,
          respectRobotsTxt: task.respectRobotsTxt,
          rateLimit: rateLimiter,
          robotsChecker,
        },
        this.logger
      );

      const crawlResult = await crawler.crawl(task.targetUrl);
      this.logger.info({ 
        pagesCrawled: crawlResult.pagesCrawled, 
        errors: crawlResult.errors.length 
      }, 'Crawl completed');

      // Build robots.txt info for detectors
      const robotsTxtInfo: RobotsTxtInfo | null = robotsChecker
        ? {
            exists: true,
            content: null,
            sitemapUrls: robotsChecker.getSitemaps(),
            disallowedPaths: [],
          }
        : null;

      // Phase 3: Detect issues for each page
      const allIssues: SEOIssue[] = [];

      for (const page of crawlResult.pages) {
        const context: DetectorContext = {
          page,
          allPages: crawlResult.pages,
          robotsTxt: robotsTxtInfo,
          config: task,
        };

        for (const detector of this.detectors) {
          try {
            const result = detector.detect(context);
            allIssues.push(...result.issues);
          } catch (error) {
            this.logger.error(
              { detector: detector.name, url: page.url, error },
              'Detector failed'
            );
          }
        }
      }

      // Phase 4: Run Core Web Vitals audit (on start URL only)
      let coreWebVitals = null;
      if (task.includeCoreWebVitals) {
        const lighthouseRunner = new LighthouseRunner(
          {
            chromePath: this.config.lighthouseChromePath,
            timeout: this.config.lighthouseTimeoutMs,
          },
          this.logger
        );

        coreWebVitals = await lighthouseRunner.run(task.targetUrl);

        if (coreWebVitals) {
          const cwvIssues = this.cwvAnalyzer.analyze(coreWebVitals);
          allIssues.push(...cwvIssues);
        }
      }

      // Deduplicate issues (same issue across multiple pages)
      const deduplicatedIssues = this.deduplicateIssues(allIssues);

      // Calculate issue summary
      const issueSummary = this.calculateIssueSummary(deduplicatedIssues);

      const processingTimeMs = Date.now() - startTime;
      this.logger.info({ 
        taskId: task.id, 
        issuesFound: deduplicatedIssues.length,
        processingTimeMs 
      }, 'Audit completed');

      return {
        taskId: task.id,
        status: AuditStatus.COMPLETED,
        crawlSummary: {
          startUrl: task.targetUrl,
          pagesFound: crawlResult.pagesFound,
          pagesCrawled: crawlResult.pagesCrawled,
          crawlDurationMs: crawlResult.crawlDurationMs,
          robotsTxtStatus,
        },
        issues: deduplicatedIssues,
        issueSummary,
        coreWebVitals,
        processingTimeMs,
        metadata: {
          targetUrl: task.targetUrl,
          renderMode: task.renderMode,
          maxPages: task.maxPages,
          auditedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error({ taskId: task.id, error }, 'Audit failed');

      return {
        taskId: task.id,
        status: AuditStatus.FAILED,
        crawlSummary: {
          startUrl: task.targetUrl,
          pagesFound: 0,
          pagesCrawled: 0,
          crawlDurationMs: 0,
          robotsTxtStatus: 'not_found',
        },
        issues: [],
        issueSummary: this.createEmptyIssueSummary(),
        coreWebVitals: null,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          targetUrl: task.targetUrl,
          renderMode: task.renderMode,
          maxPages: task.maxPages,
          auditedAt: new Date().toISOString(),
        },
      };
    }
  }

  private deduplicateIssues(issues: SEOIssue[]): SEOIssue[] {
    // Group issues by title (same type of issue)
    const issueMap = new Map<string, SEOIssue>();

    for (const issue of issues) {
      const key = `${issue.category}:${issue.title}`;
      const existing = issueMap.get(key);

      if (existing) {
        // Merge affected URLs
        const allUrls = new Set([...existing.affectedUrls, ...issue.affectedUrls]);
        existing.affectedUrls = [...allUrls];
        // Keep the higher severity
        if (this.severityRank(issue.severity) > this.severityRank(existing.severity)) {
          existing.severity = issue.severity;
        }
      } else {
        issueMap.set(key, { ...issue });
      }
    }

    return [...issueMap.values()];
  }

  private severityRank(severity: IssueSeverity): number {
    const ranks = {
      [IssueSeverity.LOW]: 1,
      [IssueSeverity.MEDIUM]: 2,
      [IssueSeverity.HIGH]: 3,
      [IssueSeverity.CRITICAL]: 4,
    };
    return ranks[severity];
  }

  private calculateIssueSummary(issues: SEOIssue[]): TechnicalAuditResult['issueSummary'] {
    const byCategory: Record<IssueCategory, number> = {
      [IssueCategory.INDEXING]: 0,
      [IssueCategory.CANONICAL]: 0,
      [IssueCategory.DUPLICATE_CONTENT]: 0,
      [IssueCategory.META_TAGS]: 0,
      [IssueCategory.HEADING_STRUCTURE]: 0,
      [IssueCategory.BROKEN_LINKS]: 0,
      [IssueCategory.CORE_WEB_VITALS]: 0,
      [IssueCategory.ROBOTS]: 0,
      [IssueCategory.STRUCTURED_DATA]: 0,
    };

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const issue of issues) {
      byCategory[issue.category]++;

      switch (issue.severity) {
        case IssueSeverity.CRITICAL:
          critical++;
          break;
        case IssueSeverity.HIGH:
          high++;
          break;
        case IssueSeverity.MEDIUM:
          medium++;
          break;
        case IssueSeverity.LOW:
          low++;
          break;
      }
    }

    return {
      total: issues.length,
      critical,
      high,
      medium,
      low,
      byCategory,
    };
  }

  private createEmptyIssueSummary(): TechnicalAuditResult['issueSummary'] {
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byCategory: {
        [IssueCategory.INDEXING]: 0,
        [IssueCategory.CANONICAL]: 0,
        [IssueCategory.DUPLICATE_CONTENT]: 0,
        [IssueCategory.META_TAGS]: 0,
        [IssueCategory.HEADING_STRUCTURE]: 0,
        [IssueCategory.BROKEN_LINKS]: 0,
        [IssueCategory.CORE_WEB_VITALS]: 0,
        [IssueCategory.ROBOTS]: 0,
        [IssueCategory.STRUCTURED_DATA]: 0,
      },
    };
  }
}
