/**
 * HTML DOM Differ
 * 
 * Compares raw HTML and browser-rendered DOM to detect JavaScript-dependent
 * SEO signals. Per Section 9 of AI_SEO_TOOL_PROMPT_BOOK.md v2.2
 * 
 * Purpose: Transparency, debugging, and SEO risk governance
 */

import {
  ExtractedSeoData,
  DiffCategory,
  DiffSummary,
  DetailedDiff,
  ElementDiff,
  LinksDiff
} from './types';

export class HtmlDomDiffer {
  /**
   * Compare raw HTML extraction vs rendered DOM extraction
   * Returns a detailed diff summary
   */
  compare(rawData: ExtractedSeoData, renderedData: ExtractedSeoData): {
    summary: DiffSummary;
    detailed: DetailedDiff;
  } {
    const detailed = this.generateDetailedDiff(rawData, renderedData);
    const summary = this.generateSummary(rawData, renderedData, detailed);

    return { summary, detailed };
  }

  /**
   * Generate detailed diff with actual values
   */
  private generateDetailedDiff(
    rawData: ExtractedSeoData,
    renderedData: ExtractedSeoData
  ): DetailedDiff {
    return {
      title: this.diffStringElement(rawData.title, renderedData.title),
      metaDescription: this.diffStringElement(
        rawData.metaDescription,
        renderedData.metaDescription
      ),
      canonical: this.diffStringElement(rawData.canonical, renderedData.canonical),
      robots: this.diffStringElement(rawData.robots, renderedData.robots),
      h1: this.diffH1(rawData.h1, renderedData.h1),
      internalLinks: this.diffLinks(
        rawData.internalLinks?.length || 0,
        renderedData.internalLinks?.length || 0
      ),
      externalLinks: this.diffLinks(
        rawData.externalLinks?.length || 0,
        renderedData.externalLinks?.length || 0
      ),
      structuredData: this.diffStructuredData(rawData.jsonLd, renderedData.jsonLd)
    };
  }

  /**
   * Generate summary for quick overview
   */
  private generateSummary(
    rawData: ExtractedSeoData,
    renderedData: ExtractedSeoData,
    detailed: DetailedDiff
  ): DiffSummary {
    const rawSchemaTypes = rawData.jsonLd?.map(j => j.type) || [];
    const renderedSchemaTypes = renderedData.jsonLd?.map(j => j.type) || [];

    return {
      title: detailed.title.category,
      metaDescription: detailed.metaDescription.category,
      canonical: detailed.canonical.category,
      robots: detailed.robots.category,
      h1: detailed.h1.category,
      h1Count: {
        raw: rawData.h1?.length || 0,
        rendered: renderedData.h1?.length || 0
      },
      internalLinks: detailed.internalLinks,
      externalLinks: detailed.externalLinks,
      structuredData: detailed.structuredData.category,
      structuredDataTypes: {
        raw: rawSchemaTypes,
        rendered: renderedSchemaTypes
      },
      visibleTextLength: {
        raw: rawData.visibleTextLength || 0,
        rendered: renderedData.visibleTextLength || 0,
        difference: (renderedData.visibleTextLength || 0) - (rawData.visibleTextLength || 0)
      }
    };
  }

  /**
   * Diff a string element (title, meta description, etc.)
   */
  private diffStringElement(
    rawValue: string | null | undefined,
    renderedValue: string | null | undefined
  ): ElementDiff {
    const raw = rawValue?.trim() || null;
    const rendered = renderedValue?.trim() || null;

    let category: DiffCategory;

    if (!raw && !rendered) {
      category = 'IDENTICAL';
    } else if (!raw && rendered) {
      category = 'ADDED_BY_JS';
    } else if (raw && !rendered) {
      category = 'MISSING_IN_RENDER';
    } else if (raw === rendered) {
      category = 'IDENTICAL';
    } else {
      category = 'CHANGED_BY_JS';
    }

    return {
      category,
      rawValue: raw,
      renderedValue: rendered
    };
  }

  /**
   * Diff H1 headings
   */
  private diffH1(
    rawH1: string[] | undefined,
    renderedH1: string[] | undefined
  ): ElementDiff {
    const rawFirst = rawH1?.[0]?.trim() || null;
    const renderedFirst = renderedH1?.[0]?.trim() || null;
    const rawCount = rawH1?.length || 0;
    const renderedCount = renderedH1?.length || 0;

    let category: DiffCategory;

    if (rawCount === 0 && renderedCount === 0) {
      category = 'IDENTICAL';
    } else if (rawCount === 0 && renderedCount > 0) {
      category = 'ADDED_BY_JS';
    } else if (rawCount > 0 && renderedCount === 0) {
      category = 'MISSING_IN_RENDER';
    } else if (rawFirst === renderedFirst && rawCount === renderedCount) {
      category = 'IDENTICAL';
    } else {
      category = 'CHANGED_BY_JS';
    }

    return {
      category,
      rawValue: rawFirst,
      renderedValue: renderedFirst
    };
  }

  /**
   * Diff link counts
   */
  private diffLinks(rawCount: number, renderedCount: number): LinksDiff {
    const difference = renderedCount - rawCount;
    const percentChange = rawCount > 0 
      ? Math.round((difference / rawCount) * 100) 
      : (renderedCount > 0 ? 100 : 0);

    let category: DiffCategory;

    if (rawCount === renderedCount) {
      category = 'IDENTICAL';
    } else if (rawCount === 0 && renderedCount > 0) {
      category = 'ADDED_BY_JS';
    } else if (rawCount > 0 && renderedCount === 0) {
      category = 'MISSING_IN_RENDER';
    } else {
      category = 'CHANGED_BY_JS';
    }

    return {
      category,
      raw: rawCount,
      rendered: renderedCount,
      difference,
      percentChange
    };
  }

  /**
   * Diff structured data (JSON-LD)
   */
  private diffStructuredData(
    rawJsonLd: { type: string; raw: Record<string, unknown> }[] | undefined,
    renderedJsonLd: { type: string; raw: Record<string, unknown> }[] | undefined
  ): ElementDiff {
    const rawCount = rawJsonLd?.length || 0;
    const renderedCount = renderedJsonLd?.length || 0;
    const rawTypes = rawJsonLd?.map(j => j.type).sort().join(',') || '';
    const renderedTypes = renderedJsonLd?.map(j => j.type).sort().join(',') || '';

    let category: DiffCategory;

    if (rawCount === 0 && renderedCount === 0) {
      category = 'IDENTICAL';
    } else if (rawCount === 0 && renderedCount > 0) {
      category = 'ADDED_BY_JS';
    } else if (rawCount > 0 && renderedCount === 0) {
      category = 'MISSING_IN_RENDER';
    } else if (rawTypes === renderedTypes) {
      category = 'IDENTICAL';
    } else {
      category = 'CHANGED_BY_JS';
    }

    return {
      category,
      rawValue: rawCount > 0 ? rawTypes : null,
      renderedValue: renderedCount > 0 ? renderedTypes : null
    };
  }

  /**
   * Check if a diff category indicates JS dependency
   */
  isJsDependant(category: DiffCategory): boolean {
    return category === 'ADDED_BY_JS' || category === 'CHANGED_BY_JS';
  }

  /**
   * Get list of JS-dependent elements from summary
   */
  getJsDependentElements(summary: DiffSummary): string[] {
    const dependent: string[] = [];

    if (this.isJsDependant(summary.title)) {
      dependent.push('title');
    }
    if (this.isJsDependant(summary.metaDescription)) {
      dependent.push('meta_description');
    }
    if (this.isJsDependant(summary.canonical)) {
      dependent.push('canonical');
    }
    if (this.isJsDependant(summary.robots)) {
      dependent.push('robots');
    }
    if (this.isJsDependant(summary.h1)) {
      dependent.push('h1');
    }
    if (this.isJsDependant(summary.internalLinks.category)) {
      dependent.push('internal_links');
    }
    if (this.isJsDependant(summary.structuredData)) {
      dependent.push('structured_data');
    }

    return dependent;
  }
}

export const htmlDomDiffer = new HtmlDomDiffer();
