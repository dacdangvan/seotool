'use client';

/**
 * Content QA Result Component
 * Section 16: Automated Content QA & SEO Validation
 */

import React from 'react';
import {
  ContentQAResult,
  QALayerResult,
  QAIssue,
  QAStatus,
  IssueSeverity,
} from '@/types/content.types';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  Target,
  Shield,
  Settings,
} from 'lucide-react';

interface QAResultProps {
  qaResult: ContentQAResult;
  onRevalidate?: () => void;
}

// Status badge component
function StatusBadge({ status }: { status: QAStatus }) {
  const config = {
    PASS: { icon: CheckCircle, color: 'text-green-600 bg-green-100', label: 'Passed' },
    WARN: { icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-100', label: 'Warning' },
    FAIL: { icon: XCircle, color: 'text-red-600 bg-red-100', label: 'Failed' },
    PENDING: { icon: Info, color: 'text-gray-600 bg-gray-100', label: 'Pending' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

// Severity badge component
function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const config = {
    BLOCKING: { color: 'text-red-600 bg-red-100', label: 'Blocking' },
    WARNING: { color: 'text-yellow-600 bg-yellow-100', label: 'Warning' },
    INFO: { color: 'text-blue-600 bg-blue-100', label: 'Info' },
  };

  const { color, label } = config[severity];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// Score circle component
function ScoreCircle({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const sizes = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-24 h-24 text-2xl',
  };

  return (
    <div
      className={`${sizes[size]} ${getColor(score)} rounded-full border-4 border-current flex items-center justify-center font-bold`}
    >
      {Math.round(score)}
    </div>
  );
}

// Issue list component
function IssueList({ issues }: { issues: QAIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-gray-500 text-sm italic">No issues found</p>
    );
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <SeverityBadge severity={issue.severity} />
          <div className="flex-1">
            <p className="text-gray-900">{issue.message}</p>
            {issue.suggestion && (
              <p className="text-gray-500 mt-0.5 text-xs">
                💡 {issue.suggestion}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Layer card component
function LayerCard({
  title,
  icon: Icon,
  layer,
  isExpanded,
  onToggle,
}: {
  title: string;
  icon: React.ElementType;
  layer: QALayerResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-medium">{title}</span>
          <StatusBadge status={layer.status} />
        </div>
        <div className="flex items-center gap-3">
          <ScoreCircle score={layer.score} size="sm" />
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          <div className="pt-4">
            <IssueList issues={layer.issues} />
          </div>
        </div>
      )}
    </div>
  );
}

// Main QA Result component
export function QAResultPanel({ qaResult, onRevalidate }: QAResultProps) {
  const [expandedLayers, setExpandedLayers] = React.useState<string[]>([]);

  const toggleLayer = (layer: string) => {
    setExpandedLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
    );
  };

  const layers = [
    { key: 'structure', title: 'Structure', icon: FileText, data: qaResult.structure },
    { key: 'seo', title: 'SEO', icon: Search, data: qaResult.seo },
    { key: 'intent', title: 'Intent & Coverage', icon: Target, data: qaResult.intent },
    { key: 'brand', title: 'Brand & Compliance', icon: Shield, data: qaResult.brand },
    { key: 'technical', title: 'Technical', icon: Settings, data: qaResult.technical },
  ];

  const canExport = qaResult.qa_status !== 'FAIL' && qaResult.blocking_issues_count === 0;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Content QA Report</h2>
            <p className="text-blue-100 text-sm mt-1">
              Section 16: 5-Layer Validation
            </p>
          </div>
          <ScoreCircle score={qaResult.overall_score} size="lg" />
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-600">Overall Status:</span>
            <StatusBadge status={qaResult.qa_status} />
          </div>
          {onRevalidate && (
            <button
              onClick={onRevalidate}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Re-validate
            </button>
          )}
        </div>

        {/* Issue counts */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{qaResult.blocking_issues_count}</p>
            <p className="text-sm text-red-600">Blocking</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{qaResult.warning_issues_count}</p>
            <p className="text-sm text-yellow-600">Warnings</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{qaResult.info_issues_count}</p>
            <p className="text-sm text-blue-600">Info</p>
          </div>
        </div>

        {/* Export readiness */}
        <div className={`mt-4 p-3 rounded-lg ${canExport ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-2">
            {canExport ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium">Ready for CMS Export</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">Not ready - fix blocking issues first</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Layer results */}
      <div className="p-6 space-y-3">
        <h3 className="font-semibold text-gray-900 mb-4">Validation Layers</h3>
        {layers.map(({ key, title, icon, data }) => (
          <LayerCard
            key={key}
            title={title}
            icon={icon}
            layer={data}
            isExpanded={expandedLayers.includes(key)}
            onToggle={() => toggleLayer(key)}
          />
        ))}
      </div>

      {/* All issues */}
      {qaResult.all_issues.length > 0 && (
        <div className="p-6 border-t bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-4">
            All Issues ({qaResult.all_issues.length})
          </h3>
          <IssueList issues={qaResult.all_issues} />
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-100 text-sm text-gray-500">
        Validated at: {new Date(qaResult.validated_at).toLocaleString()}
      </div>
    </div>
  );
}

// Mini QA badge for lists
export function QAStatusBadge({ qaResult }: { qaResult: ContentQAResult }) {
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={qaResult.qa_status} />
      <span className="text-sm text-gray-500">
        Score: {Math.round(qaResult.overall_score)}
      </span>
    </div>
  );
}

// Export gate indicator
export function ExportGateIndicator({ 
  briefApproved, 
  contentApproved, 
  qaPassed 
}: { 
  briefApproved: boolean;
  contentApproved: boolean;
  qaPassed: boolean;
}) {
  const gates = [
    { label: 'Brief', passed: briefApproved },
    { label: 'Content', passed: contentApproved },
    { label: 'QA', passed: qaPassed },
  ];

  const allPassed = gates.every(g => g.passed);

  return (
    <div className="flex items-center gap-2">
      {gates.map((gate, idx) => (
        <React.Fragment key={gate.label}>
          <div className="flex items-center gap-1">
            {gate.passed ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-xs ${gate.passed ? 'text-green-700' : 'text-red-700'}`}>
              {gate.label}
            </span>
          </div>
          {idx < gates.length - 1 && (
            <span className="text-gray-300">→</span>
          )}
        </React.Fragment>
      ))}
      <span className={`ml-2 text-xs font-medium ${allPassed ? 'text-green-600' : 'text-red-600'}`}>
        {allPassed ? 'Ready to Export' : 'Not Ready'}
      </span>
    </div>
  );
}

export default QAResultPanel;
