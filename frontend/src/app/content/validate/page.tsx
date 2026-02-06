'use client';

/**
 * SEO Content Validator Page
 * 
 * Validate existing content from URL or text input against SEO best practices
 */

import { Sidebar } from '@/components/Sidebar';
import { SEOContentValidator } from '@/components/content/SEOContentValidator';
import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';
import { ArrowLeft, FileSearch } from 'lucide-react';

function ValidatorPageContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/content"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Content
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SEO Content Validator</h1>
              <p className="text-gray-600 mt-1">
                Analyze any article or page for SEO optimization opportunities
              </p>
            </div>
          </div>
        </div>

        {/* SEO Tips Card */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">💡 SEO Best Practices Checklist</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium">Title Tag</p>
              <p className="text-blue-600">30-60 characters</p>
            </div>
            <div>
              <p className="font-medium">Meta Description</p>
              <p className="text-blue-600">120-160 characters</p>
            </div>
            <div>
              <p className="font-medium">Content Length</p>
              <p className="text-blue-600">1,500+ words recommended</p>
            </div>
            <div>
              <p className="font-medium">Keyword Density</p>
              <p className="text-blue-600">0.5-2.5% optimal</p>
            </div>
          </div>
        </div>

        {/* Main Validator Component */}
        <SEOContentValidator />

        {/* Additional Resources */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/content/generate"
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
          >
            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600">
              ✨ AI Content Writer
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate SEO-optimized content automatically
            </p>
          </Link>
          
          <Link
            href="/content/brief"
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all group"
          >
            <h3 className="font-semibold text-gray-900 group-hover:text-pink-600">
              📋 Brief Generator
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Create detailed content briefs for writers
            </p>
          </Link>
          
          <Link
            href="/crawl"
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
              🔍 Site Crawler
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Analyze all pages on your website
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ValidatorPage() {
  return (
    <RoleGuard requiredPermissions={['content:view']}>
      <ValidatorPageContent />
    </RoleGuard>
  );
}
