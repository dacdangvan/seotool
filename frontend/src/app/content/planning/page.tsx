'use client';

/**
 * Content Planning Page
 * 
 * Integrated Keyword → Content Engine planning view:
 * - Keywords awaiting content action
 * - Content Brief generation & management
 * - Cannibalization monitoring
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 12 – Keyword Research ↔ Content Engine Integration
 */

import { useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { Sidebar } from '@/components/Sidebar';
import { ContentPlanningView } from '@/components/content';
import {
  ArrowLeft,
  Sparkles,
  FileText,
  Target,
  Link2,
  AlertTriangle,
  RefreshCw,
  Settings,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function ContentPlanningPage() {
  const { currentProject } = useProject();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <Link 
              href="/content"
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors mt-1"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Content Planning</h1>
                <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI-Powered
                </span>
              </div>
              <p className="text-gray-600 mt-1">
                {currentProject 
                  ? `Keyword → Content strategy for ${currentProject.name}`
                  : 'Map keywords to content and generate AI-powered briefs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Sync Keywords
            </button>
          </div>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">How Content Planning Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-medium text-gray-900">Select Action</p>
                      <p className="text-gray-600">Choose Create, Optimize, or Map to Section for each keyword</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-medium text-gray-900">Generate Brief</p>
                      <p className="text-gray-600">AI creates a detailed content brief with outline and internal links</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-medium text-gray-900">Create Content</p>
                      <p className="text-gray-600">Use the approved brief to generate or optimize content</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  Got it, close this
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex items-center gap-4 mb-6">
          <Link 
            href="/keywords"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Target className="w-4 h-4 text-gray-500" />
            Keyword Research
          </Link>
          <Link 
            href="/content"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <FileText className="w-4 h-4 text-gray-500" />
            Content Library
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span>Review cannibalization warnings before creating new content</span>
          </div>
        </div>

        {/* Main Planning View */}
        <ContentPlanningView />
      </main>
    </div>
  );
}
