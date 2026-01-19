/**
 * Scenario Summary Component v1.8
 * 
 * Board-level strategic scenario comparison.
 * Shows what-if analysis for key investment decisions.
 */

'use client';

import { useState } from 'react';
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Minus,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import type { ScenarioSummaryData, BoardScenario } from '@/types/executive';

interface ScenarioSummaryProps {
  data: ScenarioSummaryData;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatROI(value: number): string {
  return `${value.toFixed(1)}x`;
}

function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getRecommendationStyle(rec: string): { bg: string; text: string; icon: React.ReactNode } {
  switch (rec) {
    case 'recommended':
      return { 
        bg: 'bg-emerald-100', 
        text: 'text-emerald-700',
        icon: <CheckCircle className="w-4 h-4" />
      };
    case 'not_recommended':
      return { 
        bg: 'bg-red-100', 
        text: 'text-red-700',
        icon: <XCircle className="w-4 h-4" />
      };
    default:
      return { 
        bg: 'bg-gray-100', 
        text: 'text-gray-600',
        icon: <Minus className="w-4 h-4" />
      };
  }
}

function getRecommendationLabel(rec: string): string {
  switch (rec) {
    case 'recommended': return 'Recommended';
    case 'not_recommended': return 'Not Recommended';
    default: return 'Neutral';
  }
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface BaselineCardProps {
  baseline: { roi: number; risk: number; confidence: number };
}

function BaselineCard({ baseline }: BaselineCardProps) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-600 mb-4">Current Baseline</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">ROI</p>
          <p className="text-2xl font-bold text-slate-900">{formatROI(baseline.roi)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Risk Score</p>
          <p className="text-2xl font-bold text-slate-900">{baseline.risk}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Confidence</p>
          <p className="text-2xl font-bold text-slate-900">{baseline.confidence}%</p>
        </div>
      </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenario: BoardScenario;
  baseline: { roi: number; risk: number; confidence: number };
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}

function ScenarioCard({ scenario, baseline, isSelected, isRecommended, onSelect }: ScenarioCardProps) {
  const recStyle = getRecommendationStyle(scenario.recommendation);
  
  const roiChange = ((scenario.projectedROI - baseline.roi) / baseline.roi) * 100;
  const riskChange = scenario.projectedRisk - baseline.risk;
  
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
        isSelected 
          ? 'border-blue-400 bg-blue-50/50 shadow-md' 
          : isRecommended
          ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isRecommended && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                ★ Recommended
              </span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
          <p className="text-sm text-gray-500 mt-1">{scenario.description}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${recStyle.bg} ${recStyle.text}`}>
          {recStyle.icon}
          <span>{getRecommendationLabel(scenario.recommendation)}</span>
        </div>
      </div>
      
      {/* Metrics Comparison */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Projected ROI</p>
          <p className="text-xl font-bold text-gray-900">{formatROI(scenario.projectedROI)}</p>
          <p className={`text-xs font-medium ${roiChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPercent(roiChange)} vs baseline
          </p>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Risk Score</p>
          <p className="text-xl font-bold text-gray-900">{scenario.projectedRisk}</p>
          <p className={`text-xs font-medium ${riskChange <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {riskChange >= 0 ? '+' : ''}{riskChange} vs baseline
          </p>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Confidence Range</p>
          <p className="text-lg font-bold text-gray-900">
            {formatROI(scenario.confidenceRange.low)} – {formatROI(scenario.confidenceRange.high)}
          </p>
        </div>
      </div>
      
      {/* Trade-offs */}
      <div className="text-sm">
        <p className="text-xs font-medium text-gray-500 mb-2">Key Trade-offs:</p>
        <ul className="space-y-1">
          {scenario.tradeoffs.slice(0, 2).map((tradeoff, idx) => (
            <li key={idx} className="flex items-start gap-2 text-gray-600">
              <ArrowRight className="w-3 h-3 mt-1 flex-shrink-0 text-gray-400" />
              <span>{tradeoff}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

interface ScenarioDetailProps {
  scenario: BoardScenario;
  baseline: { roi: number; risk: number; confidence: number };
}

function ScenarioDetail({ scenario, baseline }: ScenarioDetailProps) {
  const roiChange = ((scenario.projectedROI - baseline.roi) / baseline.roi) * 100;
  const riskChange = scenario.projectedRisk - baseline.risk;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{scenario.name}</h3>
          <p className="text-sm text-gray-500">{scenario.description}</p>
        </div>
      </div>
      
      {/* Visual comparison */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* ROI Comparison */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-3">ROI Comparison</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Baseline</span>
                <span className="font-medium">{formatROI(baseline.roi)}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-400 rounded-full"
                  style={{ width: `${(baseline.roi / 5) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Projected</span>
                <span className={`font-medium ${roiChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatROI(scenario.projectedROI)} ({formatPercent(roiChange)})
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${roiChange >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${(scenario.projectedROI / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Risk Comparison */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-3">Risk Comparison</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Baseline</span>
                <span className="font-medium">{baseline.risk}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-400 rounded-full"
                  style={{ width: `${baseline.risk}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Projected</span>
                <span className={`font-medium ${riskChange <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {scenario.projectedRisk} ({riskChange >= 0 ? '+' : ''}{riskChange})
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${riskChange <= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${scenario.projectedRisk}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confidence Range */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-600 mb-3">ROI Confidence Range</p>
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
          <div 
            className="absolute h-full bg-blue-200"
            style={{ 
              left: `${(scenario.confidenceRange.low / 5) * 100}%`,
              width: `${((scenario.confidenceRange.high - scenario.confidenceRange.low) / 5) * 100}%`
            }}
          />
          <div 
            className="absolute h-full w-1 bg-blue-600"
            style={{ left: `${(scenario.confidenceRange.mid / 5) * 100}%` }}
          />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
            <span className="text-gray-500">0x</span>
            <span className="text-gray-500">5x</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Low: {formatROI(scenario.confidenceRange.low)}</span>
          <span className="font-medium text-gray-700">Expected: {formatROI(scenario.confidenceRange.mid)}</span>
          <span>High: {formatROI(scenario.confidenceRange.high)}</span>
        </div>
      </div>
      
      {/* Trade-offs */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-600 mb-3">Trade-offs to Consider</p>
        <ul className="space-y-2">
          {scenario.tradeoffs.map((tradeoff, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
              <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
              <span>{tradeoff}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Rationale */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-medium text-slate-700">Analysis Rationale</p>
        </div>
        <p className="text-sm text-slate-600">{scenario.rationale}</p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ScenarioSummary({ data }: ScenarioSummaryProps) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(
    data.recommendedScenario || null
  );
  
  const selectedScenarioData = data.scenarios.find(s => s.id === selectedScenario);
  
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Strategic Scenarios</h2>
          <p className="text-sm text-gray-500">What-if analysis for board decision making</p>
        </div>
      </div>
      
      {/* Baseline */}
      <BaselineCard baseline={data.baseline} />
      
      {/* Recommendation Banner */}
      {data.recommendedScenario && data.recommendationRationale && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-emerald-800">Strategic Recommendation</p>
            <p className="text-sm text-emerald-700 mt-1">{data.recommendationRationale}</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Available Scenarios</h3>
          <div className="space-y-3">
            {data.scenarios.map(scenario => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                baseline={data.baseline}
                isSelected={selectedScenario === scenario.id}
                isRecommended={scenario.id === data.recommendedScenario}
                onSelect={() => setSelectedScenario(scenario.id)}
              />
            ))}
          </div>
        </div>
        
        {/* Selected Scenario Detail */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Scenario Analysis</h3>
          {selectedScenarioData ? (
            <ScenarioDetail scenario={selectedScenarioData} baseline={data.baseline} />
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a scenario to view detailed analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScenarioSummary;
