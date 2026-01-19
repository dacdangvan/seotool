/**
 * Automation Transparency Component v1.8
 * 
 * Shows AI vs human work distribution and control indicators.
 * Provides trust and oversight visibility for board members.
 */

'use client';

import { useState } from 'react';
import { 
  Bot, 
  User, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  RotateCcw, 
  Shield,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import type { AutomationMetrics } from '@/types/executive';

interface AutomationTransparencyProps {
  data: AutomationMetrics;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'enabled':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'limited':
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    case 'disabled':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'enabled':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'limited':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'disabled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface WorkDistributionProps {
  aiPercent: number;
  humanPercent: number;
}

function WorkDistribution({ aiPercent, humanPercent }: WorkDistributionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Work Distribution</h3>
      
      {/* Visual bar */}
      <div className="h-12 rounded-xl overflow-hidden flex mb-4">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center"
          style={{ width: `${aiPercent}%` }}
        >
          <div className="flex items-center gap-2 text-white font-semibold">
            <Bot className="w-5 h-5" />
            <span>{aiPercent}%</span>
          </div>
        </div>
        <div 
          className="h-full bg-gradient-to-r from-slate-400 to-slate-300 flex items-center justify-center"
          style={{ width: `${humanPercent}%` }}
        >
          <div className="flex items-center gap-2 text-white font-semibold">
            <User className="w-5 h-5" />
            <span>{humanPercent}%</span>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-gray-600">AI-Assisted Operations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-400" />
          <span className="text-gray-600">Human-Led Operations</span>
        </div>
      </div>
    </div>
  );
}

interface TaskBreakdownProps {
  breakdown: { taskType: string; aiPercent: number; humanPercent: number; totalTasks: number }[];
}

function TaskBreakdown({ breakdown }: TaskBreakdownProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Task Breakdown by Category</h3>
      
      <div className="space-y-4">
        {breakdown.map((task, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 font-medium">{task.taskType}</span>
              <span className="text-gray-500">{formatNumber(task.totalTasks)} tasks</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
              <div 
                className="h-full bg-blue-400"
                style={{ width: `${task.aiPercent}%` }}
                title={`AI: ${task.aiPercent}%`}
              />
              <div 
                className="h-full bg-slate-300"
                style={{ width: `${task.humanPercent}%` }}
                title={`Human: ${task.humanPercent}%`}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>AI: {task.aiPercent}%</span>
              <span>Human: {task.humanPercent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AutoExecutionStatsProps {
  stats: { total: number; successful: number; rolledBack: number; period: string };
}

function AutoExecutionStats({ stats }: AutoExecutionStatsProps) {
  const successRate = stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(1) : '0';
  const rollbackRate = stats.total > 0 ? ((stats.rolledBack / stats.total) * 100).toFixed(2) : '0';
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Auto-Execution Summary</h3>
      <p className="text-xs text-gray-500 mb-4">{stats.period}</p>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-slate-900">{formatNumber(stats.total)}</p>
          <p className="text-xs text-slate-600 mt-1">Total Actions</p>
        </div>
        <div className="text-center p-4 bg-emerald-50 rounded-xl">
          <p className="text-2xl font-bold text-emerald-700">{successRate}%</p>
          <p className="text-xs text-emerald-600 mt-1">Success Rate</p>
        </div>
        <div className="text-center p-4 bg-amber-50 rounded-xl">
          <p className="text-2xl font-bold text-amber-700">{stats.rolledBack}</p>
          <p className="text-xs text-amber-600 mt-1">Rollbacks ({rollbackRate}%)</p>
        </div>
      </div>
      
      {/* Note */}
      <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
        <CheckCircle className="w-3 h-3 text-emerald-500" />
        Only low-risk actions are auto-executed
      </p>
    </div>
  );
}

interface TrustScoreProps {
  score: number;
}

function TrustScore({ score }: TrustScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-emerald-600';
    if (s >= 70) return 'text-blue-600';
    if (s >= 50) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Fair';
    return 'Needs Attention';
  };
  
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-semibold text-gray-700">Trust & Control Score</h3>
      </div>
      
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke={score >= 90 ? '#10B981' : score >= 70 ? '#3B82F6' : score >= 50 ? '#F59E0B' : '#EF4444'}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(score / 100) * 352} 352`}
              strokeLinecap="round"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
            <span className="text-xs text-gray-500">{getScoreLabel(score)}</span>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 text-center">
        Based on guardrail compliance, rollback rate, and human oversight levels
      </p>
    </div>
  );
}

interface ControlIndicatorsProps {
  indicators: { name: string; status: string; description: string }[];
}

function ControlIndicators({ indicators }: ControlIndicatorsProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Control Indicators</h3>
      
      <div className="space-y-3">
        {indicators.map((indicator, idx) => (
          <div 
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusStyle(indicator.status)}`}
          >
            {getStatusIcon(indicator.status)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{indicator.name}</p>
              <p className="text-xs opacity-80 truncate">{indicator.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RollbackIncidentsProps {
  incidents: { date: string; reason: string; impact: string; resolved: boolean }[];
}

function RollbackIncidents({ incidents }: RollbackIncidentsProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (incidents.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">No Rollback Incidents</p>
            <p className="text-sm text-emerald-600">All automated actions completed successfully</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <RotateCcw className="w-5 h-5 text-amber-500" />
          <div>
            <p className="font-medium text-gray-900">Rollback Incidents</p>
            <p className="text-sm text-gray-500">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} in reporting period</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {incidents.map((incident, idx) => (
            <div key={idx} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{incident.reason}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  incident.resolved 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {incident.resolved ? 'Resolved' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                {new Date(incident.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-gray-600">Impact: {incident.impact}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function AutomationTransparency({ data }: AutomationTransparencyProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Automation Transparency</h2>
          <p className="text-sm text-gray-500">AI operations oversight and control status</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-700 font-medium">{data.aiWorkPercent}% AI-Assisted</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <WorkDistribution 
            aiPercent={data.aiWorkPercent} 
            humanPercent={data.humanWorkPercent} 
          />
          <TrustScore score={data.trustScore} />
        </div>
        
        {/* Middle Column */}
        <div className="space-y-6">
          <TaskBreakdown breakdown={data.taskBreakdown} />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          <AutoExecutionStats stats={data.autoExecuted} />
          <ControlIndicators indicators={data.controlIndicators} />
        </div>
      </div>
      
      {/* Rollback Incidents */}
      <RollbackIncidents incidents={data.rollbackIncidents} />
    </div>
  );
}

export default AutomationTransparency;
