/**
 * Simulation Runner v1.5
 * 
 * Local testing utility for Scenario Simulation.
 * Demonstrates the full simulation pipeline with mock data.
 * 
 * Usage:
 *   npx ts-node backend/src/scenario_simulation/simulation_runner.ts
 */

import { SEOAction, ActionType, AgentSource } from '../autonomous_agent/models';
import {
  ScenarioSimulationEngine,
  HistoricalData,
  createScenarioSimulationEngine,
} from './index';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function generateMockActions(): SEOAction[] {
  return [
    {
      id: 'action-1',
      type: ActionType.OPTIMIZE_CONTENT,
      title: 'Optimize homepage content',
      description: 'Update homepage meta tags and content for target keywords',
      targetUrl: '/homepage',
      targetKeyword: 'seo tool',
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 15,
        confidence: 'medium',
        timeToResult: '30-60 days',
      },
      requiredEffort: {
        level: 'medium',
        estimatedHours: 4,
        requiredSkills: ['content writing', 'SEO'],
      },
      riskLevel: 'low',
      evidence: [
        {
          type: 'metric',
          source: AgentSource.KEYWORD_INTELLIGENCE,
          description: 'Target keyword has 5,000 monthly searches',
        },
      ],
      reasoning: 'Homepage is underoptimized for primary keywords',
      dependsOn: [],
      blockedBy: [],
      priority: 1,
      category: 'content',
      relatedGoalIds: [],
      relatedProblemIds: [],
    },
    {
      id: 'action-2',
      type: ActionType.CREATE_CONTENT,
      title: 'Create new landing page',
      description: 'Create landing page for high-value keyword cluster',
      targetUrl: '/new-landing',
      targetKeyword: 'enterprise seo',
      expectedImpact: {
        metric: 'organic_traffic',
        estimatedChange: 25,
        confidence: 'low',
        timeToResult: '60-90 days',
      },
      requiredEffort: {
        level: 'high',
        estimatedHours: 12,
        requiredSkills: ['content writing', 'SEO', 'design'],
      },
      riskLevel: 'medium',
      evidence: [
        {
          type: 'insight',
          source: AgentSource.CONTENT_ENGINE,
          description: 'Competitors rank well with similar content',
        },
      ],
      reasoning: 'Gap in content coverage for enterprise segment',
      dependsOn: [],
      blockedBy: [],
      priority: 2,
      category: 'content',
      relatedGoalIds: [],
      relatedProblemIds: [],
    },
    {
      id: 'action-3',
      type: ActionType.FIX_TECHNICAL_ISSUE,
      title: 'Fix mobile usability issues',
      description: 'Resolve mobile layout issues flagged by Search Console',
      targetUrl: '/blog/*',
      expectedImpact: {
        metric: 'mobile_traffic',
        estimatedChange: 10,
        confidence: 'high',
        timeToResult: '14-30 days',
      },
      requiredEffort: {
        level: 'medium',
        estimatedHours: 6,
        requiredSkills: ['CSS', 'responsive design'],
      },
      riskLevel: 'low',
      evidence: [
        {
          type: 'alert',
          source: AgentSource.TECHNICAL_SEO,
          description: '45 pages with mobile usability issues',
        },
      ],
      reasoning: 'Mobile issues negatively impact rankings',
      dependsOn: [],
      blockedBy: [],
      priority: 1,
      category: 'technical',
      relatedGoalIds: [],
      relatedProblemIds: [],
    },
  ];
}

function generateMockHistoricalData(): HistoricalData {
  const now = new Date();
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Generate 90 days of traffic data
  const trafficHistory = [];
  for (let i = 0; i < 90; i++) {
    const date = new Date(days90Ago.getTime() + i * 24 * 60 * 60 * 1000);
    const baseTraffic = 5000 + Math.sin(i / 7 * Math.PI) * 500; // Weekly seasonality
    const trend = i * 10; // Slight upward trend
    const noise = (Math.random() - 0.5) * 300;
    
    trafficHistory.push({
      date: date.toISOString().split('T')[0],
      organic: Math.round(baseTraffic + trend + noise),
      total: Math.round((baseTraffic + trend + noise) * 1.3),
      sessions: Math.round((baseTraffic + trend + noise) * 1.1),
      pageviews: Math.round((baseTraffic + trend + noise) * 2.5),
    });
  }
  
  // Generate ranking history
  const rankingHistory = [];
  const keywords = ['seo tool', 'keyword research', 'content optimization'];
  for (let i = 0; i < 90; i++) {
    const date = new Date(days90Ago.getTime() + i * 24 * 60 * 60 * 1000);
    for (const keyword of keywords) {
      const basePosition = keyword === 'seo tool' ? 8 : keyword === 'keyword research' ? 15 : 22;
      const variation = Math.floor((Math.random() - 0.5) * 4);
      
      rankingHistory.push({
        date: date.toISOString().split('T')[0],
        keyword,
        position: Math.max(1, basePosition + variation),
        impressions: Math.round(1000 + Math.random() * 500),
        clicks: Math.round(50 + Math.random() * 30),
        ctr: 0.03 + Math.random() * 0.02,
      });
    }
  }
  
  // Generate content scores
  const contentScores = [];
  const urls = ['/homepage', '/blog/post-1', '/features', '/pricing'];
  for (let i = 0; i < 90; i += 7) { // Weekly content scores
    const date = new Date(days90Ago.getTime() + i * 24 * 60 * 60 * 1000);
    for (const url of urls) {
      contentScores.push({
        date: date.toISOString().split('T')[0],
        url,
        qualityScore: 70 + Math.random() * 20,
        readabilityScore: 65 + Math.random() * 25,
        seoScore: 60 + Math.random() * 30,
      });
    }
  }
  
  // Generate technical health
  const technicalHealth = [];
  for (let i = 0; i < 90; i += 7) {
    const date = new Date(days90Ago.getTime() + i * 24 * 60 * 60 * 1000);
    technicalHealth.push({
      date: date.toISOString().split('T')[0],
      overallScore: 75 + Math.random() * 15,
      issueCount: Math.floor(20 + Math.random() * 30),
      criticalIssues: Math.floor(Math.random() * 5),
      pageSpeedScore: 60 + Math.random() * 30,
    });
  }
  
  // Generate brand scores
  const brandScores = [];
  for (let i = 0; i < 90; i += 7) {
    const date = new Date(days90Ago.getTime() + i * 24 * 60 * 60 * 1000);
    brandScores.push({
      date: date.toISOString().split('T')[0],
      complianceScore: 70 + Math.random() * 20,
      violationCount: Math.floor(Math.random() * 5),
      driftScore: 0.1 + Math.random() * 0.2,
    });
  }
  
  // Generate action outcomes
  const actionOutcomes = [
    {
      actionId: 'past-action-1',
      actionType: ActionType.OPTIMIZE_CONTENT,
      executedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      trafficBefore: 4500,
      trafficAfter30Days: 5000,
      trafficAfter60Days: 5500,
      trafficAfter90Days: 5800,
      success: true,
    },
    {
      actionId: 'past-action-2',
      actionType: ActionType.CREATE_CONTENT,
      executedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      trafficBefore: 5000,
      trafficAfter30Days: 5200,
      trafficAfter60Days: 5300,
      trafficAfter90Days: 0, // Not yet available
      success: true,
    },
  ];
  
  return {
    projectId: 'test-project',
    dateRange: {
      start: days90Ago.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    trafficHistory,
    rankingHistory,
    contentScores,
    technicalHealth,
    brandScores,
    actionOutcomes,
  };
}

// ============================================================================
// MAIN SIMULATION RUNNER
// ============================================================================

async function runSimulation(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SCENARIO SIMULATION v1.5 - TEST RUN');
  console.log('='.repeat(80));
  console.log();
  
  // Create simulation engine
  const engine = createScenarioSimulationEngine({
    projectId: 'test-project',
    alwaysIncludeBaseline: true,
    maxScenarios: 6,
  });
  
  // Generate mock data
  const actions = generateMockActions();
  const historicalData = generateMockHistoricalData();
  
  console.log(`Input: ${actions.length} proposed actions`);
  console.log(`Historical data: ${historicalData.trafficHistory.length} days`);
  console.log();
  
  // Run simulation
  console.log('Running simulation...');
  const result = await engine.runSimulation('test-project', actions, historicalData);
  
  // Display results
  console.log('\n' + '='.repeat(80));
  console.log('SIMULATION RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\nGenerated ${result.scenarios.length} scenarios:`);
  for (const scenario of result.scenarios) {
    console.log(`  - ${scenario.name} (${scenario.type})`);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('SCENARIO COMPARISON');
  console.log('-'.repeat(80));
  
  for (const ranking of result.comparison.rankings) {
    const simResult = result.results.get(ranking.scenarioId);
    console.log(`\n#${ranking.rank}: ${ranking.scenarioName}`);
    console.log(`   Composite Score: ${ranking.compositeScore.toFixed(1)}`);
    console.log(`   Strengths: ${ranking.strengths.join(', ') || 'None'}`);
    console.log(`   Weaknesses: ${ranking.weaknesses.join(', ') || 'None'}`);
    
    if (simResult) {
      console.log(`   Traffic Change (90d): ${(simResult.trafficImpact.percentageChange[90]?.mid || 0).toFixed(1)}%`);
      console.log(`   Risk Score: ${(simResult.riskImpact.overallRiskScore * 100).toFixed(0)}%`);
      console.log(`   Confidence: ${(simResult.overallConfidence * 100).toFixed(0)}%`);
    }
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('RECOMMENDATION');
  console.log('-'.repeat(80));
  
  console.log(`\n${result.recommendation.summary}`);
  
  console.log('\nBest Scenario:');
  console.log(`  Name: ${result.recommendation.bestScenario.scenarioName}`);
  console.log(`  Type: ${result.recommendation.bestScenario.scenarioType}`);
  console.log(`  Confidence: ${(result.recommendation.bestScenario.confidence * 100).toFixed(0)}%`);
  console.log(`  Timing: ${result.recommendation.bestScenario.suggestedTiming}`);
  console.log('\n  Reasons:');
  for (const reason of result.recommendation.bestScenario.reasons.slice(0, 3)) {
    console.log(`    - ${reason}`);
  }
  
  if (result.recommendation.safeAlternative) {
    console.log('\nSafe Alternative:');
    console.log(`  Name: ${result.recommendation.safeAlternative.scenarioName}`);
    console.log(`  Confidence: ${(result.recommendation.safeAlternative.confidence * 100).toFixed(0)}%`);
  }
  
  console.log('\nKey Trade-offs:');
  for (const tradeOff of result.recommendation.keyTradeOffs) {
    console.log(`  - ${tradeOff}`);
  }
  
  console.log('\nNext Steps:');
  for (const step of result.recommendation.nextSteps) {
    console.log(`  - ${step}`);
  }
  
  console.log('\nSensitivity Notes:');
  for (const note of result.recommendation.sensitivityNotes) {
    console.log(`  - ${note}`);
  }
  
  // Detailed scenario explanation
  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED SCENARIO ANALYSIS');
  console.log('-'.repeat(80));
  
  const topScenario = result.scenarios.find(
    s => s.id === result.recommendation.bestScenario.scenarioId
  );
  const topResult = result.results.get(result.recommendation.bestScenario.scenarioId);
  
  if (topScenario && topResult) {
    const explanation = engine.explainScenario(topScenario, topResult);
    console.log(explanation);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(80));
}

// Run if executed directly
if (require.main === module) {
  runSimulation().catch(console.error);
}

export { runSimulation, generateMockActions, generateMockHistoricalData };
