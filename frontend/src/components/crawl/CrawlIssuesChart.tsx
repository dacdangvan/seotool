'use client';

/**
 * CrawlIssuesChart Component
 * 
 * Horizontal bar chart showing SEO issue breakdown
 * Color-coded by severity, manager-friendly labels
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { IssueData, SEVERITY_COLORS } from '@/types/crawl-summary.types';

interface CrawlIssuesChartProps {
  data: IssueData[];
  title?: string;
  onIssueClick?: (issueType: string) => void;
}

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as IssueData;
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-100 max-w-xs">
        <p className="font-semibold text-gray-800">{data.label}</p>
        <p className="text-sm text-gray-600 mt-1">
          <span className="font-medium">{data.count}</span> pages affected
        </p>
        <p className="text-xs text-gray-500 mt-2">{data.description}</p>
      </div>
    );
  }
  return null;
};

// Severity icon
function SeverityIcon({ severity }: { severity: IssueData['severity'] }) {
  switch (severity) {
    case 'critical':
      return <AlertCircle size={16} className="text-red-500" />;
    case 'warning':
      return <AlertTriangle size={16} className="text-amber-500" />;
    case 'info':
      return <Info size={16} className="text-blue-500" />;
  }
}

// Issue list item
function IssueListItem({ issue, onClick }: { issue: IssueData; onClick?: () => void }) {
  const severityClasses = {
    critical: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    info: 'border-blue-200 bg-blue-50',
  };

  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-lg border
        ${severityClasses[issue.severity]}
        ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-3">
        <SeverityIcon severity={issue.severity} />
        <div>
          <p className="text-sm font-medium text-gray-800">{issue.label}</p>
          <p className="text-xs text-gray-500">{issue.description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-gray-800">{issue.count}</p>
        <p className="text-xs text-gray-500">pages</p>
      </div>
    </div>
  );
}

export function CrawlIssuesChart({ data, title = 'SEO Issues', onIssueClick }: CrawlIssuesChartProps) {
  // Sort by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const totalIssues = data.reduce((sum, d) => sum + d.count, 0);
  const criticalCount = data.filter(d => d.severity === 'critical').reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={32} className="text-green-500" />
            </div>
            <p className="text-gray-600 font-medium">No issues found!</p>
            <p className="text-sm text-gray-400">Your site is in great shape</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
              {criticalCount} Critical
            </span>
          )}
          <span className="text-sm text-gray-500">
            {totalIssues} total issues
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData.slice(0, 6) as any[]}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="label" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={110}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            >
              {sortedData.slice(0, 6).map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={SEVERITY_COLORS[entry.severity]}
                  cursor={onIssueClick ? 'pointer' : 'default'}
                  onClick={() => onIssueClick?.(entry.type)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Severity legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-gray-600">Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-gray-600">Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-600">Info</span>
        </div>
      </div>

      {/* Issue list for detail */}
      <div className="mt-6 space-y-2">
        <p className="text-sm font-medium text-gray-600 mb-3">Issue Details</p>
        {sortedData.map((issue) => (
          <IssueListItem
            key={issue.type}
            issue={issue}
            onClick={onIssueClick ? () => onIssueClick(issue.type) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default CrawlIssuesChart;
