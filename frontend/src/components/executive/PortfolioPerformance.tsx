/**
 * Portfolio Performance Component v1.8
 * 
 * Visual breakdown of project performance and allocation.
 * Board-friendly presentation of portfolio composition.
 */

'use client';

import { useState } from 'react';
import { PieChart, TrendingUp, TrendingDown, ChevronRight, Layers, Target } from 'lucide-react';
import type { PortfolioPerformanceData, ProjectClassification, ProjectPerformance } from '@/types/executive';

interface PortfolioPerformanceProps {
  data: PortfolioPerformanceData;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getClassificationStyle(classification: ProjectClassification): { bg: string; text: string; border: string } {
  switch (classification) {
    case 'growth_driver':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'stable_contributor':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'cautious_optimize':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'under_observation':
      return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    case 'turnaround':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'sunset_candidate':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

function formatClassificationLabel(classification: ProjectClassification): string {
  switch (classification) {
    case 'growth_driver': return 'Growth Driver';
    case 'stable_contributor': return 'Stable Contributor';
    case 'cautious_optimize': return 'Cautious Optimization';
    case 'under_observation': return 'Under Observation';
    case 'turnaround': return 'Turnaround';
    case 'sunset_candidate': return 'Sunset Candidate';
    default: return classification;
  }
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatROI(value: number): string {
  return `${value.toFixed(1)}x`;
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface AllocationBarProps {
  allocations: { label: string; percent: number; color: string }[];
}

function AllocationBar({ allocations }: AllocationBarProps) {
  return (
    <div className="w-full">
      <div className="h-8 rounded-lg overflow-hidden flex">
        {allocations.map((alloc, idx) => (
          <div
            key={idx}
            className="h-full flex items-center justify-center text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ 
              width: `${alloc.percent}%`, 
              backgroundColor: alloc.color,
              minWidth: alloc.percent > 0 ? '20px' : '0'
            }}
            title={`${alloc.label}: ${alloc.percent}%`}
          >
            {alloc.percent >= 10 && `${alloc.percent.toFixed(0)}%`}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ClassificationCardProps {
  label: string;
  color: string;
  projectCount: number;
  allocation: number;
  roi: number;
  onClick: () => void;
  isSelected: boolean;
}

function ClassificationCard({ label, color, projectCount, allocation, roi, onClick, isSelected }: ClassificationCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        isSelected 
          ? 'border-slate-400 bg-slate-50 shadow-md' 
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-gray-900">{label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-500">Projects</p>
          <p className="font-bold text-gray-900">{projectCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Allocation</p>
          <p className="font-bold text-gray-900">{allocation}%</p>
        </div>
        <div>
          <p className="text-gray-500">Avg ROI</p>
          <p className="font-bold text-gray-900">{formatROI(roi)}</p>
        </div>
      </div>
    </button>
  );
}

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

function MiniSparkline({ data, width = 80, height = 24 }: MiniSparklineProps) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const isPositive = data[data.length - 1] >= data[0];
  const strokeColor = isPositive ? '#10B981' : '#EF4444';
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ProjectRowProps {
  project: ProjectPerformance;
}

function ProjectRow({ project }: ProjectRowProps) {
  const style = getClassificationStyle(project.classification);
  const changeIcon = project.allocationChange > 0 ? (
    <TrendingUp className="w-3 h-3 text-emerald-500" />
  ) : project.allocationChange < 0 ? (
    <TrendingDown className="w-3 h-3 text-red-500" />
  ) : null;
  
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 truncate">{project.projectName}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                {formatClassificationLabel(project.classification)}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{project.domain}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Sparkline */}
          <div className="hidden sm:block">
            <MiniSparkline data={project.trafficTrend} />
          </div>
          
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 text-right min-w-[240px]">
            <div>
              <p className="text-xs text-gray-500">Allocation</p>
              <div className="flex items-center justify-end gap-1">
                <p className="font-bold text-gray-900">{project.allocationPercent}%</p>
                {changeIcon}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">ROI Score</p>
              <p className="font-bold text-gray-900">{project.roiScore}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Risk</p>
              <p className={`font-bold ${
                project.riskScore < 30 ? 'text-emerald-600' : 
                project.riskScore < 50 ? 'text-amber-600' : 'text-red-600'
              }`}>{project.riskScore}</p>
            </div>
          </div>
          
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>
      </div>
      
      {/* Executive Summary */}
      <p className="mt-3 text-sm text-gray-600 border-t border-gray-50 pt-3">
        {project.executiveSummary}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function PortfolioPerformance({ data }: PortfolioPerformanceProps) {
  const [selectedClassification, setSelectedClassification] = useState<string | null>(null);
  
  const filteredProjects = selectedClassification
    ? data.projects.filter(p => p.classification === selectedClassification)
    : data.projects;
  
  // Sort projects by allocation descending
  const sortedProjects = [...filteredProjects].sort((a, b) => b.allocationPercent - a.allocationPercent);
  
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Portfolio Performance</h2>
          <p className="text-sm text-gray-500">{data.totalProjects} projects across portfolio</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600">Diversification</span>
            <span className="font-bold text-slate-900">{data.diversificationScore}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
            <Target className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600">Concentration Risk</span>
            <span className="font-bold text-amber-900">{data.concentrationRisk}</span>
          </div>
        </div>
      </div>
      
      {/* Allocation Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Capital Allocation Distribution</h3>
        <AllocationBar
          allocations={data.classificationSummary.map(c => ({
            label: c.label,
            percent: c.totalAllocation,
            color: c.color,
          }))}
        />
        <div className="flex flex-wrap gap-4 mt-4">
          {data.classificationSummary.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-gray-600">{c.label}</span>
              <span className="font-medium text-gray-900">{c.totalAllocation}%</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Classification Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.classificationSummary.map((c, idx) => (
          <ClassificationCard
            key={idx}
            label={c.label}
            color={c.color}
            projectCount={c.projectCount}
            allocation={c.totalAllocation}
            roi={c.averageROI}
            onClick={() => setSelectedClassification(
              selectedClassification === c.classification ? null : c.classification
            )}
            isSelected={selectedClassification === c.classification}
          />
        ))}
      </div>
      
      {/* Project List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedClassification 
              ? `${formatClassificationLabel(selectedClassification as ProjectClassification)} Projects`
              : 'All Projects'}
          </h3>
          {selectedClassification && (
            <button
              onClick={() => setSelectedClassification(null)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Show all
            </button>
          )}
        </div>
        
        <div className="space-y-2">
          {sortedProjects.map(project => (
            <ProjectRow key={project.projectId} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default PortfolioPerformance;
