'use client';

/**
 * Social Media Content Generator Component
 * Generate social media posts from article content
 */

import { useState, useEffect } from 'react';
import {
  Share2,
  Facebook,
  MessageCircle,
  Music2,
  Image as ImageIcon,
  Copy,
  Check,
  Send,
  Loader2,
  ExternalLink,
  Hash,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Settings,
  RefreshCw,
  Trash2,
  Eye,
  Calendar,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SocialMediaPreview } from './SocialMediaPreview';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SocialPost {
  id: string;
  platform: string;
  title: string;
  content: string;
  hashtags: string[];
  hashtagString: string;
  link_url: string;
  image_urls: string[];
  status: string;
  platform_post_id?: string;
  published_at?: string;
  created_at: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  page_name?: string;
  is_active: boolean;
}

interface SocialMediaGeneratorProps {
  projectId: string;
  articleTitle: string;
  articleContent: string;
  keyword: string;
  articleUrl?: string;
  articleImage?: string;
  onClose?: () => void;
}

const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    textColor: 'text-blue-600',
    bgLight: 'bg-blue-50',
    maxLength: 500,
  },
  {
    id: 'zalo',
    name: 'Zalo',
    icon: MessageCircle,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgLight: 'bg-blue-50',
    maxLength: 300,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Music2,
    color: 'bg-black',
    textColor: 'text-black',
    bgLight: 'bg-gray-100',
    maxLength: 150,
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: ImageIcon,
    color: 'bg-red-600',
    textColor: 'text-red-600',
    bgLight: 'bg-red-50',
    maxLength: 200,
  },
];

export function SocialMediaGenerator({
  projectId,
  articleTitle,
  articleContent,
  keyword,
  articleUrl = 'https://vib.com.vn',
  articleImage,
  onClose,
}: SocialMediaGeneratorProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]); // Start empty, will be set after loading accounts
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'posts'>('generate');

  useEffect(() => {
    loadAccounts();
    loadPosts();
  }, [projectId]);

  // Auto-select connected platforms when accounts are loaded
  useEffect(() => {
    if (accountsLoaded && accounts.length > 0) {
      const connectedPlatforms = accounts
        .filter(acc => acc.is_active)
        .map(acc => acc.platform);
      
      // Only select platforms that are connected
      const uniquePlatforms = [...new Set(connectedPlatforms)];
      setSelectedPlatforms(uniquePlatforms);
    }
  }, [accounts, accountsLoaded]);

  const loadAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/social/accounts`);
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data.accounts || []);
      }
      setAccountsLoaded(true);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      setAccountsLoaded(true);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/social/posts?limit=50`);
      const data = await response.json();
      if (data.success) {
        setPosts(data.data.posts || []);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const generatePosts = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Vui lòng chọn ít nhất 1 nền tảng');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/social/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          content: articleContent,
          keyword,
          url: articleUrl,
          platforms: selectedPlatforms,
          language: 'vi',
          imageUrl: articleImage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPosts(prev => [...data.data.posts, ...prev]);
        setSuccess(`Đã tạo ${data.data.posts.length} bài đăng mạng xã hội!`);
        setActiveTab('posts');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Không thể tạo nội dung');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (post: SocialPost) => {
    const fullContent = `${post.content}\n\n${post.hashtagString}`;
    await navigator.clipboard.writeText(fullContent);
    setCopied(post.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const publishPost = async (postId: string) => {
    setPublishing(postId);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/projects/${projectId}/social/posts/${postId}/publish`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (data.success) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, status: 'published', published_at: new Date().toISOString() }
              : p
          )
        );
        setSuccess('Đã đăng bài thành công!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        if (data.needsConnection) {
          setError(`Vui lòng kết nối tài khoản ${data.platform} trước khi đăng bài.`);
        } else {
          setError(data.error || 'Không thể đăng bài');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi');
    } finally {
      setPublishing(null);
    }
  };

  const updatePost = async (postId: string, updates: Partial<SocialPost>) => {
    try {
      const response = await fetch(
        `${API_BASE}/projects/${projectId}/social/posts/${postId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      const data = await response.json();
      if (data.success) {
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, ...updates } : p))
        );
        setSuccess('Đã cập nhật nội dung!');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(data.error || 'Không thể cập nhật');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi');
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/projects/${projectId}/social/posts/${postId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        // Reset preview index if needed
        if (previewIndex >= posts.length - 1) {
          setPreviewIndex(Math.max(0, posts.length - 2));
        }
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  // State for preview mode
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'preview'>('preview');

  const currentPreviewPost = posts[previewIndex];

  const goToPrevPost = () => {
    setPreviewIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextPost = () => {
    setPreviewIndex(prev => Math.min(posts.length - 1, prev + 1));
  };

  const openPlatformPost = (post: SocialPost) => {
    const platform = PLATFORMS.find(p => p.id === post.platform);
    if (!platform) return;

    let url = '';
    switch (post.platform) {
      case 'facebook':
        url = 'https://www.facebook.com/';
        break;
      case 'zalo':
        url = 'https://oa.zalo.me/';
        break;
      case 'tiktok':
        url = 'https://www.tiktok.com/';
        break;
      case 'pinterest':
        url = 'https://www.pinterest.com/';
        break;
    }
    window.open(url, '_blank');
  };

  const getPlatformIcon = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;
    const Icon = platform.icon;
    return <Icon className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã đăng
          </span>
        );
      case 'scheduled':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Đã lên lịch
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Thất bại
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
            Nháp
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-lg">Social Media Content</h3>
              <p className="text-sm text-purple-100">Tạo nội dung cho các mạng xã hội</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'generate'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Tạo nội dung mới
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'posts'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bài đăng ({posts.length})
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="p-4 space-y-4">
          {/* Article Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Bài viết gốc:</p>
            <p className="font-medium text-gray-900 line-clamp-2">{articleTitle}</p>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{articleContent.substring(0, 200)}...</p>
          </div>

          {/* Platform Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Chọn nền tảng:</p>
              {!accountsLoaded && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang tải...
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(platform => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                const connectedAccount = accounts.find(a => a.platform === platform.id && a.is_active);
                const hasAccount = !!connectedAccount;

                return (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    disabled={!hasAccount}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      !hasAccount
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? `${platform.bgLight} border-current ${platform.textColor}`
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={!hasAccount ? 'Vui lòng kết nối tài khoản trong Settings → Social Media' : ''}
                  >
                    <Icon className={`w-5 h-5 ${isSelected && hasAccount ? platform.textColor : 'text-gray-400'}`} />
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isSelected && hasAccount ? platform.textColor : 'text-gray-700'}`}>
                        {platform.name}
                      </p>
                      {hasAccount ? (
                        <p className="text-xs text-green-600 truncate" title={connectedAccount.page_name || connectedAccount.account_name}>
                          ✓ {connectedAccount.page_name || connectedAccount.account_name || 'Đã kết nối'}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">
                          ⚠ Chưa kết nối
                        </p>
                      )}
                    </div>
                    {isSelected && hasAccount && (
                      <Check className={`w-4 h-4 ${platform.textColor}`} />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Hint if no accounts connected */}
            {accountsLoaded && accounts.filter(a => a.is_active).length === 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Chưa có tài khoản mạng xã hội nào được kết nối.
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Vào <strong>Settings → Social Media</strong> để kết nối Facebook, Zalo...
                </p>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={generatePosts}
            disabled={generating || selectedPlatforms.length === 0}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang tạo nội dung...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Tạo nội dung cho {selectedPlatforms.length} nền tảng
              </>
            )}
          </button>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="p-4">
          {posts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa có bài đăng nào</p>
              <p className="text-sm">Hãy tạo nội dung mới để bắt đầu</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* View Mode Toggle & Navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Eye className="w-4 h-4 inline mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Danh sách
                  </button>
                </div>
                
                {viewMode === 'preview' && posts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPrevPost}
                      disabled={previewIndex === 0}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-gray-600">
                      {previewIndex + 1} / {posts.length}
                    </span>
                    <button
                      onClick={goToNextPost}
                      disabled={previewIndex === posts.length - 1}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Mode */}
              {viewMode === 'preview' && currentPreviewPost && (
                <div className="space-y-4">
                  {/* Platform Tabs for quick switch */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {posts.map((post, index) => {
                      const platform = PLATFORMS.find(p => p.id === post.platform);
                      if (!platform) return null;
                      const Icon = platform.icon;
                      
                      return (
                        <button
                          key={post.id}
                          onClick={() => setPreviewIndex(index)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 whitespace-nowrap transition-all ${
                            index === previewIndex
                              ? `${platform.bgLight} border-current ${platform.textColor}`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${index === previewIndex ? platform.textColor : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${index === previewIndex ? platform.textColor : 'text-gray-600'}`}>
                            {platform.name}
                          </span>
                          {post.status === 'published' && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Preview */}
                  <div className="bg-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-500 text-center mb-3">
                      ✨ Xem trước nội dung - Nhấn nút "Sửa" để chỉnh sửa trước khi đăng
                    </p>
                    <SocialMediaPreview
                      post={currentPreviewPost}
                      pageName="VIB - Ngân hàng TMCP Quốc tế Việt Nam"
                      pageAvatar="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop"
                      onSave={async (updates) => {
                        await updatePost(currentPreviewPost.id, updates);
                      }}
                      onPublish={async () => {
                        await publishPost(currentPreviewPost.id);
                      }}
                      isPublishing={publishing === currentPreviewPost.id}
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => copyToClipboard(currentPreviewPost)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {copied === currentPreviewPost.id ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          Đã copy
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy nội dung
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => deletePost(currentPreviewPost.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
                    </button>
                  </div>
                </div>
              )}

              {/* List Mode */}
              {viewMode === 'list' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {posts.map(post => {
                    const platform = PLATFORMS.find(p => p.id === post.platform);
                    if (!platform) return null;
                    const Icon = platform.icon;

                    return (
                      <div
                        key={post.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Post Header */}
                        <div className={`px-3 py-2 ${platform.bgLight} flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${platform.textColor}`} />
                            <span className={`text-sm font-medium ${platform.textColor}`}>
                              {platform.name}
                            </span>
                          </div>
                          {getStatusBadge(post.status)}
                        </div>

                        {/* Post Content */}
                        <div className="p-3 space-y-2">
                          {post.image_urls && post.image_urls.length > 0 && (
                            <img
                              src={post.image_urls[0]}
                              alt="Post image"
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          )}
                          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                            {post.content}
                          </p>
                          {post.hashtags && post.hashtags.length > 0 && (
                            <p className="text-xs text-blue-600">
                              {post.hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}
                              {post.hashtags.length > 3 && ` +${post.hashtags.length - 3}`}
                            </p>
                          )}
                        </div>

                        {/* Post Actions */}
                        <div className="px-3 py-2 bg-gray-50 flex items-center gap-2">
                          <button
                            onClick={() => {
                              const index = posts.findIndex(p => p.id === post.id);
                              setPreviewIndex(index);
                              setViewMode('preview');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Preview & Edit
                          </button>
                          
                          <button
                            onClick={() => copyToClipboard(post)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors"
                          >
                            {copied === post.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>

                          {post.status === 'draft' && (
                            <button
                              onClick={() => publishPost(post.id)}
                              disabled={publishing === post.id}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white ${platform.color} hover:opacity-90 rounded transition-colors ml-auto disabled:opacity-50`}
                            >
                              {publishing === post.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  Đăng
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => deletePost(post.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Connected Accounts Info */}
      <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>
            {accounts.filter(a => a.is_active).length} tài khoản đã kết nối
          </span>
          <button className="text-purple-600 hover:text-purple-700 font-medium">
            Quản lý tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

export default SocialMediaGenerator;
