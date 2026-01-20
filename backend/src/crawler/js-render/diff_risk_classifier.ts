/**
 * Diff Risk Classifier
 * 
 * Classifies JS Dependency Risk based on diff results.
 * Per Section 9.4 of AI_SEO_TOOL_PROMPT_BOOK.md v2.2
 * 
 * Risk Levels:
 * - LOW: Minor or no SEO elements differ
 * - MEDIUM: Titles or internal links differ
 * - HIGH: Title, H1, canonical, or indexability differ
 */

import {
  DiffSummary,
  DetailedDiff,
  DiffReport,
  JsDependencyRisk,
  RenderMode
} from './types';
import { HtmlDomDiffer, htmlDomDiffer } from './html_dom_differ';

/**
 * Risk factors that contribute to HIGH risk
 */
const HIGH_RISK_ELEMENTS = ['title', 'h1', 'canonical', 'robots'];

/**
 * Risk factors that contribute to MEDIUM risk
 */
const MEDIUM_RISK_ELEMENTS = ['meta_description', 'internal_links'];

export class DiffRiskClassifier {
  private differ: HtmlDomDiffer;

  constructor(differ?: HtmlDomDiffer) {
    this.differ = differ || htmlDomDiffer;
  }

  /**
   * Generate a complete diff report for a URL
   */
  generateDiffReport(
    url: string,
    renderMode: RenderMode,
    summary: DiffSummary,
    detailed: DetailedDiff
  ): DiffReport {
    const jsDependentElements = this.differ.getJsDependentElements(summary);
    const { risk, factors } = this.classifyRisk(summary, jsDependentElements);

    return {
      url,
      renderMode,
      diffSummary: summary,
      detailedDiff: detailed,
      jsDependencyRisk: risk,
      riskFactors: factors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Classify JS Dependency Risk based on diff summary
   * 
   * Per Section 9.4:
   * - LOW: Minor or no SEO elements differ
   * - MEDIUM: Titles or internal links differ
   * - HIGH: Title, H1, canonical, or indexability differ
   */
  classifyRisk(
    summary: DiffSummary,
    jsDependentElements: string[]
  ): { risk: JsDependencyRisk; factors: string[] } {
    const factors: string[] = [];
    let hasHighRisk = false;
    let hasMediumRisk = false;

    // Check each JS-dependent element
    for (const element of jsDependentElements) {
      if (HIGH_RISK_ELEMENTS.includes(element)) {
        hasHighRisk = true;
        factors.push(this.formatRiskFactor(element, 'HIGH'));
      } else if (MEDIUM_RISK_ELEMENTS.includes(element)) {
        hasMediumRisk = true;
        factors.push(this.formatRiskFactor(element, 'MEDIUM'));
      } else {
        factors.push(this.formatRiskFactor(element, 'LOW'));
      }
    }

    // Check internal links change magnitude
    if (summary.internalLinks.percentChange > 50) {
      hasMediumRisk = true;
      factors.push(`Internal links increased by ${summary.internalLinks.percentChange}% via JS`);
    }

    // Check if structured data is entirely JS-generated
    if (summary.structuredDataTypes.raw.length === 0 && 
        summary.structuredDataTypes.rendered.length > 0) {
      hasMediumRisk = true;
      factors.push('Structured data entirely JS-generated');
    }

    // Determine final risk level
    let risk: JsDependencyRisk;
    if (hasHighRisk) {
      risk = 'HIGH';
    } else if (hasMediumRisk) {
      risk = 'MEDIUM';
    } else {
      risk = 'LOW';
    }

    return { risk, factors };
  }

  /**
   * Format a risk factor message
   */
  private formatRiskFactor(element: string, level: string): string {
    const elementNames: Record<string, string> = {
      title: 'Page title',
      meta_description: 'Meta description',
      canonical: 'Canonical URL',
      robots: 'Robots meta tag',
      h1: 'H1 heading',
      internal_links: 'Internal links',
      structured_data: 'Structured data (JSON-LD)'
    };

    const name = elementNames[element] || element;
    return `${name} is JS-dependent (${level} risk)`;
  }

  /**
   * Check if a page should be flagged for review
   * based on its JS dependency risk
   */
  shouldFlagForReview(risk: JsDependencyRisk): boolean {
    return risk === 'HIGH';
  }

  /**
   * Get risk color for UI display
   */
  getRiskColor(risk: JsDependencyRisk): { bg: string; text: string; border: string } {
    switch (risk) {
      case 'HIGH':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
      case 'MEDIUM':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
      case 'LOW':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    }
  }

  /**
   * Get risk icon name for UI display
   */
  getRiskIcon(risk: JsDependencyRisk): string {
    switch (risk) {
      case 'HIGH':
        return 'AlertTriangle';
      case 'MEDIUM':
        return 'AlertCircle';
      case 'LOW':
        return 'CheckCircle';
    }
  }

  /**
   * Generate human-readable risk explanation
   */
  explainRisk(report: DiffReport): string {
    const { jsDependencyRisk, riskFactors } = report;

    if (jsDependencyRisk === 'LOW') {
      return 'This page has low JavaScript dependency for SEO elements. Google should index it correctly from raw HTML.';
    }

    if (jsDependencyRisk === 'MEDIUM') {
      return `This page has moderate JavaScript dependency. Some SEO elements are generated via JS:\n\n${riskFactors.map(f => `• ${f}`).join('\n')}\n\nGoogle may need to render the page to see these elements.`;
    }

    return `⚠️ HIGH RISK: Critical SEO elements depend on JavaScript:\n\n${riskFactors.map(f => `• ${f}`).join('\n')}\n\nGoogle may not index this page correctly if JavaScript fails. Consider server-side rendering for these elements.`;
  }
}

export const diffRiskClassifier = new DiffRiskClassifier();
