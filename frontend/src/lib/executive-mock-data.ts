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
          projectCount: 1,
          totalAllocation: 100,
          averageROI: 4.2,
          color: '#10B981', // green
        },
      ],
      projects: [
        {
          projectId: 'vib-main',
          projectName: 'VIB Main Website',
          domain: 'www.vib.com.vn',
          classification: 'growth_driver',
          classificationConfidence: 92,
          performanceScore: 88,
          roiScore: 92,
          riskScore: 25,
          growthScore: 85,
          allocationPercent: 100,
          allocationChange: 0,
          executiveSummary: 'Website chính của VIB - hiệu suất tốt với tăng trưởng ổn định. Khuyến nghị tiếp tục đầu tư.',
          trafficTrend: [100, 105, 108, 112, 118, 122, 128, 135, 142, 148, 152, 158],
        },
      ],
      totalProjects: 1,
      totalAllocationUsed: 100,
      diversificationScore: 100,
      concentrationRisk: 0,
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
          title: 'Cạnh tranh thị trường tài chính',
          description: 'Các ngân hàng đối thủ đã tăng đầu tư vào digital marketing trong Q4.',
          affectedProjects: 1,
          potentialImpact: 'Có thể ảnh hưởng đến thị phần organic search nếu không tối ưu liên tục.',
          recommendedAction: 'Tiếp tục đầu tư vào content chất lượng và technical SEO cho www.vib.com.vn.',
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
        roi: 4.2,
        risk: 25,
        confidence: 88,
      },
      scenarios: [
        {
          id: 'increase-content-investment',
          name: 'Tăng đầu tư Content SEO 30%',
          description: 'Mở rộng content coverage cho sản phẩm tín dụng và thẻ.',
          type: 'budget_increase',
          projectedROI: 5.0,
          roiChange: 19.0,
          projectedRisk: 28,
          riskDelta: 3,
          confidenceRange: { low: 4.5, mid: 5.0, high: 5.5 },
          tradeoffs: [
            'Tăng ngân sách content',
            'Cần thêm resource sản xuất content',
            'ROI cao hơn trong dài hạn',
          ],
          recommendation: 'recommended',
          rationale: 'Thị trường tìm kiếm sản phẩm tài chính đang tăng. Đầu tư content sẽ capture được demand.',
        },
        {
          id: 'technical-seo-focus',
          name: 'Tập trung Technical SEO',
          description: 'Ưu tiên tối ưu Core Web Vitals và mobile experience.',
          type: 'reduce_automation',
          projectedROI: 4.5,
          roiChange: 7.1,
          projectedRisk: 20,
          riskDelta: -5,
          confidenceRange: { low: 4.2, mid: 4.5, high: 4.8 },
          tradeoffs: [
            'Giảm rủi ro technical',
            'Cần development resource',
            'Cải thiện user experience',
          ],
          recommendation: 'neutral',
          rationale: 'Phù hợp nếu muốn củng cố foundation trước khi mở rộng.',
        },
        {
          id: 'maintain-current',
          name: 'Duy trì hiện tại',
          description: 'Giữ nguyên chiến lược và ngân sách hiện tại.',
          type: 'pause_risky',
          projectedROI: 4.2,
          roiChange: 0,
          projectedRisk: 25,
          riskDelta: 0,
          confidenceRange: { low: 3.8, mid: 4.2, high: 4.6 },
          tradeoffs: [
            'Ổn định, không rủi ro',
            'Có thể mất cơ hội thị trường',
            'Đối thủ có thể vượt qua',
          ],
          recommendation: 'neutral',
          rationale: 'An toàn nhưng có thể không tối ưu trong thị trường cạnh tranh.',
        },
      ],
      recommendedScenario: 'increase-content-investment',
      recommendationRationale: 'Thị trường tìm kiếm sản phẩm tài chính đang tăng trưởng. Đầu tư content sẽ giúp VIB capture được organic demand.',
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
      narrativeSummary: `**Báo cáo Hiệu suất Digital Marketing - VIB**

Website chính www.vib.com.vn đạt hiệu suất tốt trong quý này, đạt **ROI 4.2x** — vượt mục tiêu 3.5x và benchmark ngành tài chính 3.0x.

**Điểm nổi bật:**
- Lưu lượng organic tăng 58% so với cùng kỳ năm trước
- Traffic organic chiếm 45% tổng lượng truy cập website
- Ranking top 10 cho 85% keywords mục tiêu ngành ngân hàng

**Vị thế chiến lược:**
VIB duy trì vị trí dẫn đầu về organic search trong ngành ngân hàng Việt Nam. Performance score 88/100 cho thấy hiệu quả SEO ổn định.

**Lưu ý:**
Tiếp tục tối ưu Core Web Vitals và mobile experience để duy trì competitive advantage.

**Hiệu suất AI:**
Hệ thống AI-SEO Tool xử lý 1,247 tác vụ trong quý với tỷ lệ thành công 99%. Chỉ 12 tác vụ cần rollback, đều được giải quyết trong SLA.`,

      keyInsights: [
        {
          id: 'ki-1',
          category: 'achievement',
          title: 'ROI vượt benchmark ngành',
          description: 'ROI 4.2x cao hơn 40% so với benchmark ngành tài chính 3.0x.',
          impact: 'high',
          actionable: false,
        },
        {
          id: 'ki-2',
          category: 'opportunity',
          title: 'Cơ hội mở rộng keyword coverage',
          description: 'Có thể mở rộng ranking cho thêm 50+ keywords về sản phẩm tín dụng và thẻ.',
          impact: 'high',
          actionable: true,
        },
        {
          id: 'ki-3',
          category: 'attention',
          title: 'Mobile performance cần cải thiện',
          description: 'Mobile Core Web Vitals cần tối ưu để duy trì ranking Google.',
          impact: 'medium',
          actionable: true,
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          priority: 1,
          title: 'Tối ưu Core Web Vitals cho Mobile',
          description: 'Cải thiện LCP và CLS trên mobile để đạt tiêu chuẩn Google.',
          expectedOutcome: 'Duy trì và cải thiện mobile ranking.',
          timeframe: 'Q1 2025',
          requiredDecision: 'Phê duyệt technical optimization',
        },
        {
          id: 'rec-2',
          priority: 2,
          title: 'Mở rộng content về sản phẩm tín dụng',
          description: 'Tạo thêm 20 trang content chuyên sâu về các sản phẩm tín dụng.',
          expectedOutcome: 'Tăng 30% organic traffic cho category tín dụng.',
          timeframe: 'Q1-Q2 2025',
          requiredDecision: 'Phê duyệt content strategy',
        },
        {
          id: 'rec-3',
          priority: 3,
          title: 'Monitoring đối thủ cạnh tranh',
          description: 'Theo dõi chiến lược SEO của các ngân hàng đối thủ.',
          expectedOutcome: 'Phát hiện sớm các thay đổi cạnh tranh.',
          timeframe: 'Liên tục',
        },
      ],
      periodCovered: 'Q4 2025 (Tháng 10 - Tháng 12)',
      generatedAt: new Date().toISOString(),
      dataFreshness: 'daily',
    },
    
    // -------------------------------------------------------------------------
    // METADATA
    // -------------------------------------------------------------------------
    meta: {
      portfolioId: 'vib-portfolio',
      portfolioName: 'VIB SEO Portfolio',
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
