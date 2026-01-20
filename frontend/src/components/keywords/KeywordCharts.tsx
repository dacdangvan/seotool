'use client';

/**
 * Keyword Charts Component
 * 
 * Displays 3 charts for keyword analysis:
 * - Search Volume Distribution (bar chart)
 * - Keyword Difficulty Distribution (bar chart)
 * - Search Intent Breakdown (pie chart)
 * 
 * Manager-friendly visualization
 */

import React from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { KeywordChartData } from '@/types/keyword.types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { BarChart3, Target, Users } from 'lucide-react';

interface KeywordChartsProps {
  data: KeywordChartData;
  loading?: boolean;
}

// Chart colors
const VOLUME_COLOR = '#3b82f6'; // blue-500
const DIFFICULTY_COLORS = {
  easy: '#22c55e',      // green-500
  medium: '#f59e0b',    // amber-500
  hard: '#f97316',      // orange-500
  very_hard: '#ef4444', // red-500
};
const INTENT_COLORS = {
  informational: '#3b82f6', // blue-500
  commercial: '#8b5cf6',    // violet-500
  transactional: '#22c55e', // green-500
  navigational: '#6b7280',  // gray-500
};

const INTENT_LABELS = {
  informational: 'Tìm hiểu',
  commercial: 'So sánh',
  transactional: 'Mua hàng',
  navigational: 'Điều hướng',
};

const DIFFICULTY_LABELS = {
  easy: 'Dễ (0-30)',
  medium: 'Trung bình (31-60)',
  hard: 'Khó (61-80)',
  very_hard: 'Rất khó (81-100)',
};

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ChartCard({ title, icon, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div 
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-gray-200 rounded" />
            <div className="w-32 h-5 bg-gray-200 rounded" />
          </div>
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// Custom tooltip for volume chart
function VolumeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3">
      <p className="font-medium text-gray-900">{data.range}</p>
      <p className="text-sm text-gray-600">
        Số từ khóa: <span className="font-medium">{formatNumber(data.count)}</span>
      </p>
      <p className="text-sm text-gray-600">
        Tổng volume: <span className="font-medium">{formatCompact(data.totalVolume)}</span>
      </p>
    </div>
  );
}

// Custom tooltip for difficulty chart
function DifficultyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3">
      <p className="font-medium text-gray-900">
        {DIFFICULTY_LABELS[data.difficulty as keyof typeof DIFFICULTY_LABELS]}
      </p>
      <p className="text-sm text-gray-600">
        Số từ khóa: <span className="font-medium">{formatNumber(data.count)}</span>
      </p>
      <p className="text-sm text-gray-600">
        Tỷ lệ: <span className="font-medium">{data.percentage}%</span>
      </p>
    </div>
  );
}

// Custom tooltip for intent chart
function IntentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3">
      <p className="font-medium text-gray-900">
        {INTENT_LABELS[data.intent as keyof typeof INTENT_LABELS]}
      </p>
      <p className="text-sm text-gray-600">
        Số từ khóa: <span className="font-medium">{formatNumber(data.count)}</span>
      </p>
      <p className="text-sm text-gray-600">
        Tỷ lệ: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
      </p>
      <p className="text-sm text-gray-600">
        Search volume: <span className="font-medium">{formatCompact(data.searchVolume)}</span>
      </p>
    </div>
  );
}

export function KeywordCharts({ data, loading }: KeywordChartsProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Prepare difficulty data with labels
  const difficultyData = data.difficultyDistribution.map(item => ({
    ...item,
    label: DIFFICULTY_LABELS[item.difficulty as keyof typeof DIFFICULTY_LABELS],
  }));

  // Prepare intent data with labels
  const intentData = data.intentDistribution.map(item => ({
    ...item,
    label: INTENT_LABELS[item.intent as keyof typeof INTENT_LABELS],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Search Volume Distribution */}
      <ChartCard
        title="Phân bố lượng tìm kiếm"
        icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.searchVolumeDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="range" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<VolumeTooltip />} />
              <Bar 
                dataKey="count" 
                fill={VOLUME_COLOR} 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Keyword Difficulty Distribution */}
      <ChartCard
        title="Phân bố độ khó"
        icon={<Target className="w-5 h-5 text-amber-500" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={difficultyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis 
                type="category" 
                dataKey="label" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip content={<DifficultyTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {difficultyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={DIFFICULTY_COLORS[entry.difficulty as keyof typeof DIFFICULTY_COLORS]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Search Intent Breakdown */}
      <ChartCard
        title="Phân loại ý định tìm kiếm"
        icon={<Users className="w-5 h-5 text-violet-500" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={intentData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
                nameKey="label"
              >
                {intentData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={INTENT_COLORS[entry.intent as keyof typeof INTENT_COLORS]} 
                  />
                ))}
              </Pie>
              <Tooltip content={<IntentTooltip />} />
              <Legend 
                formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

export default KeywordCharts;
