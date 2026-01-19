/**
 * SEO Health Panel Component
 * 
 * v0.7 - Health status and risk alerts for managers
 */

'use client';

import { useState } from 'react';
import { 
  Shield, 
  FileText, 
  Network, 
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import type { SEOHealthData, HealthItem, RiskAlert, HealthStatus } from '@/types/dashboard';
import { cn, getStatusColor, getPriorityColor, formatRelativeTime } from '@/lib/utils';

interface SEOHealthPanelProps {
  data: SEOHealthData;
}

interface HealthCardProps {
  item: HealthItem;
  icon: React.ReactNode;
}

function getStatusIcon(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'critical':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Shield className="w-5 h-5 text-gray-400" />;
  }
}

function HealthCard({ item, icon }: HealthCardProps) {
  const statusColors = getStatusColor(item.status);
  
  return (
    <div className={cn(
      "bg-white rounded-lg border p-4 transition-all hover:shadow-sm",
      statusColors.includes('green') ? 'border-green-200' :
      statusColors.includes('yellow') ? 'border-yellow-200' :
      statusColors.includes('red') ? 'border-red-200' : 'border-gray-200'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-900">{item.name}</span>
        </div>
        {getStatusIcon(item.status)}
      </div>
      
      {/* Score Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Score</span>
          <span className="font-semibold">{item.score}/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              item.score >= 80 ? 'bg-green-500' :
              item.score >= 60 ? 'bg-yellow-500' :
              item.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
            )}
            style={{ width: `${item.score}%` }}
          />
        </div>
      </div>
      
      <p className="text-sm text-gray-600">{item.description}</p>
      
      {item.issues > 0 && (
        <div className="mt-3 flex items-center gap-1 text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
          <AlertTriangle className="w-4 h-4" />
          <span>{item.issues} issue{item.issues > 1 ? 's' : ''} to review</span>
        </div>
      )}
    </div>
  );
}

interface AlertCardProps {
  alert: RiskAlert;
}

function AlertCard({ alert }: AlertCardProps) {
  const priorityColor = getPriorityColor(alert.priority);
  
  return (
    <div className={cn(
      "bg-white rounded-lg border p-4",
      priorityColor.includes('red') ? 'border-red-200' :
      priorityColor.includes('orange') ? 'border-orange-200' :
      priorityColor.includes('yellow') ? 'border-yellow-200' : 'border-blue-200'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
            priorityColor
          )}>
            {alert.priority}
          </span>
          <span className="text-gray-900 font-medium">{alert.title}</span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{formatRelativeTime(alert.detectedAt)}</span>
        </div>
        <span className="text-gray-700">{alert.impact}</span>
      </div>
    </div>
  );
}

export function SEOHealthPanel({ data }: SEOHealthPanelProps) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  
  const displayedAlerts = showAllAlerts 
    ? data.activeAlerts 
    : data.activeAlerts.slice(0, 2);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">SEO Health & Risks</h2>
          <p className="text-sm text-gray-500">Status of key SEO areas</p>
        </div>
        
        {/* Overall Score Badge */}
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          data.overall.status === 'healthy' ? 'bg-green-100 text-green-700' :
          data.overall.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        )}>
          {getStatusIcon(data.overall.status)}
          <span className="font-semibold">{data.overall.score}/100</span>
        </div>
      </div>

      {/* Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <HealthCard 
          item={data.technical} 
          icon={<Shield className="w-5 h-5 text-blue-600" />} 
        />
        <HealthCard 
          item={data.content} 
          icon={<FileText className="w-5 h-5 text-green-600" />} 
        />
        <HealthCard 
          item={data.authority} 
          icon={<Network className="w-5 h-5 text-purple-600" />} 
        />
        <HealthCard 
          item={data.monitoring} 
          icon={<Bell className="w-5 h-5 text-orange-600" />} 
        />
      </div>

      {/* Active Alerts */}
      {data.activeAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-medium text-gray-900">
              Active Alerts ({data.activeAlerts.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {displayedAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
          
          {data.activeAlerts.length > 2 && (
            <button
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showAllAlerts ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all {data.activeAlerts.length} alerts
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
