/**
 * Unit Tests for Core Web Vitals Analyzer
 */

import { describe, it, expect } from 'vitest';
import { CWVAnalyzer } from '../src/cwv/cwv_analyzer';
import { CoreWebVitals, IssueCategory, IssueSeverity } from '../src/models';

function createMockCWV(overrides: Partial<CoreWebVitals> = {}): CoreWebVitals {
  return {
    url: 'https://example.com',
    lcp: { value: 1500, unit: 'ms', rating: 'good' },
    cls: { value: 0.05, unit: 'score', rating: 'good' },
    inp: { value: 150, unit: 'ms', rating: 'good' },
    fcp: { value: 1000, unit: 'ms', rating: 'good' },
    ttfb: { value: 500, unit: 'ms', rating: 'good' },
    si: { value: 2000, unit: 'ms', rating: 'good' },
    tbt: { value: 100, unit: 'ms', rating: 'good' },
    performanceScore: 95,
    accessibilityScore: 90,
    bestPracticesScore: 100,
    seoScore: 100,
    ...overrides,
  };
}

describe('CWVAnalyzer', () => {
  const analyzer = new CWVAnalyzer();

  it('passes good Core Web Vitals', () => {
    const cwv = createMockCWV();
    const issues = analyzer.analyze(cwv);

    expect(issues).toHaveLength(0);
  });

  it('detects poor LCP', () => {
    const cwv = createMockCWV({
      lcp: { value: 5000, unit: 'ms', rating: 'poor' },
    });
    const issues = analyzer.analyze(cwv);

    const lcpIssue = issues.find(i => i.title.includes('Largest Contentful Paint'));
    expect(lcpIssue).toBeDefined();
    expect(lcpIssue?.severity).toBe(IssueSeverity.CRITICAL);
    expect(lcpIssue?.category).toBe(IssueCategory.CORE_WEB_VITALS);
  });

  it('detects needs-improvement LCP', () => {
    const cwv = createMockCWV({
      lcp: { value: 3000, unit: 'ms', rating: 'needs-improvement' },
    });
    const issues = analyzer.analyze(cwv);

    const lcpIssue = issues.find(i => i.title.includes('Largest Contentful Paint'));
    expect(lcpIssue).toBeDefined();
    expect(lcpIssue?.severity).toBe(IssueSeverity.HIGH);
  });

  it('detects poor CLS', () => {
    const cwv = createMockCWV({
      cls: { value: 0.3, unit: 'score', rating: 'poor' },
    });
    const issues = analyzer.analyze(cwv);

    const clsIssue = issues.find(i => i.title.includes('Cumulative Layout Shift'));
    expect(clsIssue).toBeDefined();
    expect(clsIssue?.severity).toBe(IssueSeverity.HIGH);
  });

  it('detects poor INP', () => {
    const cwv = createMockCWV({
      inp: { value: 600, unit: 'ms', rating: 'poor' },
    });
    const issues = analyzer.analyze(cwv);

    const inpIssue = issues.find(i => i.title.includes('Interaction to Next Paint'));
    expect(inpIssue).toBeDefined();
    expect(inpIssue?.severity).toBe(IssueSeverity.HIGH);
  });

  it('detects low performance score', () => {
    const cwv = createMockCWV({
      performanceScore: 20,
    });
    const issues = analyzer.analyze(cwv);

    const perfIssue = issues.find(i => i.title.includes('performance score'));
    expect(perfIssue).toBeDefined();
    expect(perfIssue?.severity).toBe(IssueSeverity.CRITICAL);
  });

  it('detects poor TTFB', () => {
    const cwv = createMockCWV({
      ttfb: { value: 2000, unit: 'ms', rating: 'poor' },
    });
    const issues = analyzer.analyze(cwv);

    const ttfbIssue = issues.find(i => i.title.includes('Time to First Byte'));
    expect(ttfbIssue).toBeDefined();
  });

  it('handles missing INP gracefully', () => {
    const cwv = createMockCWV({ inp: null });
    const issues = analyzer.analyze(cwv);

    const inpIssue = issues.find(i => i.title.includes('INP'));
    expect(inpIssue).toBeUndefined();
  });

  it('provides actionable fix suggestions', () => {
    const cwv = createMockCWV({
      lcp: { value: 5000, unit: 'ms', rating: 'poor' },
    });
    const issues = analyzer.analyze(cwv);

    const lcpIssue = issues.find(i => i.title.includes('Largest Contentful Paint'));
    expect(lcpIssue).toBeDefined();
    expect(lcpIssue!.fix.steps.length).toBeGreaterThan(0);
    expect(lcpIssue!.fix.codeExamples?.length).toBeGreaterThan(0);
  });
});
