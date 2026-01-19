/**
 * Mock Dashboard Data
 * 
 * v0.7 - Realistic mock data for local development
 */

import type { DashboardData, CopilotSuggestion } from '@/types/dashboard';

// Generate daily forecast data for 90 days
function generateDailyForecast(): { date: string; predicted: number; lower: number; upper: number }[] {
  const forecasts = [];
  const baseValue = 45000;
  const trend = -0.002; // Slight declining trend
  const today = new Date();
  
  for (let i = 1; i <= 90; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    const trendFactor = 1 + trend * i;
    const noise = 0.95 + Math.random() * 0.1;
    const predicted = Math.round(baseValue * trendFactor * noise);
    const uncertainty = 0.05 + i * 0.002; // Grows with horizon
    
    forecasts.push({
      date: date.toISOString().split('T')[0],
      predicted,
      lower: Math.round(predicted * (1 - uncertainty)),
      upper: Math.round(predicted * (1 + uncertainty)),
    });
  }
  
  return forecasts;
}

export const mockDashboardData: DashboardData = {
  kpiOverview: {
    organicTraffic: {
      current: 47523,
      previous: 51280,
      change: -3757,
      changePercent: -7.3,
      trend: 'down',
      period: 'vs. last 30 days',
    },
    keywordCoverage: {
      top3: 24,
      top3Change: -2,
      top10: 156,
      top10Change: 8,
      totalTracked: 1250,
    },
    contentPerformance: {
      totalPages: 342,
      highPerforming: 48,
      needsOptimization: 67,
      newContent: 12,
    },
    healthScore: 72,
    healthScoreChange: -5,
    lastUpdated: new Date().toISOString(),
  },
  
  seoHealth: {
    overall: {
      score: 72,
      status: 'warning',
    },
    technical: {
      name: 'Technical SEO',
      status: 'healthy',
      score: 85,
      issues: 12,
      description: 'Core Web Vitals passing. 12 minor crawl issues detected.',
    },
    content: {
      name: 'Content Quality',
      status: 'warning',
      score: 68,
      issues: 67,
      description: '67 pages need content optimization. Thin content detected on 23 pages.',
    },
    authority: {
      name: 'Topical Authority',
      status: 'healthy',
      score: 78,
      issues: 8,
      description: 'Strong entity coverage. 8 topic gaps identified.',
    },
    monitoring: {
      name: 'Active Monitoring',
      status: 'warning',
      score: 65,
      issues: 3,
      description: '3 active alerts require attention. Traffic anomaly detected.',
    },
    activeAlerts: [
      {
        id: 'alert-1',
        priority: 'high',
        title: 'Organic Traffic Down 7.3%',
        description: 'Traffic has declined compared to the previous period. Likely related to ranking drops on key pages.',
        metric: 'organic_traffic',
        detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        impact: 'Estimated 3,750 fewer visits per month',
      },
      {
        id: 'alert-2',
        priority: 'medium',
        title: 'Keyword "SEO Tools" Dropped to Position 14',
        description: 'This keyword fell from position 8 to 14. Competitors have improved their content.',
        metric: 'keyword_ranking',
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        impact: 'High-volume keyword affecting ~500 monthly clicks',
      },
      {
        id: 'alert-3',
        priority: 'low',
        title: 'New Crawl Errors Detected',
        description: '12 new 404 errors found from broken internal links.',
        metric: 'technical',
        detectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        impact: 'Minor impact on crawl efficiency',
      },
    ],
  },
  
  forecast: {
    current: 47523,
    forecast30d: {
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted: 44200,
      lower: 39800,
      upper: 48600,
    },
    forecast60d: {
      date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted: 42100,
      lower: 35800,
      upper: 48400,
    },
    forecast90d: {
      date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted: 40500,
      lower: 32400,
      upper: 48600,
    },
    dailyForecast: generateDailyForecast(),
    trend: 'decreasing',
    trendStrength: 0.23,
    confidence: 0.72,
    lastUpdated: new Date().toISOString(),
  },
  
  recommendations: {
    topRecommendations: [
      {
        id: 'rec-1',
        title: 'Update Top 10 Underperforming Pages',
        description: 'Refresh content on pages that have dropped in rankings. Focus on improving depth and addressing user intent better.',
        impact: 'high',
        effort: 'medium',
        risk: 'low',
        category: 'content',
        estimatedTrafficGain: 2500,
        priority: 1,
      },
      {
        id: 'rec-2',
        title: 'Fix 404 Errors and Broken Links',
        description: 'Resolve 12 broken internal links causing crawl errors. Redirect or update link targets.',
        impact: 'medium',
        effort: 'low',
        risk: 'low',
        category: 'technical',
        estimatedTrafficGain: 300,
        priority: 2,
      },
      {
        id: 'rec-3',
        title: 'Create Content for 3 Topic Gaps',
        description: 'Missing content on related topics your competitors rank for. Creating these pages can capture additional traffic.',
        impact: 'high',
        effort: 'high',
        risk: 'low',
        category: 'content',
        estimatedTrafficGain: 1800,
        priority: 3,
      },
    ],
    totalOpportunities: 23,
    potentialTrafficGain: 8500,
    generatedAt: new Date().toISOString(),
  },
};

export const mockCopilotSuggestions: CopilotSuggestion[] = [
  { text: 'Why did traffic drop last month?', category: 'traffic' },
  { text: 'What should we prioritize this month?', category: 'general' },
  { text: 'Which keywords are declining?', category: 'ranking' },
  { text: 'How can we improve our content?', category: 'content' },
];

export const mockCopilotResponses: Record<string, string> = {
  'traffic': `**Traffic Analysis**

Your organic traffic dropped 7.3% this month. Here's what we found:

**Main Causes:**
1. **Ranking drops** on 3 key pages (accounting for ~60% of the decline)
2. **Seasonal trend** - this period typically sees lower search demand
3. **Competitor activity** - 2 competitors published updated content

**Recommended Actions:**
1. Refresh content on the declining pages
2. Review competitor content for improvement ideas
3. Monitor for further changes over the next 2 weeks`,

  'ranking': `**Keyword Performance Summary**

Your rankings show mixed results this period:

**Improving:**
- 8 keywords moved into Top 10
- Strong gains in long-tail terms

**Declining:**
- "SEO Tools" dropped from #8 to #14
- 2 other high-volume keywords fell slightly

**Why the drops?**
Competitors have published more comprehensive content. Your pages may need updating to match current search intent.

**Quick Win:** Update the top 3 declining pages with fresh data and examples.`,

  'content': `**Content Opportunities**

Based on our analysis, here are your best content opportunities:

**High Priority:**
1. **67 pages** need optimization (thin content, outdated info)
2. **3 topic gaps** where competitors rank but you don't
3. **12 pages** have high impressions but low CTR (title/meta updates needed)

**Estimated Impact:**
Addressing these could recover 2,500-4,000 monthly visits.

**Start With:** Focus on the 10 pages with highest traffic potential first.`,

  'general': `**This Month's Priorities**

Based on current data, here's what will have the biggest impact:

**🎯 Priority 1: Content Refresh**
Update your top 10 underperforming pages. These are losing rankings to fresher competitor content.
*Effort: Medium | Impact: High*

**🎯 Priority 2: Technical Fixes**
Fix 12 broken links and crawl errors. Quick win with low effort.
*Effort: Low | Impact: Medium*

**🎯 Priority 3: New Content**
Create 3 pieces targeting topic gaps. Your authority makes these likely to rank.
*Effort: High | Impact: High*

**Expected Outcome:** Following these priorities could recover 3,000-5,000 monthly visits within 60 days.`,
};
