/**
 * Executive Dashboard Mock Data v1.8
 * 
 * Realistic mock data for Board-level SEO Dashboard demo.
 * All language is business-oriented and non-technical.
 */

import type {
  ExecutiveDashboardData,
  ProjectClassification,
  RiskLevel,
} from '@/types/executive';

// =============================================================================
// MOCK DATA GENERATOR
// =============================================================================

export function generateExecutiveMockData(): ExecutiveDashboardData {
  const now = new Date();
  const periodEnd = now.toISOString();
  const periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  
  return {
    // -------------------------------------------------------------------------
    // EXECUTIVE OVERVIEW
    // -------------------------------------------------------------------------
    overview: {
      totalInvestment: {
        current: 485000,
        previousPeriod: 420000,
        changePercent: 15.5,
        unit: 'relative units',
      },
      portfolioROI: {
        current: 3.2,
        previousPeriod: 2.8,
        changePercent: 14.3,
        industryBenchmark: 2.5,
      },
      yoyTrend: {
        trafficGrowth: 42.5,
        revenueContribution: 28.3,
        costEfficiency: 18.2,
      },
      qoqTrend: {
        trafficGrowth: 12.8,
        revenueContribution: 8.5,
        costEfficiency: 5.2,
      },
      confidenceScore: 78,
      confidenceLevel: 'moderate',
      confidenceFactors: [
        'Strong historical data quality',
        'Stable market conditions',
        'Consistent execution track record',
      ],
      periodStart,
      periodEnd,
      lastUpdated: now.toISOString(),
    },
    
    // -------------------------------------------------------------------------
    // PORTFOLIO PERFORMANCE
    // -------------------------------------------------------------------------
    portfolio: {
      classificationSummary: [
        {
          classification: 'growth_driver',
          label: 'Growth Drivers',
          projectCount: 2,
          totalAllocation: 45,
          averageROI: 4.2,
          color: '#10B981', // green
        },
        {
          classification: 'stable_contributor',
          label: 'Stable Contributors',
          projectCount: 3,
          totalAllocation: 35,
          averageROI: 2.8,
          color: '#3B82F6', // blue
        },
        {
          classification: 'cautious_optimize',
          label: 'Cautious Optimization',
          projectCount: 1,
          totalAllocation: 12,
          averageROI: 1.5,
          color: '#F59E0B', // amber
        },
        {
          classification: 'under_observation',
          label: 'Under Observation',
          projectCount: 1,
          totalAllocation: 5,
          averageROI: 0.8,
          color: '#6B7280', // gray
        },
        {
          classification: 'turnaround',
          label: 'Turnaround Candidates',
          projectCount: 1,
          totalAllocation: 3,
          averageROI: 0.4,
          color: '#8B5CF6', // purple
        },
      ],
      projects: [
        {
          projectId: 'alpha',
          projectName: 'Alpha E-commerce',
          domain: 'alpha-shop.com',
          classification: 'growth_driver',
          classificationConfidence: 92,
          performanceScore: 88,
          roiScore: 92,
          riskScore: 25,
          growthScore: 85,
          allocationPercent: 28,
          allocationChange: 5,
          executiveSummary: 'Top performer with consistent growth. Recommended for continued investment.',
          trafficTrend: [100, 105, 108, 112, 118, 122, 128, 135, 142, 148, 152, 158],
        },
        {
          projectId: 'beta',
          projectName: 'Beta Blog Network',
          domain: 'beta-blog.com',
          classification: 'stable_contributor',
          classificationConfidence: 85,
          performanceScore: 72,
          roiScore: 75,
          riskScore: 28,
          growthScore: 62,
          allocationPercent: 18,
          allocationChange: -2,
          executiveSummary: 'Reliable performer with steady returns. Maintain current investment level.',
          trafficTrend: [100, 101, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105],
        },
        {
          projectId: 'gamma',
          projectName: 'Gamma Finance',
          domain: 'gamma-finance.com',
          classification: 'cautious_optimize',
          classificationConfidence: 78,
          performanceScore: 58,
          roiScore: 62,
          riskScore: 55,
          growthScore: 48,
          allocationPercent: 12,
          allocationChange: -3,
          executiveSummary: 'Elevated risk profile requires careful optimization. Monitor closely.',
          trafficTrend: [100, 98, 102, 95, 98, 92, 96, 94, 98, 95, 97, 96],
        },
        {
          projectId: 'delta',
          projectName: 'Delta Services',
          domain: 'delta-services.com',
          classification: 'under_observation',
          classificationConfidence: 72,
          performanceScore: 42,
          roiScore: 38,
          riskScore: 35,
          growthScore: 28,
          allocationPercent: 5,
          allocationChange: -4,
          executiveSummary: 'Underperforming. Reduce exposure while evaluating strategic options.',
          trafficTrend: [100, 95, 92, 88, 85, 82, 80, 78, 76, 74, 72, 70],
        },
        {
          projectId: 'epsilon',
          projectName: 'Epsilon Tech Hub',
          domain: 'epsilon-tech.com',
          classification: 'turnaround',
          classificationConfidence: 68,
          performanceScore: 35,
          roiScore: 28,
          riskScore: 48,
          growthScore: 72,
          allocationPercent: 3,
          allocationChange: 0,
          executiveSummary: 'High market potential but poor execution. Consider turnaround investment.',
          trafficTrend: [100, 92, 85, 78, 72, 68, 65, 68, 72, 78, 82, 85],
        },
        {
          projectId: 'zeta',
          projectName: 'Zeta Marketplace',
          domain: 'zeta-market.com',
          classification: 'growth_driver',
          classificationConfidence: 88,
          performanceScore: 82,
          roiScore: 85,
          riskScore: 22,
          growthScore: 88,
          allocationPercent: 17,
          allocationChange: 4,
          executiveSummary: 'Strong growth trajectory. Increase investment to capture market opportunity.',
          trafficTrend: [100, 108, 115, 122, 130, 138, 145, 152, 160, 168, 175, 182],
        },
        {
          projectId: 'eta',
          projectName: 'Eta Content Platform',
          domain: 'eta-content.com',
          classification: 'stable_contributor',
          classificationConfidence: 82,
          performanceScore: 68,
          roiScore: 70,
          riskScore: 30,
          growthScore: 55,
          allocationPercent: 10,
          allocationChange: 0,
          executiveSummary: 'Consistent performer. Current allocation appropriate.',
          trafficTrend: [100, 102, 104, 103, 105, 106, 108, 107, 109, 110, 112, 111],
        },
        {
          projectId: 'theta',
          projectName: 'Theta B2B Solutions',
          domain: 'theta-b2b.com',
          classification: 'stable_contributor',
          classificationConfidence: 80,
          performanceScore: 65,
          roiScore: 68,
          riskScore: 32,
          growthScore: 52,
          allocationPercent: 7,
          allocationChange: 0,
          executiveSummary: 'Solid B2B performer with stable client base.',
          trafficTrend: [100, 101, 102, 103, 102, 104, 105, 104, 106, 105, 107, 106],
        },
      ],
      totalProjects: 8,
      totalAllocationUsed: 100,
      diversificationScore: 72,
      concentrationRisk: 28,
    },
    
    // -------------------------------------------------------------------------
    // RISK & GOVERNANCE
    // -------------------------------------------------------------------------
    risk: {
      overallRiskScore: 32,
      overallRiskLevel: 'moderate',
      riskExposures: [
        {
          category: 'algorithm_dependency',
          label: 'Search Algorithm Changes',
          level: 'moderate',
          score: 38,
          trend: 'stable',
          description: 'Moderate dependency on search engine ranking algorithms.',
          mitigationStatus: 'Diversification strategy in place',
        },
        {
          category: 'content_risk',
          label: 'Content Quality & Compliance',
          level: 'low',
          score: 22,
          trend: 'improving',
          description: 'Content quality controls are effective.',
          mitigationStatus: 'AI guardrails active',
        },
        {
          category: 'brand_risk',
          label: 'Brand Consistency',
          level: 'low',
          score: 18,
          trend: 'stable',
          description: 'Brand voice maintained across all properties.',
          mitigationStatus: 'Brand guardrail v1.4 active',
        },
        {
          category: 'technical_risk',
          label: 'Technical Infrastructure',
          level: 'moderate',
          score: 35,
          trend: 'stable',
          description: 'Some technical debt in older properties.',
          mitigationStatus: 'Remediation plan in progress',
        },
        {
          category: 'competitive_risk',
          label: 'Market Competition',
          level: 'elevated',
          score: 45,
          trend: 'degrading',
          description: 'Increased competitive pressure in key markets.',
          mitigationStatus: 'Competitive monitoring enhanced',
        },
      ],
      guardrails: [
        {
          name: 'Brand Compliance',
          status: 'active',
          compliance: 94,
          lastChecked: new Date().toISOString(),
          description: 'All content passes brand voice checks.',
        },
        {
          name: 'Auto-Execution Limits',
          status: 'active',
          compliance: 100,
          lastChecked: new Date().toISOString(),
          description: 'Only low-risk actions auto-executed.',
        },
        {
          name: 'Risk Threshold',
          status: 'active',
          compliance: 88,
          lastChecked: new Date().toISOString(),
          description: 'No high-risk actions executed without approval.',
        },
        {
          name: 'Budget Controls',
          status: 'active',
          compliance: 96,
          lastChecked: new Date().toISOString(),
          description: 'All spending within allocated budgets.',
        },
      ],
      systemicRisks: [
        {
          id: 'sr-1',
          severity: 'medium',
          title: 'Competitive Market Pressure',
          description: 'Two major competitors have increased their digital marketing spend by 40% in Q4.',
          affectedProjects: 3,
          potentialImpact: 'Could reduce market share by 5-8% over next 2 quarters if unaddressed.',
          recommendedAction: 'Consider accelerating growth investments in Alpha and Zeta properties.',
        },
      ],
      riskTrend: [
        { week: 'W1', score: 35 },
        { week: 'W2', score: 34 },
        { week: 'W3', score: 36 },
        { week: 'W4', score: 33 },
        { week: 'W5', score: 32 },
        { week: 'W6', score: 34 },
        { week: 'W7', score: 31 },
        { week: 'W8', score: 30 },
        { week: 'W9', score: 32 },
        { week: 'W10', score: 31 },
        { week: 'W11', score: 33 },
        { week: 'W12', score: 32 },
      ],
    },
    
    // -------------------------------------------------------------------------
    // SCENARIO ANALYSIS
    // -------------------------------------------------------------------------
    scenarios: {
      baseline: {
        roi: 3.2,
        risk: 32,
        confidence: 78,
      },
      scenarios: [
        {
          id: 'increase-budget-20',
          name: 'Increase Investment 20%',
          description: 'Allocate additional 20% budget to high-performing growth drivers.',
          type: 'budget_increase',
          projectedROI: 3.8,
          roiChange: 18.75,
          projectedRisk: 35,
          riskDelta: 3,
          confidenceRange: { low: 3.4, mid: 3.8, high: 4.2 },
          tradeoffs: [
            'Higher capital commitment',
            'Slight increase in overall risk',
            'Reduced flexibility for new opportunities',
          ],
          recommendation: 'recommended',
          rationale: 'Strong market opportunity and proven performance justify increased investment.',
        },
        {
          id: 'reduce-automation',
          name: 'Reduce Automation Level',
          description: 'Increase human oversight by reducing auto-execution to 50%.',
          type: 'reduce_automation',
          projectedROI: 2.9,
          roiChange: -9.4,
          projectedRisk: 25,
          riskDelta: -7,
          confidenceRange: { low: 2.6, mid: 2.9, high: 3.1 },
          tradeoffs: [
            'Lower risk exposure',
            'Reduced operational efficiency',
            'Higher human resource costs',
          ],
          recommendation: 'neutral',
          rationale: 'Consider if risk tolerance has decreased or after any significant incidents.',
        },
        {
          id: 'pause-risky',
          name: 'Pause Risky Projects',
          description: 'Pause investment in projects with elevated risk profiles.',
          type: 'pause_risky',
          projectedROI: 2.8,
          roiChange: -12.5,
          projectedRisk: 22,
          riskDelta: -10,
          confidenceRange: { low: 2.5, mid: 2.8, high: 3.0 },
          tradeoffs: [
            'Significant risk reduction',
            'Lost growth potential in turnaround candidates',
            'May impact portfolio diversification',
          ],
          recommendation: 'not_recommended',
          rationale: 'Current risk levels are manageable. Pausing would sacrifice growth unnecessarily.',
        },
        {
          id: 'aggressive-growth',
          name: 'Aggressive Growth Strategy',
          description: 'Maximize allocation to growth drivers, accept higher risk.',
          type: 'aggressive_growth',
          projectedROI: 4.5,
          roiChange: 40.6,
          projectedRisk: 48,
          riskDelta: 16,
          confidenceRange: { low: 3.8, mid: 4.5, high: 5.2 },
          tradeoffs: [
            'Highest potential returns',
            'Significantly elevated risk',
            'Reduced portfolio stability',
          ],
          recommendation: 'neutral',
          rationale: 'High reward potential but requires board appetite for elevated risk.',
        },
      ],
      recommendedScenario: 'increase-budget-20',
      recommendationRationale: 'Market conditions favor growth investment. Strong performers can absorb additional capital effectively.',
    },
    
    // -------------------------------------------------------------------------
    // AUTOMATION TRANSPARENCY
    // -------------------------------------------------------------------------
    automation: {
      aiWorkPercent: 68,
      humanWorkPercent: 32,
      taskBreakdown: [
        { taskType: 'Content Optimization', aiPercent: 75, humanPercent: 25, totalTasks: 245 },
        { taskType: 'Technical Analysis', aiPercent: 85, humanPercent: 15, totalTasks: 128 },
        { taskType: 'Strategic Planning', aiPercent: 40, humanPercent: 60, totalTasks: 34 },
        { taskType: 'Risk Assessment', aiPercent: 70, humanPercent: 30, totalTasks: 89 },
        { taskType: 'Performance Monitoring', aiPercent: 90, humanPercent: 10, totalTasks: 412 },
      ],
      autoExecuted: {
        total: 1247,
        successful: 1235,
        rolledBack: 12,
        period: 'Last 90 days',
      },
      trustScore: 94,
      controlIndicators: [
        {
          name: 'Human Approval Gate',
          status: 'enabled',
          description: 'Medium and high-risk actions require human approval.',
        },
        {
          name: 'Rollback Capability',
          status: 'enabled',
          description: 'All automated changes can be reversed within 4 hours.',
        },
        {
          name: 'Spending Limits',
          status: 'enabled',
          description: 'AI cannot exceed allocated resource budgets.',
        },
        {
          name: 'Brand Guardrails',
          status: 'enabled',
          description: 'Content must pass brand compliance checks.',
        },
      ],
      rollbackIncidents: [
        {
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Content tone deviation detected post-publish',
          impact: 'Minor - 3 pages affected',
          resolved: true,
        },
        {
          date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Unexpected traffic drop after meta description change',
          impact: 'Moderate - 1 project affected for 2 days',
          resolved: true,
        },
      ],
    },
    
    // -------------------------------------------------------------------------
    // EXECUTIVE SUMMARY
    // -------------------------------------------------------------------------
    summary: {
      narrativeSummary: `**Digital Marketing Performance Summary**

Our digital marketing portfolio delivered strong results this quarter, achieving a **3.2x return on investment** — exceeding both our target of 2.8x and the industry benchmark of 2.5x.

**Key Highlights:**
- Total organic traffic grew 42.5% year-over-year, contributing an estimated $2.8M in equivalent media value
- Our two growth driver properties (Alpha E-commerce and Zeta Marketplace) now account for 45% of portfolio allocation and are delivering 4.2x ROI
- Risk profile remains moderate at 32/100, with all major guardrails operating within acceptable parameters

**Strategic Position:**
The portfolio is well-positioned for continued growth. Our diversification score of 72/100 indicates healthy spread across property types, while concentration risk remains manageable at 28/100.

**Attention Items:**
Competitive pressure has increased, with two major competitors expanding their digital presence. We recommend considering the "Increase Investment 20%" scenario to maintain market position.

**Automation Performance:**
AI-assisted operations processed 1,247 actions this quarter with a 99% success rate. Only 12 actions required rollback, all resolved within SLA. Human oversight remains strong for strategic decisions (60% human-led).`,

      keyInsights: [
        {
          id: 'ki-1',
          category: 'achievement',
          title: 'ROI Exceeds Industry Benchmark',
          description: 'Portfolio ROI of 3.2x is 28% above the industry average of 2.5x.',
          impact: 'high',
          actionable: false,
        },
        {
          id: 'ki-2',
          category: 'opportunity',
          title: 'Growth Driver Momentum',
          description: 'Alpha and Zeta properties show sustained growth trajectory. Additional investment could accelerate returns.',
          impact: 'high',
          actionable: true,
        },
        {
          id: 'ki-3',
          category: 'attention',
          title: 'Competitive Pressure Increasing',
          description: 'Major competitors have increased digital marketing spend by 40%. Market share defense may be required.',
          impact: 'medium',
          actionable: true,
        },
        {
          id: 'ki-4',
          category: 'risk',
          title: 'Turnaround Decision Pending',
          description: 'Epsilon Tech Hub requires strategic decision: increase turnaround investment or begin sunset process.',
          impact: 'medium',
          actionable: true,
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          priority: 1,
          title: 'Approve 20% Budget Increase for Growth Drivers',
          description: 'Redirect additional capital to Alpha E-commerce and Zeta Marketplace to capitalize on market opportunity.',
          expectedOutcome: 'Projected 18.75% ROI improvement with minimal risk increase.',
          timeframe: 'Q1 implementation',
          requiredDecision: 'Budget allocation approval',
        },
        {
          id: 'rec-2',
          priority: 2,
          title: 'Finalize Epsilon Tech Hub Strategy',
          description: 'Decide between turnaround investment or controlled sunset within 30 days.',
          expectedOutcome: 'Clarity on resource allocation and portfolio composition.',
          timeframe: '30 days',
          requiredDecision: 'Strategic direction',
        },
        {
          id: 'rec-3',
          priority: 3,
          title: 'Enhance Competitive Monitoring',
          description: 'Expand competitive intelligence coverage for key markets.',
          expectedOutcome: 'Earlier warning of competitive threats.',
          timeframe: 'Ongoing',
        },
      ],
      periodCovered: 'Q4 2025 (October - December)',
      generatedAt: new Date().toISOString(),
      dataFreshness: 'daily',
    },
    
    // -------------------------------------------------------------------------
    // METADATA
    // -------------------------------------------------------------------------
    meta: {
      portfolioId: 'portfolio-main',
      portfolioName: 'Enterprise SEO Portfolio',
      generatedAt: new Date().toISOString(),
      dataVersion: 'v1.8.0',
    },
  };
}

// =============================================================================
// FETCH FUNCTION (SIMULATES API)
// =============================================================================

export async function fetchExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 800));
  return generateExecutiveMockData();
}
