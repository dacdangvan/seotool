/**
 * Portfolio Runner v1.7
 * 
 * Local testing utility for Portfolio Optimization.
 * Demonstrates the full portfolio optimization pipeline with mock data.
 * 
 * Usage:
 *   npx ts-node backend/src/portfolio_optimization/portfolio_runner.ts
 */

import {
  PortfolioOptimizationEngine,
  RawProjectData,
  PortfolioConstraints,
  PortfolioStrategy,
  createPortfolioOptimizationEngine,
} from './index';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function generateMockProjects(): RawProjectData[] {
  return [
    // High-performing project - should be classified as INVEST
    {
      projectId: 'project-alpha',
      projectName: 'Alpha E-commerce',
      domain: 'alpha-shop.com',
      trafficData: {
        projectId: 'project-alpha',
        currentMonthlyTraffic: 150000,
        previousMonthlyTraffic: 130000,
        organicTraffic: 120000,
        totalTraffic: 180000,
        topKeywords: [
          { keyword: 'buy electronics', position: 3, volume: 50000 },
          { keyword: 'best laptops', position: 5, volume: 35000 },
          { keyword: 'phone deals', position: 8, volume: 28000 },
        ],
        averagePosition: 12.5,
        collectedAt: new Date().toISOString(),
      },
      roiData: {
        projectId: 'project-alpha',
        actionROIScores: [
          { actionId: 'a1', roi: 85, success: true },
          { actionId: 'a2', roi: 72, success: true },
          { actionId: 'a3', roi: 68, success: true },
          { actionId: 'a4', roi: 45, success: false },
        ],
        totalValueGenerated: 25000,
        totalCostIncurred: 8000,
        collectedAt: new Date().toISOString(),
      },
      riskData: {
        projectId: 'project-alpha',
        overallRiskScore: 0.25,
        penaltyRisk: 0.05,
        rankingVolatility: 0.15,
        technicalIssues: [
          { severity: 'warning', count: 12 },
          { severity: 'info', count: 45 },
        ],
        brandViolations: [],
        brandComplianceScore: 92,
        collectedAt: new Date().toISOString(),
      },
      costData: {
        projectId: 'project-alpha',
        tokenUsage: 250000,
        computeCost: 1500,
        effortHours: 40,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      },
      projectionData: {
        projectId: 'project-alpha',
        trafficForecast30d: { low: 155000, mid: 165000, high: 180000 },
        trafficForecast60d: { low: 165000, mid: 180000, high: 200000 },
        trafficForecast90d: { low: 175000, mid: 195000, high: 220000 },
        confidenceScore: 0.82,
        bestScenarioId: 'scenario-growth',
        collectedAt: new Date().toISOString(),
      },
    },
    
    // Stable performer - should be classified as MAINTAIN
    {
      projectId: 'project-beta',
      projectName: 'Beta Blog Network',
      domain: 'beta-blog.com',
      trafficData: {
        projectId: 'project-beta',
        currentMonthlyTraffic: 80000,
        previousMonthlyTraffic: 78000,
        organicTraffic: 70000,
        totalTraffic: 95000,
        topKeywords: [
          { keyword: 'tech tutorials', position: 6, volume: 22000 },
          { keyword: 'coding guides', position: 9, volume: 18000 },
        ],
        averagePosition: 18.2,
        collectedAt: new Date().toISOString(),
      },
      roiData: {
        projectId: 'project-beta',
        actionROIScores: [
          { actionId: 'b1', roi: 55, success: true },
          { actionId: 'b2', roi: 52, success: true },
          { actionId: 'b3', roi: 48, success: true },
        ],
        totalValueGenerated: 12000,
        totalCostIncurred: 6000,
        collectedAt: new Date().toISOString(),
      },
      riskData: {
        projectId: 'project-beta',
        overallRiskScore: 0.28,
        penaltyRisk: 0.08,
        rankingVolatility: 0.12,
        technicalIssues: [
          { severity: 'warning', count: 8 },
          { severity: 'info', count: 25 },
        ],
        brandViolations: [
          { type: 'tone', count: 2 },
        ],
        brandComplianceScore: 85,
        collectedAt: new Date().toISOString(),
      },
      costData: {
        projectId: 'project-beta',
        tokenUsage: 180000,
        computeCost: 1000,
        effortHours: 25,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      },
      projectionData: {
        projectId: 'project-beta',
        trafficForecast30d: { low: 78000, mid: 82000, high: 86000 },
        trafficForecast60d: { low: 80000, mid: 85000, high: 90000 },
        trafficForecast90d: { low: 82000, mid: 88000, high: 95000 },
        confidenceScore: 0.75,
        collectedAt: new Date().toISOString(),
      },
    },
    
    // Risky project - should be classified as OPTIMIZE_CAUTIOUSLY
    {
      projectId: 'project-gamma',
      projectName: 'Gamma Finance',
      domain: 'gamma-finance.com',
      trafficData: {
        projectId: 'project-gamma',
        currentMonthlyTraffic: 60000,
        previousMonthlyTraffic: 55000,
        organicTraffic: 48000,
        totalTraffic: 72000,
        topKeywords: [
          { keyword: 'investment tips', position: 12, volume: 40000 },
          { keyword: 'stock analysis', position: 18, volume: 25000 },
        ],
        averagePosition: 22.5,
        collectedAt: new Date().toISOString(),
      },
      roiData: {
        projectId: 'project-gamma',
        actionROIScores: [
          { actionId: 'g1', roi: 62, success: true },
          { actionId: 'g2', roi: 45, success: false },
          { actionId: 'g3', roi: 38, success: false },
        ],
        totalValueGenerated: 8000,
        totalCostIncurred: 5500,
        collectedAt: new Date().toISOString(),
      },
      riskData: {
        projectId: 'project-gamma',
        overallRiskScore: 0.58,
        penaltyRisk: 0.25,
        rankingVolatility: 0.42,
        technicalIssues: [
          { severity: 'critical', count: 3 },
          { severity: 'high', count: 8 },
          { severity: 'warning', count: 22 },
        ],
        brandViolations: [
          { type: 'compliance', count: 4 },
        ],
        brandComplianceScore: 68,
        collectedAt: new Date().toISOString(),
      },
      costData: {
        projectId: 'project-gamma',
        tokenUsage: 200000,
        computeCost: 1200,
        effortHours: 35,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      },
      projectionData: {
        projectId: 'project-gamma',
        trafficForecast30d: { low: 55000, mid: 62000, high: 70000 },
        trafficForecast60d: { low: 58000, mid: 68000, high: 78000 },
        trafficForecast90d: { low: 60000, mid: 72000, high: 85000 },
        confidenceScore: 0.55,
        collectedAt: new Date().toISOString(),
      },
    },
    
    // Underperforming project - should be classified as OBSERVE
    {
      projectId: 'project-delta',
      projectName: 'Delta Local Services',
      domain: 'delta-services.com',
      trafficData: {
        projectId: 'project-delta',
        currentMonthlyTraffic: 15000,
        previousMonthlyTraffic: 18000,
        organicTraffic: 10000,
        totalTraffic: 20000,
        topKeywords: [
          { keyword: 'local plumber', position: 28, volume: 5000 },
        ],
        averagePosition: 35.0,
        collectedAt: new Date().toISOString(),
      },
      roiData: {
        projectId: 'project-delta',
        actionROIScores: [
          { actionId: 'd1', roi: 25, success: false },
          { actionId: 'd2', roi: 18, success: false },
        ],
        totalValueGenerated: 2000,
        totalCostIncurred: 3500,
        collectedAt: new Date().toISOString(),
      },
      riskData: {
        projectId: 'project-delta',
        overallRiskScore: 0.35,
        penaltyRisk: 0.1,
        rankingVolatility: 0.25,
        technicalIssues: [
          { severity: 'high', count: 5 },
          { severity: 'warning', count: 15 },
        ],
        brandViolations: [],
        brandComplianceScore: 78,
        collectedAt: new Date().toISOString(),
      },
      costData: {
        projectId: 'project-delta',
        tokenUsage: 50000,
        computeCost: 400,
        effortHours: 10,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      },
      projectionData: {
        projectId: 'project-delta',
        trafficForecast30d: { low: 12000, mid: 14000, high: 16000 },
        trafficForecast60d: { low: 11000, mid: 14000, high: 17000 },
        trafficForecast90d: { low: 10000, mid: 14000, high: 18000 },
        confidenceScore: 0.45,
        collectedAt: new Date().toISOString(),
      },
    },
    
    // Turnaround candidate - high potential but poor current state
    {
      projectId: 'project-epsilon',
      projectName: 'Epsilon Tech Hub',
      domain: 'epsilon-tech.com',
      trafficData: {
        projectId: 'project-epsilon',
        currentMonthlyTraffic: 25000,
        previousMonthlyTraffic: 35000,
        organicTraffic: 18000,
        totalTraffic: 32000,
        topKeywords: [
          { keyword: 'AI tools', position: 45, volume: 80000 },
          { keyword: 'machine learning tutorials', position: 38, volume: 55000 },
        ],
        averagePosition: 42.0,
        collectedAt: new Date().toISOString(),
      },
      roiData: {
        projectId: 'project-epsilon',
        actionROIScores: [
          { actionId: 'e1', roi: 32, success: false },
          { actionId: 'e2', roi: 28, success: false },
        ],
        totalValueGenerated: 3000,
        totalCostIncurred: 4500,
        collectedAt: new Date().toISOString(),
      },
      riskData: {
        projectId: 'project-epsilon',
        overallRiskScore: 0.48,
        penaltyRisk: 0.12,
        rankingVolatility: 0.38,
        technicalIssues: [
          { severity: 'critical', count: 2 },
          { severity: 'high', count: 12 },
          { severity: 'warning', count: 35 },
        ],
        brandViolations: [],
        brandComplianceScore: 72,
        collectedAt: new Date().toISOString(),
      },
      costData: {
        projectId: 'project-epsilon',
        tokenUsage: 120000,
        computeCost: 800,
        effortHours: 20,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      },
      projectionData: {
        projectId: 'project-epsilon',
        trafficForecast30d: { low: 22000, mid: 28000, high: 35000 },
        trafficForecast60d: { low: 25000, mid: 38000, high: 55000 },
        trafficForecast90d: { low: 30000, mid: 50000, high: 80000 },
        confidenceScore: 0.52,
        bestScenarioId: 'scenario-turnaround',
        collectedAt: new Date().toISOString(),
      },
    },
  ];
}

function generateMockConstraints(): Partial<PortfolioConstraints> {
  return {
    name: 'Test Portfolio Constraints',
    totalTokenBudget: 1000000,
    totalEffortHours: 150,
    totalComputeBudget: 5000,
    portfolioRiskTolerance: 0.5,
    maxProjectRisk: 0.6,
    maxProjectAllocation: 0.45,
    minProjectAllocation: 0.05,
    maxAutomationLevel: 0.7,
    requireHumanApproval: true,
    planningHorizon: 90,
    rebalanceFrequency: 'weekly',
  };
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runPortfolioOptimization(): Promise<void> {
  console.log('='.repeat(80));
  console.log('PORTFOLIO OPTIMIZATION v1.7 - TEST RUN');
  console.log('='.repeat(80));
  console.log();
  
  // Create engine
  const engine = createPortfolioOptimizationEngine({
    enableDetailedLogging: true,
  });
  
  // Generate mock data
  const projects = generateMockProjects();
  const constraints = generateMockConstraints();
  
  console.log(`Input: ${projects.length} projects`);
  console.log(`Strategy: ${PortfolioStrategy.BALANCED_GROWTH}`);
  console.log();
  
  // Run optimization
  console.log('Running portfolio optimization...');
  console.log();
  
  try {
    const result = await engine.optimizePortfolio(
      'test-portfolio',
      projects,
      constraints,
      PortfolioStrategy.BALANCED_GROWTH
    );
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('OPTIMIZATION RESULTS');
    console.log('='.repeat(80));
    
    console.log(`\nExecution Time: ${result.executionTimeMs}ms`);
    if (result.warnings.length > 0) {
      console.log(`Warnings: ${result.warnings.join(', ')}`);
    }
    
    // Classifications
    console.log('\n' + '-'.repeat(80));
    console.log('PROJECT CLASSIFICATIONS');
    console.log('-'.repeat(80));
    
    for (const classification of result.classifications) {
      const normalized = result.normalizedMetrics.find(
        n => n.projectId === classification.projectId
      );
      console.log(`\n${classification.projectId}:`);
      console.log(`  Classification: ${classification.classification}`);
      console.log(`  Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
      if (normalized) {
        console.log(`  ROI Score: ${normalized.roiScore.toFixed(0)}`);
        console.log(`  Risk Score: ${normalized.riskScore.toFixed(0)}`);
        console.log(`  Growth Score: ${normalized.growthScore.toFixed(0)}`);
      }
      console.log(`  Recommendation: ${classification.recommendation.substring(0, 80)}...`);
    }
    
    // Allocation
    console.log('\n' + '-'.repeat(80));
    console.log('RECOMMENDED ALLOCATION');
    console.log('-'.repeat(80));
    
    const allocation = result.recommendedAllocation;
    console.log(`\nMethod: ${allocation.optimizationMethod}`);
    console.log(`Optimization Score: ${allocation.optimizationScore.toFixed(1)}`);
    console.log(`Total Tokens Allocated: ${allocation.totalTokensAllocated.toLocaleString()}`);
    console.log(`Total Effort Allocated: ${allocation.totalEffortAllocated.toFixed(1)} hours`);
    
    console.log('\nAllocation by Project:');
    const sortedAllocations = [...allocation.projectAllocations].sort(
      (a, b) => b.totalAllocationPercent - a.totalAllocationPercent
    );
    
    for (const alloc of sortedAllocations) {
      console.log(`\n  ${alloc.projectName} [${alloc.classification}]`);
      console.log(`    Allocation: ${(alloc.totalAllocationPercent * 100).toFixed(1)}%`);
      console.log(`    Token Budget: ${alloc.tokenBudget.toLocaleString()}`);
      console.log(`    Effort Hours: ${alloc.effortHours.toFixed(1)}`);
      console.log(`    Automation Level: ${(alloc.automationLevel * 100).toFixed(0)}%`);
      console.log(`    Requires Approval: ${alloc.requiresApproval ? 'Yes' : 'No'}`);
    }
    
    console.log('\nDistribution by Classification:');
    for (const [classification, percent] of Object.entries(allocation.classificationDistribution)) {
      if (percent > 0) {
        console.log(`  ${classification}: ${(percent * 100).toFixed(1)}%`);
      }
    }
    
    // Simulation Results Summary
    console.log('\n' + '-'.repeat(80));
    console.log('SIMULATION RESULTS');
    console.log('-'.repeat(80));
    
    console.log(`\n${result.simulationResults.length} scenarios simulated:`);
    for (const simResult of result.simulationResults) {
      console.log(`\n  Scenario: ${simResult.scenarioId.split('-')[1] || simResult.scenarioId}`);
      console.log(`    Projected ROI: ${simResult.projectedPortfolioROI.toFixed(1)}`);
      console.log(`    Projected Traffic: ${simResult.projectedTotalTraffic.mid.toLocaleString()}`);
      console.log(`    Projected Risk: ${(simResult.projectedPortfolioRisk * 100).toFixed(0)}%`);
      console.log(`    Confidence: ${(simResult.overallConfidence * 100).toFixed(0)}%`);
      console.log(`    ROI vs Baseline: ${simResult.roiChangeFromBaseline >= 0 ? '+' : ''}${simResult.roiChangeFromBaseline.toFixed(1)}`);
    }
    
    // Recommendations
    console.log('\n' + '-'.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(80));
    
    console.log(`\n${result.recommendation.summary}`);
    
    // Risk Warnings
    if (result.recommendation.riskWarnings.length > 0) {
      console.log('\n⚠️ Risk Warnings:');
      for (const warning of result.recommendation.riskWarnings) {
        const icon = warning.severity === 'critical' ? '🔴' : '🟡';
        console.log(`  ${icon} [${warning.type}] ${warning.description}`);
        console.log(`     Mitigation: ${warning.suggestedMitigation}`);
      }
    }
    
    // Prioritized Actions
    console.log('\n🎯 Top 5 Prioritized Actions:');
    for (const action of result.recommendation.prioritizedActions.slice(0, 5)) {
      console.log(`  [P${action.priority}] ${action.action}`);
      console.log(`      Impact: ${action.expectedImpact}`);
    }
    
    // Project Recommendations
    console.log('\n📋 Project Recommendations:');
    for (const rec of result.recommendation.projectRecommendations) {
      console.log(`\n  ${rec.projectName} [${rec.classification}]`);
      console.log(`    Action: ${rec.recommendedAction}`);
      console.log(`    Priority: ${rec.priority}/10`);
      console.log(`    Impact: ${rec.expectedImpact}`);
    }
    
    // Expected Outcomes
    console.log('\n📈 Expected Outcomes:');
    for (const outcome of result.recommendation.expectedOutcomes) {
      const direction = outcome.changePercent >= 0 ? '↑' : '↓';
      console.log(`  ${outcome.metric}: ${outcome.currentValue.toFixed(1)} → ${outcome.projectedValue.toFixed(1)} (${direction}${Math.abs(outcome.changePercent).toFixed(1)}%)`);
    }
    
    // Portfolio Insights
    if (result.recommendation.portfolioInsights.length > 0) {
      console.log('\n💡 Portfolio Insights:');
      for (const insight of result.recommendation.portfolioInsights) {
        const icon = insight.type === 'opportunity' ? '🌟' : 
                    insight.type === 'risk' ? '⚠️' : 
                    insight.type === 'efficiency' ? '⚡' : '🔄';
        console.log(`  ${icon} ${insight.title}`);
        console.log(`     ${insight.description}`);
      }
    }
    
    // Detailed Explanation
    console.log('\n' + '-'.repeat(80));
    console.log('DETAILED ALLOCATION EXPLANATION');
    console.log('-'.repeat(80));
    console.log(engine.explainAllocation(result.recommendedAllocation));
    
    console.log('\n' + '='.repeat(80));
    console.log('PORTFOLIO OPTIMIZATION COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error during portfolio optimization:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runPortfolioOptimization().catch(console.error);
}

export { runPortfolioOptimization, generateMockProjects, generateMockConstraints };
