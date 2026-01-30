'use client';

/**
 * Content Brief Card Component
 * Section 13: Auto-generate Content Briefs
 */

import React, { useState } from 'react';
import {
  ContentBrief,
  BriefStatus,
  ContentMode,
  SearchIntent,
  RiskLevel,
} from '@/types/content.types';
import {
  FileText,
  Target,
  Link2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
  ThumbsUp,
  Users,
  BookOpen,
} from 'lucide-react';

interface ContentBriefCardProps {
  brief: ContentBrief;
  onApprove?: (briefId: string) => void;
  onReject?: (briefId: string, reason?: string) => void;
  onEdit?: (briefId: string) => void;
  onRegenerate?: (briefId: string) => void;
  isExpanded?: boolean;
}

// Status badge component
function StatusBadge({ status }: { status: BriefStatus }) {
  const config: Record<BriefStatus, { icon: React.ElementType; color: string; label: string }> = {
    DRAFT: { icon: Edit3, color: 'text-gray-600 bg-gray-100', label: 'Draft' },
    PENDING_REVIEW: { icon: Clock, color: 'text-yellow-600 bg-yellow-100', label: 'Pending Review' },
    APPROVED: { icon: CheckCircle, color: 'text-green-600 bg-green-100', label: 'Approved' },
    REJECTED: { icon: XCircle, color: 'text-red-600 bg-red-100', label: 'Rejected' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

// Content mode badge
function ModeBadge({ mode }: { mode: ContentMode }) {
  const config: Record<ContentMode, { icon: React.ElementType; color: string; label: string }> = {
    CREATE: { icon: Zap, color: 'text-purple-600 bg-purple-100', label: 'Create New' },
    OPTIMIZE: { icon: RefreshCw, color: 'text-blue-600 bg-blue-100', label: 'Optimize Existing' },
    ASSIST: { icon: ThumbsUp, color: 'text-green-600 bg-green-100', label: 'AI Assist' },
  };

  const { icon: Icon, color, label } = config[mode];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Intent badge
function IntentBadge({ intent }: { intent: SearchIntent }) {
  const config: Record<SearchIntent, { color: string }> = {
    Informational: { color: 'text-blue-600 bg-blue-100' },
    Commercial: { color: 'text-orange-600 bg-orange-100' },
    Transactional: { color: 'text-green-600 bg-green-100' },
    Navigational: { color: 'text-purple-600 bg-purple-100' },
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config[intent].color}`}>
      {intent}
    </span>
  );
}

// Risk indicator
function RiskIndicator({ level, label }: { level: RiskLevel; label: string }) {
  const colors: Record<RiskLevel, string> = {
    LOW: 'text-green-600',
    MEDIUM: 'text-yellow-600',
    HIGH: 'text-red-600',
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${colors[level]}`}>{level}</span>
    </div>
  );
}

// Section component for expandable content
function BriefSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3 border-t bg-gray-50">{children}</div>}
    </div>
  );
}

// Main Brief Card component
export function ContentBriefCard({
  brief,
  onApprove,
  onReject,
  onEdit,
  onRegenerate,
  isExpanded = false,
}: ContentBriefCardProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ModeBadge mode={brief.content_mode} />
              <StatusBadge status={brief.status} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{brief.primary_keyword}</h3>
            <p className="text-sm text-gray-500 mt-1">{brief.objective}</p>
          </div>
        </div>

        {/* Quick info */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Target className="w-4 h-4" />
            <span>Intent: </span>
            <IntentBadge intent={brief.search_intent} />
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <FileText className="w-4 h-4" />
            <span>{brief.word_count_min}-{brief.word_count_max} words</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Users className="w-4 h-4" />
            <span>{brief.target_audience || 'General audience'}</span>
          </div>
        </div>
      </div>

      {/* Expandable content */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
        >
          <ChevronDown className="w-4 h-4" />
          Show Details
        </button>
      )}

      {expanded && (
        <div className="p-6 space-y-4">
          {/* Keywords */}
          <BriefSection title="Keywords & Entities" icon={Target}>
            <div className="pt-3 space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase">Primary Keyword</label>
                <p className="font-medium">{brief.primary_keyword}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Secondary Keywords</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {brief.secondary_keywords.map((kw, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-200 rounded text-sm">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              {brief.related_entities.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Related Entities</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brief.related_entities.map((entity, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </BriefSection>

          {/* Recommended Structure */}
          <BriefSection title="Recommended Structure" icon={BookOpen}>
            <div className="pt-3 space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase">Suggested H1</label>
                <p className="font-medium">{brief.recommended_structure.suggested_h1}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">H2 Outline</label>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  {brief.recommended_structure.h2_outline.map((h2, idx) => (
                    <li key={idx} className="text-sm">{h2}</li>
                  ))}
                </ol>
              </div>
              {brief.recommended_structure.mandatory_sections.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Mandatory Sections</label>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    {brief.recommended_structure.mandatory_sections.map((section, idx) => (
                      <li key={idx} className="text-sm text-green-700">{section}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </BriefSection>

          {/* Internal Links */}
          <BriefSection title="Internal Link Plan" icon={Link2}>
            <div className="pt-3 space-y-2">
              {brief.internal_links_plan.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No internal links planned</p>
              ) : (
                brief.internal_links_plan.map((link, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-white rounded">
                    {link.is_required ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 border rounded-full flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-blue-600">{link.url}</p>
                      <p className="text-gray-500">{link.anchor_guidance}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </BriefSection>

          {/* Risks */}
          <BriefSection title="Risk Assessment" icon={AlertTriangle}>
            <div className="pt-3 space-y-2">
              <RiskIndicator level={brief.cannibalization_risk} label="Cannibalization Risk" />
              <RiskIndicator level={brief.risks.brand} label="Brand Risk" />
              <RiskIndicator level={brief.risks.compliance} label="Compliance Risk" />
              <RiskIndicator level={brief.risks.technical} label="Technical Risk" />
            </div>
          </BriefSection>

          {/* Tone & Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="text-xs text-gray-500 uppercase">Tone</label>
              <p className="font-medium capitalize">{brief.tone}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="text-xs text-gray-500 uppercase">Formality</label>
              <p className="font-medium capitalize">{brief.formality}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="text-xs text-gray-500 uppercase">CTA Style</label>
              <p className="font-medium capitalize">{brief.cta_style}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="text-xs text-gray-500 uppercase">Reading Level</label>
              <p className="font-medium">{brief.reading_level || 'Standard'}</p>
            </div>
          </div>

          {/* Collapse button */}
          <button
            onClick={() => setExpanded(false)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
          >
            <ChevronUp className="w-4 h-4" />
            Collapse
          </button>
        </div>
      )}

      {/* Actions */}
      {(onApprove || onReject || onEdit || onRegenerate) && (
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <div className="flex gap-2">
            {onRegenerate && brief.status !== 'APPROVED' && (
              <button
                onClick={() => onRegenerate(brief.id)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            )}
            {onEdit && brief.status !== 'APPROVED' && (
              <button
                onClick={() => onEdit(brief.id)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onReject && brief.status === 'PENDING_REVIEW' && (
              <button
                onClick={() => onReject(brief.id)}
                className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
            {onApprove && brief.status === 'PENDING_REVIEW' && (
              <button
                onClick={() => onApprove(brief.id)}
                className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Mini brief card for lists
export function ContentBriefMini({ brief }: { brief: ContentBrief }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <ModeBadge mode={brief.content_mode} />
        <div>
          <p className="font-medium">{brief.primary_keyword}</p>
          <p className="text-sm text-gray-500">{brief.content_type}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <IntentBadge intent={brief.search_intent} />
        <StatusBadge status={brief.status} />
      </div>
    </div>
  );
}

export default ContentBriefCard;
