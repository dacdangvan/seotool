'use client';

/**
 * Keyword Filters Component
 * 
 * Advanced filtering UI for keyword list
 * - Intent filter
 * - Difficulty filter
 * - Opportunity filter
 * - Mapping status filter
 * - Volume range
 * - Difficulty range
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { 
  KeywordFilters as KeywordFiltersType,
  SearchIntent,
  KeywordDifficulty,
  OpportunityLevel,
} from '@/types/keyword.types';
import {
  SEARCH_INTENT_CONFIG,
  KEYWORD_DIFFICULTY_CONFIG,
  OPPORTUNITY_CONFIG,
} from '@/types/keyword.types';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';

interface KeywordFiltersProps {
  filters: KeywordFiltersType;
  onFilterChange: <K extends keyof KeywordFiltersType>(
    key: K,
    value: KeywordFiltersType[K]
  ) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  totalResults: number;
}

interface SelectFilterProps {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string }[];
  onChange: (value: string) => void;
}

function SelectFilter({ label, value, options, onChange }: SelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors',
          value !== 'all' 
            ? 'border-blue-300 bg-blue-50 text-blue-700' 
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        )}
      >
        <span className="text-gray-500">{label}:</span>
        <span className="font-medium">{selectedOption?.label || 'All'}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg',
                  value === option.value && 'bg-blue-50 text-blue-700'
                )}
              >
                {option.color && (
                  <span className={cn('inline-block w-2 h-2 rounded-full mr-2', option.color)} />
                )}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface RangeFilterProps {
  label: string;
  minValue?: number;
  maxValue?: number;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  step?: number;
}

function RangeFilter({ 
  label, 
  minValue, 
  maxValue, 
  onMinChange, 
  onMaxChange,
  minPlaceholder = 'Min',
  maxPlaceholder = 'Max',
  step = 1,
}: RangeFilterProps) {
  const hasValue = minValue !== undefined || maxValue !== undefined;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 whitespace-nowrap">{label}:</span>
      <input
        type="number"
        value={minValue ?? ''}
        onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
        placeholder={minPlaceholder}
        step={step}
        className={cn(
          'w-20 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
          hasValue ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
        )}
      />
      <span className="text-gray-400">-</span>
      <input
        type="number"
        value={maxValue ?? ''}
        onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
        placeholder={maxPlaceholder}
        step={step}
        className={cn(
          'w-20 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
          hasValue ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
        )}
      />
    </div>
  );
}

export function KeywordFilters({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  totalResults,
}: KeywordFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Intent options
  const intentOptions = [
    { value: 'all', label: 'All Intents' },
    ...Object.entries(SEARCH_INTENT_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
      color: config.bgColor,
    })),
  ];

  // Difficulty options
  const difficultyOptions = [
    { value: 'all', label: 'All Difficulties' },
    ...Object.entries(KEYWORD_DIFFICULTY_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
      color: config.bgColor,
    })),
  ];

  // Opportunity options
  const opportunityOptions = [
    { value: 'all', label: 'All Opportunities' },
    ...Object.entries(OPPORTUNITY_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
      color: config.bgColor,
    })),
  ];

  // Mapping status options
  const mappingOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'mapped', label: 'Mapped' },
    { value: 'unmapped', label: 'Unmapped' },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Primary Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Search keywords..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Intent Filter */}
        <SelectFilter
          label="Intent"
          value={filters.intent || 'all'}
          options={intentOptions}
          onChange={(v) => onFilterChange('intent', v as SearchIntent | 'all')}
        />

        {/* Opportunity Filter */}
        <SelectFilter
          label="Opportunity"
          value={filters.opportunity || 'all'}
          options={opportunityOptions}
          onChange={(v) => onFilterChange('opportunity', v as OpportunityLevel | 'all')}
        />

        {/* Mapping Status */}
        <SelectFilter
          label="Status"
          value={filters.mapped || 'all'}
          options={mappingOptions}
          onChange={(v) => onFilterChange('mapped', v as 'all' | 'mapped' | 'unmapped')}
        />

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors',
            showAdvanced 
              ? 'border-blue-300 bg-blue-50 text-blue-700' 
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Advanced
        </button>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {/* Difficulty Filter */}
          <SelectFilter
            label="Difficulty"
            value={filters.difficulty || 'all'}
            options={difficultyOptions}
            onChange={(v) => onFilterChange('difficulty', v as KeywordDifficulty | 'all')}
          />

          {/* Volume Range */}
          <RangeFilter
            label="Volume"
            minValue={filters.minVolume}
            maxValue={filters.maxVolume}
            onMinChange={(v) => onFilterChange('minVolume', v)}
            onMaxChange={(v) => onFilterChange('maxVolume', v)}
            minPlaceholder="0"
            maxPlaceholder="∞"
            step={100}
          />

          {/* Difficulty Range */}
          <RangeFilter
            label="Difficulty"
            minValue={filters.minDifficulty}
            maxValue={filters.maxDifficulty}
            onMinChange={(v) => onFilterChange('minDifficulty', v)}
            onMaxChange={(v) => onFilterChange('maxDifficulty', v)}
            minPlaceholder="0"
            maxPlaceholder="100"
            step={5}
          />
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Filter className="w-4 h-4" />
        <span>
          {hasActiveFilters ? (
            <>Showing <strong className="text-gray-900">{totalResults}</strong> filtered results</>
          ) : (
            <>Total <strong className="text-gray-900">{totalResults}</strong> keywords</>
          )}
        </span>
      </div>
    </div>
  );
}

export default KeywordFilters;
