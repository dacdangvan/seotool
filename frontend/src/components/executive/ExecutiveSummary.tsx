/**
 * Executive Summary Component v1.8
 * 
 * Auto-generated narrative summary for board presentations.
 * Non-technical, business-oriented, actionable insights.
 */

'use client';

import { useState } from 'react';
import { 
  FileText, 
  Lightbulb, 
  AlertTriangle, 
  Trophy, 
  Eye, 
  Target,
  ChevronRight,
  Download,
  Copy,
  CheckCircle,
  Clock
} from 'lucide-react';
import type { ExecutiveSummaryData, KeyInsight, StrategicRecommendation } from '@/types/executive';

interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getInsightIcon(category: string) {
  switch (category) {
    case 'opportunity':
      return <Lightbulb className="w-5 h-5 text-blue-500" />;
    case 'risk':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'achievement':
      return <Trophy className="w-5 h-5 text-emerald-500" />;
    case 'attention':
      return <Eye className="w-5 h-5 text-purple-500" />;
    default:
      return <Lightbulb className="w-5 h-5 text-gray-500" />;
  }
}

function getInsightStyle(category: string): string {
  switch (category) {
    case 'opportunity':
      return 'bg-blue-50 border-blue-200';
    case 'risk':
      return 'bg-amber-50 border-amber-200';
    case 'achievement':
      return 'bg-emerald-50 border-emerald-200';
    case 'attention':
      return 'bg-purple-50 border-purple-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

function getInsightLabel(category: string): string {
  switch (category) {
    case 'opportunity': return 'Opportunity';
    case 'risk': return 'Risk';
    case 'achievement': return 'Achievement';
    case 'attention': return 'Attention';
    default: return 'Insight';
  }
}

function getImpactBadge(impact: string): { bg: string; text: string } {
  switch (impact) {
    case 'high':
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'medium':
      return { bg: 'bg-amber-100', text: 'text-amber-700' };
    case 'low':
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface NarrativeSectionProps {
  content: string;
}

function NarrativeSection({ content }: NarrativeSectionProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      // Strip markdown for clipboard
      const plainText = content
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s/g, '');
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  // Simple markdown to HTML conversion for bold text
  const formatMarkdown = (text: string) => {
    return text
      .split('\n\n')
      .map((paragraph, idx) => {
        // Convert **text** to bold
        const formatted = paragraph.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return (
          <p 
            key={idx} 
            className="mb-4 last:mb-0"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      });
  };
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-gray-900">Executive Narrative</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
      
      <div className="p-6 text-gray-700 leading-relaxed prose prose-slate max-w-none">
        {formatMarkdown(content)}
      </div>
    </div>
  );
}

interface InsightCardProps {
  insight: KeyInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  const impactStyle = getImpactBadge(insight.impact);
  
  return (
    <div className={`p-4 rounded-xl border ${getInsightStyle(insight.category)}`}>
      <div className="flex items-start gap-3">
        {getInsightIcon(insight.category)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {getInsightLabel(insight.category)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impactStyle.bg} ${impactStyle.text}`}>
              {insight.impact.charAt(0).toUpperCase() + insight.impact.slice(1)} Impact
            </span>
            {insight.actionable && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                Actionable
              </span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
          <p className="text-sm text-gray-600">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

interface RecommendationCardProps {
  recommendation: StrategicRecommendation;
  index: number;
}

function RecommendationCard({ recommendation, index }: RecommendationCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* Priority indicator */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          index === 0 ? 'bg-red-100 text-red-700' :
          index === 1 ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          <span className="text-lg font-bold">{recommendation.priority}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-2">{recommendation.title}</h4>
          <p className="text-sm text-gray-600 mb-3">{recommendation.description}</p>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Expected Outcome</p>
                <p className="text-gray-700">{recommendation.expectedOutcome}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Timeframe</p>
                <p className="text-gray-700">{recommendation.timeframe}</p>
              </div>
            </div>
          </div>
          
          {recommendation.requiredDecision && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700 font-medium">Decision Required: </span>
                <span className="text-gray-600">{recommendation.requiredDecision}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Executive Summary</h2>
          <p className="text-sm text-gray-500">{data.periodCovered}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Generated: {formatDate(data.generatedAt)}</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs capitalize">
            {data.dataFreshness} data
          </span>
        </div>
      </div>
      
      {/* Narrative Summary */}
      <NarrativeSection content={data.narrativeSummary} />
      
      {/* Key Insights */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-gray-500" />
          Key Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.keyInsights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </div>
      
      {/* Strategic Recommendations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-500" />
          Strategic Recommendations
        </h3>
        <div className="space-y-4">
          {data.recommendations.map((rec, idx) => (
            <RecommendationCard key={rec.id} recommendation={rec} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummary;
