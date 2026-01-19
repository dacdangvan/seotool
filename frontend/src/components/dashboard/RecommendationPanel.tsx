/**
 * Recommendation Panel Component
 * 
 * v0.7 - AI-powered SEO recommendations for managers
 */

'use client';

import { 
  Lightbulb, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Zap,
  Target
} from 'lucide-react';
import type { RecommendationData, Recommendation, ImpactLevel, EffortLevel, RiskLevel } from '@/types/dashboard';
import { cn, formatNumber, getLevelColor } from '@/lib/utils';

interface RecommendationPanelProps {
  data: RecommendationData;
}

interface LevelBadgeProps {
  level: ImpactLevel | EffortLevel | RiskLevel;
  label: string;
  type: 'impact' | 'effort' | 'risk';
}

function LevelBadge({ level, label, type }: LevelBadgeProps) {
  const colorClass = getLevelColor(level);
  
  const getIcon = () => {
    switch (type) {
      case 'impact':
        return <TrendingUp className="w-3 h-3" />;
      case 'effort':
        return <Clock className="w-3 h-3" />;
      case 'risk':
        return <AlertTriangle className="w-3 h-3" />;
    }
  };
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
      colorClass
    )}>
      {getIcon()}
      {label}: {level}
    </span>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  index: number;
}

function RecommendationCard({ recommendation, index }: RecommendationCardProps) {
  const categoryIcons = {
    technical: <Zap className="w-5 h-5 text-blue-600" />,
    content: <Lightbulb className="w-5 h-5 text-green-600" />,
    authority: <Target className="w-5 h-5 text-purple-600" />,
    monitoring: <TrendingUp className="w-5 h-5 text-orange-600" />,
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Priority Number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
          {index + 1}
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {categoryIcons[recommendation.category]}
              <h3 className="font-semibold text-gray-900">{recommendation.title}</h3>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-gray-600 mb-4">{recommendation.description}</p>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <LevelBadge level={recommendation.impact} label="Impact" type="impact" />
            <LevelBadge level={recommendation.effort} label="Effort" type="effort" />
            <LevelBadge level={recommendation.risk} label="Risk" type="risk" />
          </div>
          
          {/* Traffic Gain Estimate */}
          {recommendation.estimatedTrafficGain && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">Potential gain:</span>
              <span className="font-semibold text-green-600">
                +{formatNumber(recommendation.estimatedTrafficGain)} visits/month
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RecommendationPanel({ data }: RecommendationPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Recommendations</h2>
          <p className="text-sm text-gray-500">Top actions to improve your SEO</p>
        </div>
        
        {/* Summary Badge */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total opportunities</p>
            <p className="text-lg font-bold text-gray-900">{data.totalOpportunities}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Potential gain</p>
            <p className="text-lg font-bold text-green-600">+{formatNumber(data.potentialTrafficGain)}</p>
          </div>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-4">
        {data.topRecommendations.map((rec, index) => (
          <RecommendationCard 
            key={rec.id} 
            recommendation={rec} 
            index={index} 
          />
        ))}
      </div>

      {/* View All Link */}
      {data.totalOpportunities > data.topRecommendations.length && (
        <button className="flex items-center gap-1 mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View all {data.totalOpportunities} recommendations
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
