'use client';

/**
 * CrawlStatusChart Component
 * 
 * Donut chart showing HTTP status code distribution
 * Manager-friendly labels
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { StatusCodeData } from '@/types/crawl-summary.types';

interface CrawlStatusChartProps {
  data: StatusCodeData[];
  title?: string;
}

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as StatusCodeData;
    const percentage = typeof data.percentage === 'string' ? parseFloat(data.percentage) : data.percentage;
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-100">
        <p className="font-semibold text-gray-800">{data.label}</p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{data.count.toLocaleString()}</span> pages
        </p>
        <p className="text-sm text-gray-500">
          {percentage.toFixed(1)}% of total
        </p>
      </div>
    );
  }
  return null;
};

// Custom legend
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-600">
            {entry.payload.label}
          </span>
          <span className="text-sm font-medium text-gray-800">
            ({entry.payload.count})
          </span>
        </div>
      ))}
    </div>
  );
};

export function CrawlStatusChart({ data, title = 'Status Code Distribution' }: CrawlStatusChartProps) {
  const totalPages = data.reduce((sum, d) => sum + d.count, 0);
  const successRateRaw = data.find(d => d.code === '2xx')?.percentage || 0;
  const successRate = typeof successRateRaw === 'string' ? parseFloat(successRateRaw) : successRateRaw;

  if (data.length === 0 || totalPages === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No crawl data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          successRate >= 95 ? 'bg-green-100 text-green-700' :
          successRate >= 80 ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {successRate.toFixed(0)}% Success Rate
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data as any[]}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="count"
              nameKey="label"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center label */}
      <div className="text-center -mt-36 mb-24 pointer-events-none">
        <p className="text-3xl font-bold text-gray-800">{totalPages.toLocaleString()}</p>
        <p className="text-sm text-gray-500">Total Pages</p>
      </div>
    </div>
  );
}

export default CrawlStatusChart;
