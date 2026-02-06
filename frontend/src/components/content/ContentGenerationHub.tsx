'use client';

/**
 * Content Generation Hub Component
 * 
 * Integrated hub for:
 * 1. AI Content Generation (Article)
 * 2. AI Image Generation
 * 3. Social Media Content Generation
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Image as ImageIcon,
  Share2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { AIContentWriter } from './AIContentWriter';
import { AIImageGenerator } from './AIImageGenerator';
import { SocialMediaGenerator } from './SocialMediaGenerator';
import type { FullContentBrief } from './ContentBriefGenerator';

type HubTab = 'content' | 'image' | 'social';

interface ContentGenerationHubProps {
  projectId: string;
  brief: FullContentBrief | null;
  existingContent?: string;
  onContentGenerated?: (content: any) => void;
  className?: string;
}

const TABS = [
  {
    id: 'content' as HubTab,
    name: 'Nội dung',
    description: 'Tạo bài viết SEO',
    icon: FileText,
    color: 'purple',
  },
  {
    id: 'image' as HubTab,
    name: 'Hình ảnh',
    description: 'Tạo ảnh minh họa',
    icon: ImageIcon,
    color: 'pink',
  },
  {
    id: 'social' as HubTab,
    name: 'Social Media',
    description: 'Đăng mạng xã hội',
    icon: Share2,
    color: 'blue',
  },
];

export function ContentGenerationHub({
  projectId,
  brief,
  existingContent,
  onContentGenerated,
  className,
}: ContentGenerationHubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('content');
  const [generatedArticle, setGeneratedArticle] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleContentGenerated = (content: any) => {
    // Extract title and content from generated markdown
    const lines = content.content?.split('\n') || [];
    const titleMatch = lines[0]?.match(/^#\s+(.+)/);
    const title = titleMatch ? titleMatch[1] : brief?.seo_targeting?.primary_keyword || 'Untitled';
    
    setGeneratedArticle({
      title,
      content: content.content || '',
    });
    
    onContentGenerated?.(content);
  };

  const handleImageGenerated = (imageUrl: string) => {
    setGeneratedImage(imageUrl);
  };

  const keyword = brief?.seo_targeting?.primary_keyword || '';
  const articleTitle = generatedArticle?.title || brief?.seo_targeting?.primary_keyword || '';
  const articleContent = generatedArticle?.content || '';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const colorClasses = {
            purple: isActive ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-purple-600',
            pink: isActive ? 'bg-pink-600 text-white' : 'text-gray-600 hover:text-pink-600',
            blue: isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600',
          };

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                colorClasses[tab.color as keyof typeof colorClasses]
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Workflow Indicator */}
      <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <div className="flex items-center gap-1 text-sm">
          <span className={cn(
            'font-medium',
            generatedArticle ? 'text-green-600' : 'text-gray-500'
          )}>
            1. Bài viết
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className={cn(
            'font-medium',
            generatedImage ? 'text-green-600' : 'text-gray-500'
          )}>
            2. Hình ảnh
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-500">
            3. Social
          </span>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          {generatedArticle && '✓ Đã tạo bài viết'}
          {generatedImage && ' • ✓ Đã tạo ảnh'}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'content' && (
          <AIContentWriter
            brief={brief}
            existingContent={existingContent}
            onContentGenerated={handleContentGenerated}
          />
        )}

        {activeTab === 'image' && (
          <AIImageGenerator
            projectId={projectId}
            keyword={keyword}
            articleTitle={articleTitle}
            onImageGenerated={handleImageGenerated}
          />
        )}

        {activeTab === 'social' && (
          <>
            {generatedArticle ? (
              <SocialMediaGenerator
                projectId={projectId}
                articleTitle={generatedArticle.title}
                articleContent={generatedArticle.content}
                keyword={keyword}
                articleUrl={`https://vib.com.vn/${keyword.toLowerCase().replace(/\s+/g, '-')}`}
                articleImage={generatedImage || undefined}
              />
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center">
                <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cần tạo bài viết trước
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-4">
                  Vui lòng tạo bài viết ở tab "Nội dung" trước khi tạo nội dung Social Media.
                </p>
                <button
                  onClick={() => setActiveTab('content')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Tạo bài viết
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ContentGenerationHub;
