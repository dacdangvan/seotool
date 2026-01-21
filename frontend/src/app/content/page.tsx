'use client';

/**
 * Content Management Page
 * 
 * v0.8 - SEO Content CRUD with status workflow + Planning integration
 * 
 * Added Section 12 integration link to Content Planning
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import { RoleGuard, useCanAccess } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { SEOContent, ContentStatus, ContentCreateInput } from '@/types/auth';
import {
  Plus,
  FileText,
  Search,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  Send,
  AlertCircle,
  Sparkles,
  Target,
  ArrowRight,
} from 'lucide-react';

// Mock content data
const MOCK_CONTENT: SEOContent[] = [
  {
    id: 'content-1',
    projectId: 'project-1',
    title: 'Hướng dẫn mở tài khoản ngân hàng online',
    slug: 'huong-dan-mo-tai-khoan-ngan-hang-online',
    status: 'published',
    primaryKeyword: 'mở tài khoản ngân hàng online',
    content: '...',
    metaTitle: 'Hướng dẫn mở tài khoản ngân hàng online 2024',
    metaDescription: 'Tìm hiểu cách mở tài khoản ngân hàng online nhanh chóng...',
    createdBy: 'user-2',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-10T10:00:00Z',
  },
  {
    id: 'content-2',
    projectId: 'project-1',
    title: 'So sánh lãi suất tiết kiệm các ngân hàng',
    slug: 'so-sanh-lai-suat-tiet-kiem',
    status: 'review',
    primaryKeyword: 'lãi suất tiết kiệm',
    content: '...',
    metaTitle: 'So sánh lãi suất tiết kiệm các ngân hàng tháng 3/2024',
    metaDescription: 'Bảng so sánh lãi suất tiết kiệm mới nhất...',
    createdBy: 'user-2',
    createdAt: '2024-03-05T00:00:00Z',
    updatedAt: '2024-03-12T14:00:00Z',
  },
  {
    id: 'content-3',
    projectId: 'project-1',
    title: 'Cách đăng ký thẻ tín dụng VIB',
    slug: 'cach-dang-ky-the-tin-dung-vib',
    status: 'draft',
    primaryKeyword: 'thẻ tín dụng VIB',
    content: '...',
    createdBy: 'user-2',
    createdAt: '2024-03-14T00:00:00Z',
    updatedAt: '2024-03-14T00:00:00Z',
  },
  {
    id: 'content-4',
    projectId: 'project-1',
    title: 'Ưu đãi vay mua nhà tháng 3',
    slug: 'uu-dai-vay-mua-nha-thang-3',
    status: 'approved',
    primaryKeyword: 'vay mua nhà',
    content: '...',
    metaTitle: 'Ưu đãi vay mua nhà VIB - Lãi suất từ 6.5%',
    metaDescription: 'Chương trình ưu đãi vay mua nhà với lãi suất hấp dẫn...',
    createdBy: 'user-2',
    createdAt: '2024-03-08T00:00:00Z',
    updatedAt: '2024-03-13T16:00:00Z',
  },
];

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  review: { label: 'In Review', color: 'bg-yellow-100 text-yellow-700', icon: Eye },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  published: { label: 'Published', color: 'bg-green-100 text-green-700', icon: Send },
};

function ContentPageContent() {
  const { currentProject } = useProject();
  const { isAdmin } = useCanAccess();
  
  const [content, setContent] = useState<SEOContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContent, setEditingContent] = useState<SEOContent | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Load content
  useEffect(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const filtered = MOCK_CONTENT.filter(c => 
        !currentProject || c.projectId === currentProject.id
      );
      setContent(filtered);
      setIsLoading(false);
    }, 500);
  }, [currentProject]);

  // Filter content
  const filteredContent = content.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.primaryKeyword.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group by status
  const contentByStatus = {
    draft: filteredContent.filter(c => c.status === 'draft'),
    review: filteredContent.filter(c => c.status === 'review'),
    approved: filteredContent.filter(c => c.status === 'approved'),
    published: filteredContent.filter(c => c.status === 'published'),
  };

  const handleStatusChange = (contentId: string, newStatus: ContentStatus) => {
    setContent(prev => 
      prev.map(c => c.id === contentId ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c)
    );
    setOpenMenuId(null);
  };

  const handleDelete = (contentId: string) => {
    if (confirm('Are you sure you want to delete this content?')) {
      setContent(prev => prev.filter(c => c.id !== contentId));
    }
    setOpenMenuId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content</h1>
            <p className="text-gray-600 mt-1">
              {currentProject ? `Managing content for ${currentProject.name}` : 'Manage your SEO content'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/content/generate"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              AI Content Writer
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/content/brief"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 rounded-lg hover:from-purple-100 hover:to-pink-100 transition-colors border border-purple-200"
            >
              <Target className="w-4 h-4" />
              Brief Generator
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/content/planning"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 rounded-lg hover:from-blue-100 hover:to-purple-100 transition-colors border border-blue-200"
            >
              <Target className="w-4 h-4" />
              Content Planning
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Content
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or keyword..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {(Object.keys(STATUS_CONFIG) as ContentStatus[]).map(status => {
            const config = STATUS_CONFIG[status];
            const count = contentByStatus[status].length;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`p-4 rounded-xl border transition-all ${
                  statusFilter === status
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <config.icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-sm text-gray-500">{config.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first content'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Content
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContent.map(item => {
              const statusConfig = STATUS_CONFIG[item.status];
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Keyword: <span className="font-medium">{item.primaryKeyword}</span>
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <statusConfig.icon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            Updated {new Date(item.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>

                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              setEditingContent(item);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          
                          {/* Status transitions */}
                          {item.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'review')}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4" />
                              Submit for Review
                            </button>
                          )}
                          {item.status === 'review' && isAdmin && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'approved')}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                          )}
                          {item.status === 'approved' && isAdmin && (
                            <button
                              onClick={() => handleStatusChange(item.id, 'published')}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Send className="w-4 h-4" />
                              Publish
                            </button>
                          )}
                          
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingContent) && (
          <ContentModal
            content={editingContent}
            projectId={currentProject?.id || 'project-1'}
            onClose={() => {
              setShowCreateModal(false);
              setEditingContent(null);
            }}
            onSave={(newContent) => {
              if (editingContent) {
                setContent(prev => 
                  prev.map(c => c.id === editingContent.id ? { ...c, ...newContent, updatedAt: new Date().toISOString() } : c)
                );
              } else {
                setContent(prev => [
                  {
                    id: `content-${Date.now()}`,
                    projectId: currentProject?.id || 'project-1',
                    ...newContent,
                    slug: newContent.title.toLowerCase().replace(/\s+/g, '-'),
                    status: 'draft' as ContentStatus,
                    content: '',
                    createdBy: 'user-2',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }
              setShowCreateModal(false);
              setEditingContent(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

// Content Modal
interface ContentModalProps {
  content: SEOContent | null;
  projectId: string;
  onClose: () => void;
  onSave: (input: ContentCreateInput) => void;
}

function ContentModal({ content, onClose, onSave }: ContentModalProps) {
  const [title, setTitle] = useState(content?.title || '');
  const [primaryKeyword, setPrimaryKeyword] = useState(content?.primaryKeyword || '');
  const [metaTitle, setMetaTitle] = useState(content?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(content?.metaDescription || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      primaryKeyword,
      content: content?.content || '',
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {content ? 'Edit Content' : 'Create New Content'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter content title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Keyword *
            </label>
            <input
              type="text"
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Main SEO keyword"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Title
            </label>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SEO meta title (optional)"
            />
            <p className="mt-1 text-xs text-gray-500">
              {metaTitle.length}/60 characters recommended
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
            </label>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SEO meta description (optional)"
            />
            <p className="mt-1 text-xs text-gray-500">
              {metaDescription.length}/160 characters recommended
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {content ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContentPage() {
  return (
    <RoleGuard requiredPermissions={['content:view']}>
      <ContentPageContent />
    </RoleGuard>
  );
}
