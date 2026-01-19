/**
 * Cost Optimization Runner v1.6
 * 
 * Local testing utility for Cost-aware Optimization.
 * Demonstrates the full optimization pipeline with mock data.
 * 
 * Usage:
 *   npx ts-node backend/src/cost_optimization/cost_runner.ts
 */

import {
  CostOptimizationEngine,
  SEOActionFullInput,
  CurrentStateInput,
  ROIStrategy,
  createCostOptimizationEngine,
} from './index';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function generateMockActions(): SEOActionFullInput[] {
  return [
    {
      id: 'action-1',
      type: 'optimize_content',
      title: 'Optimize homepage content for primary keywords',
      targetUrl: '/homepage',
      targetKeyword: 'seo tool',
      priority: 1,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 15,
        confidence: 'medium',
        timeToResult: '30-60 days',
      },
    },
    {
      id: 'action-2',
      type: 'create_content',
      title: 'Create comprehensive guide for enterprise SEO',
      targetUrl: '/guides/enterprise-seo',
      targetKeyword: 'enterprise seo strategy',
      priority: 2,
      pageCount: 1,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 25,
        confidence: 'low',
        timeToResult: '60-90 days',
      },
    },
    {
      id: 'action-3',
      type: 'fix_technical_issue',
      title: 'Fix mobile usability issues on blog pages',
      targetUrl: '/blog/*',
      priority: 1,
      pageCount: 45,
      expectedImpact: {
        metric: 'mobile_traffic',
        estimatedChange: 10,
        confidence: 'high',
        timeToResult: '14-30 days',
      },
    },
    {
      id: 'action-4',
      type: 'improve_page_speed',
      title: 'Optimize Core Web Vitals across product pages',
      targetUrl: '/products/*',
      priority: 2,
      pageCount: 20,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 8,
        confidence: 'medium',
        timeToResult: '21-45 days',
      },
    },
    {
      id: 'action-5',
      type: 'add_internal_link',
      title: 'Add internal links from blog to product pages',
      targetUrl: '/blog/*',
      priority: 3,
      pageCount: 10,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 3,
        confidence: 'medium',
        timeToResult: '30-45 days',
      },
    },
    {
      id: 'action-6',
      type: 'improve_keyword_ranking',
      title: 'Improve ranking for high-value keyword cluster',
      targetUrl: '/features/analytics',
      targetKeyword: 'seo analytics tools',
      priority: 1,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 20,
        confidence: 'medium',
        timeToResult: '45-60 days',
      },
    },
    {
      id: 'action-7',
      type: 'fix_schema_markup',
      title: 'Add FAQ schema to support pages',
      targetUrl: '/support/*',
      priority: 3,
      pageCount: 15,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 5,
        confidence: 'high',
        timeToResult: '14-30 days',
      },
    },
    {
      id: 'action-8',
      type: 'optimize_anchor_text',
      title: 'Optimize anchor text for internal links',
      targetUrl: '/',
      priority: 3,
      pageCount: 30,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 4,
        confidence: 'low',
        timeToResult: '30-45 days',
      },
    },
    {
      id: 'action-9',
      type: 'investigate_anomaly',
      title: 'Investigate traffic drop on pricing page',
      targetUrl: '/pricing',
      priority: 1,
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 12,
        confidence: 'low',
        timeToResult: '7-14 days',
      },
    },
    {
      id: 'action-10',
      type: 'set_up_alert',
      title: 'Set up ranking monitoring alerts',
      priority: 2,
      expectedImpact: {
        metric: 'risk_reduction',
        estimatedChange: 10,
        confidence: 'high',
        timeToResult: '1-3 days',
      },
    },
  ];
}

function generateCurrentState(): CurrentStateInput {
  return {
    monthlyTraffic: 50000,
    avgPosition: 12,
    currentRiskScore: 0.35,
    currentBrandScore: 75,
    topKeywords: [
      { keyword: 'seo tool', position: 8, searchVolume: 12000 },
      { keyword: 'keyword research tool', position: 15, searchVolume: 8000 },
      { keyword: 'seo analytics', position: 22, searchVolume: 5000 },
      { keyword: 'content optimization', position: 18, searchVolume: 4000 },
      { keyword: 'enterprise seo', position: 35, searchVolume: 3000 },
    ],
  };
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runCostOptimization(): Promise<void> {
  console.log('='.repeat(80));
  console.log('COST OPTIMIZATION v1.6 - TEST RUN');
  console.log('='.repeat(80));
  console.log();
  
  // Create optimization engine
  const engine = createCostOptimizationEngine(
    {}, // Default config
    ROIStrategy.BALANCED,
    undefined // Will use moderate budget profile
  );
  
  // Set budget preset
  engine.setBudgetPreset('moderate');
  
  // Generate mock data
  const actions = generateMockActions();
  const currentState = generateCurrentState();
  
  console.log(`Input: ${actions.length} proposed actions`);
  console.log(`Current traffic: ${currentState.monthlyTraffic.toLocaleString()} visits/month`);
  console.log(`Current avg position: ${currentState.avgPosition}`);
  console.log(`Current risk score: ${(currentState.currentRiskScore * 100).toFixed(0)}%`);
  console.log();
  
  // Run optimization
  console.log('Running optimization...');
  console.log();
  
  const result = await engine.optimize(
    'test-project',
    actions,
    currentState,
    undefined, // No simulation data
    'greedy'   // Use greedy optimization
  );
  
  // Display cost breakdown
  console.log('-'.repeat(80));
  console.log('COST BREAKDOWN BY ACTION');
  console.log('-'.repeat(80));
  
  for (const [actionId, cost] of result.costs) {
    const action = actions.find(a => a.id === actionId);
    console.log(`\n${action?.title || actionId}:`);
    console.log(`  Token: ${cost.tokenCost.totalTokens.toLocaleString()} tokens (${cost.tokenCost.estimatedCost.toFixed(1)} cost units)`);
    console.log(`  Effort: ${cost.effortCost.totalHours.toFixed(1)} hours (${cost.effortCost.complexity} complexity)`);
    console.log(`  Risk: ${(cost.riskCost.riskProbability * 100).toFixed(0)}% probability, ${cost.riskCost.expectedLoss.toFixed(1)} expected loss`);
    console.log(`  Total: ${cost.totalCost.toFixed(1)} cost units`);
  }
  
  // Display value breakdown
  console.log('\n' + '-'.repeat(80));
  console.log('VALUE BREAKDOWN BY ACTION');
  console.log('-'.repeat(80));
  
  for (const [actionId, value] of result.values) {
    const action = actions.find(a => a.id === actionId);
    console.log(`\n${action?.title || actionId}:`);
    console.log(`  Traffic: +${value.trafficValue.expectedVisitors.toLocaleString()} visitors (${value.trafficValue.trafficUpliftPercent.toFixed(1)}% uplift)`);
    console.log(`  Ranking: +${value.rankingValue.avgPositionImprovement.toFixed(1)} positions, ${value.rankingValue.keywordsAffected} keywords`);
    console.log(`  Risk reduction: ${value.riskReductionValue.riskReductionPercent.toFixed(0)}%`);
    console.log(`  Total: ${value.totalValue.toFixed(1)} value units`);
  }
  
  // Display ROI scores
  console.log('\n' + '-'.repeat(80));
  console.log('ROI SCORES (Ranked)');
  console.log('-'.repeat(80));
  
  for (const score of result.roiScores) {
    const action = actions.find(a => a.id === score.actionId);
    const tierEmoji = score.tier === 'excellent' ? '🌟' : 
                      score.tier === 'good' ? '✅' :
                      score.tier === 'moderate' ? '⚠️' : '❌';
    
    console.log(`\n#${score.rank} ${tierEmoji} ${action?.title || score.actionId}`);
    console.log(`   ROI: ${score.rawROI.toFixed(2)} (${score.tier})`);
    console.log(`   Value: ${score.valueScore.toFixed(1)} | Cost: ${score.costScore.toFixed(1)}`);
    console.log(`   Weighted ROI (${ROIStrategy.BALANCED}): ${score.weightedROI.toFixed(2)}`);
    console.log(`   Reasoning: ${score.reasoning[0]}`);
  }
  
  // Display optimized plan
  console.log('\n' + '='.repeat(80));
  console.log('OPTIMIZED ACTION PLAN');
  console.log('='.repeat(80));
  
  console.log(`\n${result.plan.summary}`);
  
  console.log('\n✅ SELECTED ACTIONS:');
  for (const decision of result.plan.selectedActions) {
    const action = actions.find(a => a.id === decision.actionId);
    console.log(`   - ${action?.title || decision.actionId}`);
    console.log(`     ROI: ${decision.roiScore.toFixed(2)} | ${decision.reason}`);
  }
  
  console.log('\n❌ REJECTED ACTIONS:');
  for (const decision of result.plan.rejectedActions) {
    const action = actions.find(a => a.id === decision.actionId);
    console.log(`   - ${action?.title || decision.actionId}`);
    console.log(`     Reason: ${decision.reason}`);
  }
  
  console.log('\n📊 CONSTRAINT UTILIZATION:');
  for (const [constraintId, usage] of Object.entries(result.plan.constraintUtilization)) {
    const bar = '█'.repeat(Math.floor(usage.percent / 5)) + '░'.repeat(20 - Math.floor(usage.percent / 5));
    console.log(`   ${constraintId}: ${bar} ${usage.percent.toFixed(0)}% (${usage.used.toFixed(1)} / ${usage.max})`);
  }
  
  console.log('\n🔄 RECOMMENDED EXECUTION ORDER:');
  result.plan.executionOrder.forEach((actionId, index) => {
    const action = actions.find(a => a.id === actionId);
    console.log(`   ${index + 1}. ${action?.title || actionId}`);
  });
  
  // Display report summary
  console.log('\n' + '-'.repeat(80));
  console.log('OPTIMIZATION REPORT');
  console.log('-'.repeat(80));
  
  const report = result.report;
  console.log(`\nActions: ${report.actionsSelected} selected, ${report.actionsRejected} rejected (${report.totalActionsEvaluated} evaluated)`);
  console.log(`Total Cost: ${report.totalEstimatedCost.toFixed(1)} units`);
  console.log(`Total Value: ${report.totalExpectedValue.toFixed(1)} units`);
  console.log(`Portfolio ROI: ${report.portfolioROI.toFixed(2)}`);
  console.log(`Budget Utilization: ${report.budgetUtilization.toFixed(0)}%`);
  
  console.log('\nROI Distribution:');
  console.log(`   🌟 Excellent: ${report.roiDistribution.excellent}`);
  console.log(`   ✅ Good: ${report.roiDistribution.good}`);
  console.log(`   ⚠️ Moderate: ${report.roiDistribution.moderate}`);
  console.log(`   ❌ Poor: ${report.roiDistribution.poor}`);
  
  console.log('\nTop Actions by ROI:');
  for (const action of report.topActionsByROI) {
    console.log(`   - ${action.title}: ROI ${action.roi.toFixed(2)}`);
  }
  
  console.log('\nRecommendations:');
  for (const rec of report.recommendations) {
    console.log(`   • ${rec}`);
  }
  
  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of report.warnings) {
      console.log(`   ⚠️ ${warning}`);
    }
  }
  
  // Demonstrate action explanation
  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED ACTION EXPLANATION');
  console.log('-'.repeat(80));
  
  if (result.plan.selectedActions.length > 0) {
    const firstSelected = result.plan.selectedActions[0].actionId;
    console.log(engine.explainActionDecision(
      firstSelected,
      result.plan,
      result.costs,
      result.values,
      result.roiScores
    ));
  }
  
  // Compare strategies
  console.log('\n' + '='.repeat(80));
  console.log('STRATEGY COMPARISON');
  console.log('='.repeat(80));
  
  const strategies: ROIStrategy[] = [
    ROIStrategy.TRAFFIC_FOCUSED,
    ROIStrategy.RISK_AVERSE,
    ROIStrategy.QUICK_WINS,
  ];
  
  for (const strategy of strategies) {
    const strategyEngine = createCostOptimizationEngine({}, strategy);
    strategyEngine.setBudgetPreset('moderate');
    
    const strategyResult = await strategyEngine.optimize(
      'test-project',
      actions,
      currentState,
      undefined,
      'greedy'
    );
    
    console.log(`\n${strategy.toUpperCase()}:`);
    console.log(`   Selected: ${strategyResult.plan.selectedActions.length} actions`);
    console.log(`   Plan ROI: ${strategyResult.plan.planROI.toFixed(2)}`);
    console.log(`   Top action: ${strategyResult.roiScores[0]?.actionId || 'N/A'}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('COST OPTIMIZATION COMPLETE');
  console.log('='.repeat(80));
}

// Run if executed directly
if (require.main === module) {
  runCostOptimization().catch(console.error);
}

export { runCostOptimization, generateMockActions, generateCurrentState };
