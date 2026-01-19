/**
 * Indexing Detector
 * Detects issues related to page indexing (noindex, robots.txt blocking)
 */

import { Detector } from './base';
import {
  DetectorContext,
  DetectorResult,
  SEOIssue,
  IssueCategory,
  IssueSeverity,
} from '../models';
import { v4 as uuid } from 'uuid';

export class IndexingDetector implements Detector {
  readonly name = 'IndexingDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, robotsTxt } = context;

    // Check for noindex in meta robots
    if (page.metaRobots) {
      const metaRobotsLower = page.metaRobots.toLowerCase();
      
      if (metaRobotsLower.includes('noindex')) {
        issues.push(this.createNoindexIssue(page.url, 'meta'));
      }
      
      if (metaRobotsLower.includes('nofollow')) {
        issues.push(this.createNofollowIssue(page.url));
      }
    }

    // Check X-Robots-Tag header (from HTML - we'd need headers in crawled data)
    // This would require extending CrawledPage to include response headers

    // Check if URL is blocked by robots.txt patterns
    if (robotsTxt) {
      for (const disallowed of robotsTxt.disallowedPaths) {
        const urlPath = new URL(page.url).pathname;
        if (urlPath.startsWith(disallowed)) {
          issues.push(this.createRobotsBlockedIssue(page.url, disallowed));
        }
      }
    }

    // Check for pages with 4xx/5xx status codes
    if (page.statusCode >= 400 && page.statusCode < 500) {
      issues.push(this.createClientErrorIssue(page.url, page.statusCode));
    } else if (page.statusCode >= 500) {
      issues.push(this.createServerErrorIssue(page.url, page.statusCode));
    }

    return { issues };
  }

  private createNoindexIssue(url: string, source: 'meta' | 'header'): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.INDEXING,
      severity: IssueSeverity.CRITICAL,
      title: 'Page has noindex directive',
      description: `The page contains a noindex directive in its ${source === 'meta' ? 'meta robots tag' : 'X-Robots-Tag header'}, preventing search engines from indexing it.`,
      affectedUrls: [url],
      details: { source },
      impact: {
        summary: 'This page will not appear in search results.',
        seoEffect: 'The page is completely excluded from search engine indexes, meaning it cannot rank for any keywords.',
        userEffect: 'Users cannot find this page through organic search.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Remove the noindex directive if the page should be indexed.',
        steps: [
          'Verify if this is intentional (e.g., thank you pages, internal tools)',
          'If unintentional, remove the noindex from the meta robots tag or X-Robots-Tag header',
          'Use Google Search Console to request re-indexing',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Remove noindex from meta tag',
            code: '<!-- Change from: -->\n<meta name="robots" content="noindex, nofollow">\n\n<!-- To: -->\n<meta name="robots" content="index, follow">',
          },
        ],
      },
    };
  }

  private createNofollowIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.INDEXING,
      severity: IssueSeverity.MEDIUM,
      title: 'Page has nofollow directive',
      description: 'The page contains a nofollow directive in its meta robots tag, preventing search engines from following links on this page.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Links on this page will not pass PageRank to linked pages.',
        seoEffect: 'Internal linking value is not being distributed. External links are also blocked from passing authority.',
        userEffect: 'No direct user impact.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Remove the nofollow directive unless intentionally blocking link equity.',
        steps: [
          'Determine if nofollow is intentional (e.g., user-generated content pages)',
          'If unintentional, change to "index, follow" or remove the meta robots tag entirely',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Allow link following',
            code: '<meta name="robots" content="index, follow">',
          },
        ],
      },
    };
  }

  private createRobotsBlockedIssue(url: string, pattern: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.ROBOTS,
      severity: IssueSeverity.CRITICAL,
      title: 'Page blocked by robots.txt',
      description: `The page is blocked from crawling by a robots.txt disallow rule matching pattern: ${pattern}`,
      affectedUrls: [url],
      details: { pattern },
      impact: {
        summary: 'Search engines cannot crawl this page.',
        seoEffect: 'The page cannot be indexed because crawlers are blocked from accessing it.',
        userEffect: 'Users cannot find this page through organic search.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Update robots.txt to allow crawling of this page.',
        steps: [
          'Review your robots.txt file',
          'Remove or modify the Disallow rule that blocks this URL',
          'Test changes using Google Search Console robots.txt tester',
        ],
        codeExamples: [
          {
            language: 'htaccess',
            label: 'robots.txt - Allow specific path',
            code: 'User-agent: *\nAllow: /important-page/\nDisallow: /private/',
          },
        ],
      },
    };
  }

  private createClientErrorIssue(url: string, statusCode: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: statusCode === 404 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      title: `Page returns ${statusCode} error`,
      description: `The page returns a ${statusCode} client error status code.`,
      affectedUrls: [url],
      details: { statusCode },
      impact: {
        summary: 'This page cannot be indexed and wastes crawl budget.',
        seoEffect: `A ${statusCode} error tells search engines this page is broken. If linked internally, it wastes crawl budget and may impact site quality signals.`,
        userEffect: 'Users encounter a broken page, leading to poor experience and potential bounce.',
        ranking: 'direct',
      },
      fix: {
        summary: statusCode === 404 
          ? 'Either restore the page content or implement a 301 redirect to a relevant page.'
          : 'Fix the underlying cause of the error.',
        steps: [
          'Identify if this URL should exist',
          statusCode === 404 ? 'If intentionally removed, set up a 301 redirect to a relevant page' : 'Check server logs for error details',
          'Remove internal links pointing to this URL',
          'Submit updated sitemap to search engines',
        ],
      },
    };
  }

  private createServerErrorIssue(url: string, statusCode: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: IssueSeverity.CRITICAL,
      title: `Page returns ${statusCode} server error`,
      description: `The page returns a ${statusCode} server error status code, indicating a server-side problem.`,
      affectedUrls: [url],
      details: { statusCode },
      impact: {
        summary: 'Server errors prevent indexing and severely impact crawlability.',
        seoEffect: 'Repeated server errors signal to search engines that the site is unreliable, potentially impacting rankings site-wide.',
        userEffect: 'Users cannot access the page and may lose trust in the site.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Investigate and fix the server-side error immediately.',
        steps: [
          'Check server logs for detailed error information',
          'Identify the root cause (database issues, memory limits, code errors)',
          'Fix the underlying issue and verify the page loads correctly',
          'Monitor server health to prevent recurrence',
        ],
      },
    };
  }
}
