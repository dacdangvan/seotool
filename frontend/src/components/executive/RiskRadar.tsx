/**
 * Risk Radar Component v1.8
 * 
 * Risk exposure visualization and governance status.
 * Highlights systemic risks requiring board attention.
 */

'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import type { RiskRadarData, RiskExposure, RiskLevel, SystemicRisk, GuardrailStatus } from '@/types/executive';

interface RiskRadarProps {
  data: RiskRadarData;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getRiskLevelStyle(level: RiskLevel): { bg: string; text: string; border: string; dot: string } {
  switch (level) {
    case 'low':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'moderate':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
    case 'elevated':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    case 'high':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
    case 'critical':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };
  }
}

function getRiskLevelLabel(level: RiskLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'improving':
      return <TrendingDown className="w-4 h-4 text-emerald-500" />;
    case 'degrading':
      return <TrendingUp className="w-4 h-4 text-red-500" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
}

function getGuardrailIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'breached':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

function RiskGauge({ score, level }: RiskGaugeProps) {
  const style = getRiskLevelStyle(level);
  
  // Calculate gauge position (0-100 maps to 0-180 degrees)
  const rotation = (score / 100) * 180;
  
  return (
    <div className="relative w-48 h-24 mx-auto">
      {/* Gauge background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="w-48 h-48 rounded-full border-[16px] border-gray-100" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
      </div>
      
      {/* Gauge colored section */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className={`w-48 h-48 rounded-full border-[16px] ${
            score < 30 ? 'border-emerald-400' : 
            score < 50 ? 'border-amber-400' : 
            score < 70 ? 'border-orange-400' : 'border-red-400'
          }`}
          style={{ 
            clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
            transform: `rotate(${rotation - 180}deg)`,
            transformOrigin: 'center center'
          }} 
        />
      </div>
      
      {/* Center text */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <p className="text-3xl font-bold text-gray-900">{score}</p>
        <p className={`text-sm font-medium ${style.text}`}>{getRiskLevelLabel(level)}</p>
      </div>
    </div>
  );
}

interface RiskExposureCardProps {
  exposure: RiskExposure;
}

function RiskExposureCard({ exposure }: RiskExposureCardProps) {
  const style = getRiskLevelStyle(exposure.level);
  
  return (
    <div className={`p-4 rounded-xl border ${style.border} ${style.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 text-sm">{exposure.label}</h4>
        <div className="flex items-center gap-2">
          {getTrendIcon(exposure.trend)}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
            {getRiskLevelLabel(exposure.level)}
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-white rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full rounded-full ${style.dot}`}
          style={{ width: `${exposure.score}%` }}
        />
      </div>
      
      <p className="text-xs text-gray-600 mb-1">{exposure.description}</p>
      <p className="text-xs text-gray-500">{exposure.mitigationStatus}</p>
    </div>
  );
}

interface GuardrailCardProps {
  guardrail: GuardrailStatus;
}

function GuardrailCard({ guardrail }: GuardrailCardProps) {
  const complianceColor = guardrail.compliance >= 90 ? 'text-emerald-600' : 
                         guardrail.compliance >= 70 ? 'text-amber-600' : 'text-red-600';
  
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
      <div className="flex items-center gap-3">
        {getGuardrailIcon(guardrail.status)}
        <div>
          <p className="text-sm font-medium text-gray-900">{guardrail.name}</p>
          <p className="text-xs text-gray-500">{guardrail.description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${complianceColor}`}>{guardrail.compliance}%</p>
        <p className="text-xs text-gray-400">compliant</p>
      </div>
    </div>
  );
}

interface SystemicRiskAlertProps {
  risk: SystemicRisk;
}

function SystemicRiskAlert({ risk }: SystemicRiskAlertProps) {
  const [expanded, setExpanded] = useState(false);
  
  const severityStyle = risk.severity === 'critical' 
    ? 'bg-red-50 border-red-200' 
    : risk.severity === 'high'
    ? 'bg-orange-50 border-orange-200'
    : 'bg-amber-50 border-amber-200';
  
  const severityIcon = risk.severity === 'critical' 
    ? 'text-red-500' 
    : risk.severity === 'high'
    ? 'text-orange-500'
    : 'text-amber-500';
  
  return (
    <div className={`rounded-xl border-2 ${severityStyle} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 ${severityIcon}`} />
          <div>
            <p className="font-semibold text-gray-900">{risk.title}</p>
            <p className="text-sm text-gray-600">{risk.affectedProjects} projects affected</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
            <p className="text-sm text-gray-700">{risk.description}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Potential Impact</p>
            <p className="text-sm text-gray-700">{risk.potentialImpact}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Recommended Action</p>
            <p className="text-sm font-medium text-blue-700">{risk.recommendedAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface RiskTrendChartProps {
  data: { week: string; score: number }[];
}

function RiskTrendChart({ data }: RiskTrendChartProps) {
  if (data.length < 2) return null;
  
  const maxScore = Math.max(...data.map(d => d.score));
  const minScore = Math.min(...data.map(d => d.score));
  const range = maxScore - minScore || 10;
  
  const width = 100;
  const height = 40;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.score - minScore + 5) / (range + 10)) * height;
    return { x, y, ...d };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
        {/* Area fill */}
        <path
          d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
          fill="url(#riskGradient)"
          opacity="0.3"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#6B7280"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="riskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6B7280" />
            <stop offset="100%" stopColor="#F9FAFB" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{data[0].week}</span>
        <span>{data[data.length - 1].week}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function RiskRadar({ data }: RiskRadarProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Risk & Governance</h2>
          <p className="text-sm text-gray-500">Portfolio risk exposure and control status</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overall Risk + Trend */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">Portfolio Risk Score</h3>
            <RiskGauge score={data.overallRiskScore} level={data.overallRiskLevel} />
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">12-Week Risk Trend</h3>
            <RiskTrendChart data={data.riskTrend} />
          </div>
        </div>
        
        {/* Middle Column: Risk Exposures */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Risk Exposures</h3>
            <div className="space-y-3">
              {data.riskExposures.map((exposure, idx) => (
                <RiskExposureCard key={idx} exposure={exposure} />
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Column: Guardrails */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-slate-500" />
              <h3 className="text-sm font-semibold text-gray-700">Guardrail Status</h3>
            </div>
            <div className="space-y-2">
              {data.guardrails.map((guardrail, idx) => (
                <GuardrailCard key={idx} guardrail={guardrail} />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Systemic Risks */}
      {data.systemicRisks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Systemic Risks Requiring Attention
          </h3>
          <div className="space-y-3">
            {data.systemicRisks.map(risk => (
              <SystemicRiskAlert key={risk.id} risk={risk} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RiskRadar;
