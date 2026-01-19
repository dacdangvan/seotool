/**
 * Meta Tags Detector
 * Detects issues with meta title and description
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

// SEO best practice limits
const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const TITLE_PIXEL_WIDTH_APPROX = 580; // Approximate pixel width for Google SERPs

const DESCRIPTION_MIN_LENGTH = 70;
const DESCRIPTION_MAX_LENGTH = 160;

export class MetaDetector implements Detector {
  readonly name = 'MetaDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, allPages } = context;

    // =========================================================================
    // TITLE CHECKS
    // =========================================================================

    if (!page.title) {
      issues.push(this.createMissingTitleIssue(page.url));
    } else {
      const titleLength = page.title.length;

      if (titleLength < TITLE_MIN_LENGTH) {
        issues.push(this.createShortTitleIssue(page.url, page.title, titleLength));
      } else if (titleLength > TITLE_MAX_LENGTH) {
        issues.push(this.createLongTitleIssue(page.url, page.title, titleLength));
      }

      // Check for duplicate titles across pages
      const pagesWithSameTitle = allPages.filter(
        p => p.url !== page.url && p.title === page.title
      );
      if (pagesWithSameTitle.length > 0) {
        issues.push(this.createDuplicateTitleIssue(page.url, page.title, pagesWithSameTitle.map(p => p.url)));
      }
    }

    // =========================================================================
    // DESCRIPTION CHECKS
    // =========================================================================

    if (!page.metaDescription) {
      issues.push(this.createMissingDescriptionIssue(page.url));
    } else {
      const descLength = page.metaDescription.length;

      if (descLength < DESCRIPTION_MIN_LENGTH) {
        issues.push(this.createShortDescriptionIssue(page.url, page.metaDescription, descLength));
      } else if (descLength > DESCRIPTION_MAX_LENGTH) {
        issues.push(this.createLongDescriptionIssue(page.url, page.metaDescription, descLength));
      }

      // Check for duplicate descriptions
      const pagesWithSameDesc = allPages.filter(
        p => p.url !== page.url && p.metaDescription === page.metaDescription
      );
      if (pagesWithSameDesc.length > 0) {
        issues.push(this.createDuplicateDescriptionIssue(page.url, page.metaDescription, pagesWithSameDesc.map(p => p.url)));
      }
    }

    return { issues };
  }

  // ===========================================================================
  // TITLE ISSUES
  // ===========================================================================

  private createMissingTitleIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.CRITICAL,
      title: 'Missing page title',
      description: 'The page does not have a <title> tag.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Pages without titles cannot rank effectively and display poorly in search results.',
        seoEffect: 'The title tag is one of the most important on-page SEO factors. Without it, Google may generate its own title which may not be optimal.',
        userEffect: 'The page will show a generic or URL-based title in browser tabs and bookmarks.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Add a unique, descriptive title tag.',
        steps: [
          'Add a <title> tag in the <head> section',
          'Make it 30-60 characters',
          'Include the primary keyword near the beginning',
          'Make it compelling for users to click',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Add title tag',
            code: '<head>\n  <title>Your Page Title - Brand Name</title>\n</head>',
          },
        ],
      },
    };
  }

  private createShortTitleIssue(url: string, title: string, length: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.LOW,
      title: 'Title too short',
      description: `The page title is only ${length} characters. Recommended: ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} characters.`,
      affectedUrls: [url],
      details: { title, length },
      impact: {
        summary: 'Short titles may not fully convey the page topic and miss keyword opportunities.',
        seoEffect: 'You may be missing opportunities to include relevant keywords and attract more clicks.',
        userEffect: 'Users may not understand what the page is about from search results.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Expand the title to be more descriptive.',
        steps: [
          'Add relevant keywords or phrases',
          'Include your brand name if space allows',
          `Aim for ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} characters`,
        ],
      },
    };
  }

  private createLongTitleIssue(url: string, title: string, length: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.LOW,
      title: 'Title too long',
      description: `The page title is ${length} characters and will be truncated in search results. Maximum: ${TITLE_MAX_LENGTH} characters.`,
      affectedUrls: [url],
      details: { title, length, truncatedPreview: title.substring(0, TITLE_MAX_LENGTH) + '...' },
      impact: {
        summary: 'Long titles get cut off in search results, potentially hiding important information.',
        seoEffect: 'While Google considers the full title for ranking, the visible portion affects click-through rate.',
        userEffect: 'Users see an incomplete title ending with "..." in search results.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Shorten the title while keeping it descriptive.',
        steps: [
          `Keep the title under ${TITLE_MAX_LENGTH} characters`,
          'Put the most important keywords and information first',
          'Consider moving brand name to the end or removing it if needed',
        ],
      },
    };
  }

  private createDuplicateTitleIssue(url: string, title: string, duplicateUrls: string[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.MEDIUM,
      title: 'Duplicate page title',
      description: `This title is shared with ${duplicateUrls.length} other page(s).`,
      affectedUrls: [url, ...duplicateUrls],
      details: { title },
      impact: {
        summary: 'Duplicate titles make it harder for search engines to understand which page to rank.',
        seoEffect: 'Pages compete against each other, potentially diluting rankings. Search engines prefer unique titles.',
        userEffect: 'Users can\'t distinguish between pages in search results or browser tabs.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Create unique titles for each page.',
        steps: [
          'Identify the unique value proposition of each page',
          'Write distinct titles that reflect each page\'s specific content',
          'Use different keywords based on each page\'s focus',
        ],
      },
    };
  }

  // ===========================================================================
  // DESCRIPTION ISSUES
  // ===========================================================================

  private createMissingDescriptionIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.MEDIUM,
      title: 'Missing meta description',
      description: 'The page does not have a meta description.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Without a meta description, Google will generate one from page content.',
        seoEffect: 'While meta descriptions don\'t directly impact rankings, they affect click-through rate. Auto-generated snippets may not be optimal.',
        userEffect: 'Users may see a less compelling snippet in search results.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Add a compelling meta description.',
        steps: [
          'Add a meta description tag in the <head> section',
          `Keep it between ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH} characters`,
          'Include a call-to-action and relevant keywords',
          'Make it unique and descriptive of the page content',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Add meta description',
            code: '<head>\n  <meta name="description" content="Your compelling page description that encourages users to click through from search results.">\n</head>',
          },
        ],
      },
    };
  }

  private createShortDescriptionIssue(url: string, description: string, length: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.LOW,
      title: 'Meta description too short',
      description: `The meta description is only ${length} characters. Recommended: ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH} characters.`,
      affectedUrls: [url],
      details: { description, length },
      impact: {
        summary: 'Short descriptions may not provide enough context to attract clicks.',
        seoEffect: 'You\'re missing an opportunity to include relevant keywords and compelling copy.',
        userEffect: 'Users see less information to help them decide whether to click.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Expand the description with more context.',
        steps: [
          'Add more details about the page content',
          'Include relevant keywords naturally',
          'Add a call-to-action',
          `Aim for ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH} characters`,
        ],
      },
    };
  }

  private createLongDescriptionIssue(url: string, description: string, length: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.LOW,
      title: 'Meta description too long',
      description: `The meta description is ${length} characters and will be truncated. Maximum: ${DESCRIPTION_MAX_LENGTH} characters.`,
      affectedUrls: [url],
      details: { description, length, truncatedPreview: description.substring(0, DESCRIPTION_MAX_LENGTH) + '...' },
      impact: {
        summary: 'Long descriptions get cut off in search results.',
        seoEffect: 'The most important information or call-to-action may be hidden.',
        userEffect: 'Users see an incomplete description.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Shorten the description while keeping it compelling.',
        steps: [
          `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters`,
          'Put the most important information first',
          'End with a complete sentence or thought',
        ],
      },
    };
  }

  private createDuplicateDescriptionIssue(url: string, description: string, duplicateUrls: string[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.META_TAGS,
      severity: IssueSeverity.MEDIUM,
      title: 'Duplicate meta description',
      description: `This description is shared with ${duplicateUrls.length} other page(s).`,
      affectedUrls: [url, ...duplicateUrls],
      details: { description },
      impact: {
        summary: 'Duplicate descriptions reduce the uniqueness signal for each page.',
        seoEffect: 'Each page should have a unique description that accurately represents its specific content.',
        userEffect: 'Users can\'t distinguish between pages in search results.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Create unique descriptions for each page.',
        steps: [
          'Review each page\'s content and purpose',
          'Write distinct descriptions that highlight unique value',
          'Use different calls-to-action as appropriate',
        ],
      },
    };
  }
}
