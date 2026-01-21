/**
 * Forecast Chart Component
 * 
 * v0.7 - Traffic forecast visualization for managers
 */

'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, Info } from 'lucide-react';
import type { ForecastData } from '@/types/dashboard';
import { cn, formatNumber, formatCompact, formatDate, getTrendDisplay } from '@/lib/utils';

interface ForecastChartProps {
  data: ForecastData;
}

type TimeRange = '30d' | '60d' | '90d';

export function ForecastChart({ data }: ForecastChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isMounted, setIsMounted] = useState(false);

  // Fix SSR: Recharts requires browser environment
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const rangeConfig = {
    '30d': { days: 30, forecast: data.forecast30d },
    '60d': { days: 60, forecast: data.forecast60d },
    '90d': { days: 90, forecast: data.forecast90d },
  };
  
  const { days, forecast } = rangeConfig[timeRange];
  const chartData = data.dailyForecast.slice(0, days);
  
  // Format chart data
  const formattedChartData = chartData.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: point.date,
    predicted: point.predicted,
    lower: point.lower,
    upper: point.upper,
    range: [point.lower, point.upper],
  }));
  
  const trendDisplay = getTrendDisplay(data.trend);
  
  // Calculate change percent
  const changeValue = forecast.predicted - data.current;
  const changePercent = ((changeValue / data.current) * 100).toFixed(1);
  const isPositive = changeValue >= 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Traffic Forecast</h2>
          <p className="text-sm text-gray-500">Predicted organic traffic based on current trends</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-2 mt-4 lg:mt-0">
          {(['30d', '60d', '90d'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {range.replace('d', ' days')}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Current */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Current Traffic</p>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(data.current)}</p>
          <p className="text-sm text-gray-500">visits/month</p>
        </div>
        
        {/* Forecast */}
        <div className={cn(
          "rounded-lg p-4",
          isPositive ? "bg-green-50" : "bg-red-50"
        )}>
          <p className="text-sm text-gray-500 mb-1">{days}-Day Forecast</p>
          <p className={cn(
            "text-2xl font-bold",
            isPositive ? "text-green-700" : "text-red-700"
          )}>
            {formatNumber(forecast.predicted)}
          </p>
          <div className="flex items-center gap-1 text-sm">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className={isPositive ? "text-green-600" : "text-red-600"}>
              {isPositive ? '+' : ''}{changePercent}%
            </span>
          </div>
        </div>
        
        {/* Confidence */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Confidence</p>
          <p className="text-2xl font-bold text-blue-700">{Math.round(data.confidence * 100)}%</p>
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span className={`${trendDisplay.color}`}>{trendDisplay.icon}</span>
            <span>{trendDisplay.label} trend</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {!isMounted ? (
          <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
            <span className="text-gray-400">Loading chart...</span>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#93C5FD" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#93C5FD" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompact(value)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">{formatDate(data.fullDate)}</p>
                      <p className="text-sm text-blue-600">
                        Predicted: <span className="font-semibold">{formatNumber(data.predicted)}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Range: {formatNumber(data.lower)} - {formatNumber(data.upper)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Confidence interval area */}
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill="url(#colorRange)"
            />
            
            {/* Current value reference line */}
            <ReferenceLine
              y={data.current}
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              label={{
                value: 'Current',
                position: 'insideTopRight',
                fill: '#6B7280',
                fontSize: 11,
              }}
            />
            
            {/* Predicted line */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#colorPredicted)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Forecast based on historical trends and statistical models. Actual results may vary due to 
          algorithm updates, seasonality, and market changes. Confidence decreases for longer horizons.
        </p>
      </div>
    </div>
  );
}
