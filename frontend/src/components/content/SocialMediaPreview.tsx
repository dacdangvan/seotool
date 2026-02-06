'use client';

/**
 * Social Media Preview Component
 * Shows a realistic preview of how the post will appear on each platform
 * Allows editing content before publishing
 */

import { useState, useEffect, useRef } from 'react';
import {
  Facebook,
  MessageCircle,
  Music2,
  Image as ImageIcon,
  Edit3,
  Check,
  X,
  ThumbsUp,
  MessageSquare,
  Share,
  Heart,
  Bookmark,
  MoreHorizontal,
  Globe,
  Send,
  Loader2,
  Smile,
  Camera,
  MapPin,
  Users,
  Upload,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';

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

interface SocialMediaPreviewProps {
  post: SocialPost;
  pageName?: string;
  pageAvatar?: string;
  onSave?: (updatedPost: Partial<SocialPost>) => Promise<void>;
  onPublish?: () => Promise<void>;
  isPublishing?: boolean;
}

export function SocialMediaPreview({
  post,
  pageName = 'VIB - Ngân hàng TMCP Quốc tế Việt Nam',
  pageAvatar = 'https://via.placeholder.com/40/1E40AF/FFFFFF?text=VIB',
  onSave,
  onPublish,
  isPublishing = false,
}: SocialMediaPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content || '');
  const [editedHashtags, setEditedHashtags] = useState((post.hashtags || []).join(' '));
  const [editedImageUrl, setEditedImageUrl] = useState(post.image_urls?.[0] || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Base URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    setEditedContent(post.content || '');
    setEditedHashtags((post.hashtags || []).join(' '));
    setEditedImageUrl(post.image_urls?.[0] || '');
  }, [post]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước file không được vượt quá 5MB');
      return;
    }

    setUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          
          // Upload to server
          const response = await fetch(`${API_BASE}/projects/${post.id.split('-')[0]}/images/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData: base64Data,
              mimeType: file.type,
            }),
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          const result = await response.json();
          setEditedImageUrl(result.url);
        } catch (err) {
          console.error('Failed to upload:', err);
          // Fallback: Use local preview URL
          setEditedImageUrl(URL.createObjectURL(file));
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setUploading(false);
        alert('Lỗi đọc file');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle URL input
  const handleUrlAdd = () => {
    if (imageUrlInput.trim()) {
      setEditedImageUrl(imageUrlInput.trim());
      setImageUrlInput('');
      setShowUrlInput(false);
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setEditedImageUrl('');
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setSaving(true);
    try {
      const hashtags = editedHashtags
        .split(/[\s,#]+/)
        .map(h => h.trim())
        .filter(h => h.length > 0);
      
      await onSave({
        content: editedContent,
        hashtags,
        hashtagString: hashtags.map(h => `#${h}`).join(' '),
        image_urls: editedImageUrl ? [editedImageUrl] : [],
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(post.content || '');
    setEditedHashtags((post.hashtags || []).join(' '));
    setEditedImageUrl(post.image_urls?.[0] || '');
    setIsEditing(false);
    setShowUrlInput(false);
    setImageUrlInput('');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút`;
    if (hours < 24) return `${hours} giờ`;
    return `${days} ngày`;
  };

  // Facebook Preview
  if (post.platform === 'facebook') {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-[500px] mx-auto overflow-hidden">
        {/* Edit Mode Banner */}
        {onSave && !isEditing && post.status === 'draft' && (
          <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">
              ✏️ Bạn có thể chỉnh sửa nội dung trước khi đăng
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              Chỉnh sửa
            </button>
          </div>
        )}

        {/* Header */}
        <div className="p-3 flex items-start gap-3 bg-white">
          <img
            src={pageAvatar}
            alt={pageName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
          />
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#050505] text-[15px] hover:underline cursor-pointer">
                {pageName}
              </span>
              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <span>{post.status === 'draft' ? 'Bản nháp' : formatDate(post.published_at || post.created_at)}</span>
              <span>·</span>
              <Globe className="w-3 h-3" />
              <span>Công khai</span>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full -mr-1">
            <MoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content - Edit Mode */}
        {isEditing ? (
          <div className="px-3 pb-3 space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full p-0 bg-transparent text-[15px] text-gray-900 resize-none focus:outline-none placeholder:text-gray-400"
                rows={6}
                placeholder="Bạn đang nghĩ gì?"
                autoFocus
              />
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
                <input
                  type="text"
                  value={editedHashtags}
                  onChange={e => setEditedHashtags(e.target.value)}
                  className="flex-1 p-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Hashtags: VIB NgânHàng TàiChính..."
                />
              </div>
            </div>

            {/* Image Edit Section */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Hình ảnh đính kèm</span>
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center gap-1"
                    title="Upload ảnh từ máy"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    Upload
                  </button>
                  <button
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
                    title="Nhập URL ảnh"
                  >
                    <LinkIcon className="w-3 h-3" />
                    URL
                  </button>
                </div>
              </div>

              {/* URL Input */}
              {showUrlInput && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={e => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleUrlAdd}
                    disabled={!imageUrlInput.trim()}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Thêm
                  </button>
                  <button
                    onClick={() => { setShowUrlInput(false); setImageUrlInput(''); }}
                    className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Image Preview */}
              {editedImageUrl ? (
                <div className="relative group">
                  <img
                    src={editedImageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                    Nhấn để thay đổi ảnh
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2 text-gray-400" />
                  <span className="text-sm">Nhấn để upload ảnh</span>
                  <span className="text-xs text-gray-400">hoặc kéo thả file vào đây</span>
                </div>
              )}
            </div>
            
            {/* Edit Actions Bar - Facebook style */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 mr-2">Thêm vào bài viết:</span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 hover:bg-gray-200 rounded-full" 
                  title="Ảnh/Video"
                >
                  <Camera className="w-5 h-5 text-green-500" />
                </button>
                <button className="p-1.5 hover:bg-gray-200 rounded-full" title="Tag người">
                  <Users className="w-5 h-5 text-blue-500" />
                </button>
                <button className="p-1.5 hover:bg-gray-200 rounded-full" title="Cảm xúc">
                  <Smile className="w-5 h-5 text-yellow-500" />
                </button>
                <button className="p-1.5 hover:bg-gray-200 rounded-full" title="Check in">
                  <MapPin className="w-5 h-5 text-red-500" />
                </button>
              </div>
            </div>

            {/* Save/Cancel Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editedContent.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Content - View Mode */
          <div className="px-3 pb-2">
            <p className="text-[#050505] text-[15px] leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
            {post.hashtags && post.hashtags.length > 0 && (
              <p className="mt-2 text-blue-600 text-[15px]">
                {post.hashtags.map(h => `#${h}`).join(' ')}
              </p>
            )}
          </div>
        )}

        {/* Link Preview */}
        {post.link_url && !isEditing && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mx-3 mb-3 border border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 transition-colors"
          >
            {post.image_urls?.[0] && (
              <img
                src={post.image_urls[0]}
                alt="Preview"
                className="w-full h-52 object-cover"
              />
            )}
            <div className="p-3 bg-[#F0F2F5]">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{new URL(post.link_url).hostname}</p>
              <p className="text-[15px] font-semibold text-[#050505] mt-1 line-clamp-2">{post.title}</p>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{post.title}</p>
            </div>
          </a>
        )}

        {/* Image without link */}
        {post.image_urls?.[0] && !post.link_url && !isEditing && (
          <div className="pb-1">
            <img
              src={post.image_urls[0]}
              alt="Post image"
              className="w-full object-cover"
            />
          </div>
        )}

        {/* Engagement Stats - Facebook Style */}
        {!isEditing && (
          <div className="px-4 py-2 flex items-center justify-between text-[#65676B] text-[13px]">
            <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
              <div className="flex -space-x-1">
                <span className="w-[18px] h-[18px] bg-gradient-to-b from-blue-400 to-blue-600 rounded-full flex items-center justify-center ring-2 ring-white">
                  <ThumbsUp className="w-2.5 h-2.5 text-white" />
                </span>
                <span className="w-[18px] h-[18px] bg-gradient-to-b from-red-400 to-red-600 rounded-full flex items-center justify-center ring-2 ring-white">
                  <Heart className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <span>128</span>
            </div>
            <div className="flex gap-4">
              <span className="hover:underline cursor-pointer">24 bình luận</span>
              <span className="hover:underline cursor-pointer">12 lượt chia sẻ</span>
            </div>
          </div>
        )}

        {/* Action Buttons - Facebook Style */}
        {!isEditing && (
          <div className="mx-3 py-1 border-t border-gray-200 flex justify-around">
            <button className="flex-1 py-2.5 flex items-center justify-center gap-2 text-[#65676B] hover:bg-[#F0F2F5] rounded-md transition-colors">
              <ThumbsUp className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Thích</span>
            </button>
            <button className="flex-1 py-2.5 flex items-center justify-center gap-2 text-[#65676B] hover:bg-[#F0F2F5] rounded-md transition-colors">
              <MessageSquare className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Bình luận</span>
            </button>
            <button className="flex-1 py-2.5 flex items-center justify-center gap-2 text-[#65676B] hover:bg-[#F0F2F5] rounded-md transition-colors">
              <Share className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Chia sẻ</span>
            </button>
          </div>
        )}

        {/* Publish Button */}
        {post.status === 'draft' && onPublish && !isEditing && (
          <div className="p-3 border-t bg-gradient-to-r from-blue-50 to-indigo-50">
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang đăng lên Facebook...
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  Đăng lên Facebook ngay
                </>
              )}
            </button>
            <p className="text-xs text-center text-gray-500 mt-2">
              Bài viết sẽ được đăng công khai lên Page của bạn
            </p>
          </div>
        )}

        {/* Status Badge */}
        {post.status === 'published' && (
          <div className="p-3 border-t bg-green-50">
            <div className="flex items-center justify-center gap-2 text-green-700 text-sm">
              <Check className="w-5 h-5" />
              <span>Đã đăng lên Facebook</span>
              {post.published_at && (
                <span className="text-green-600">
                  · {new Date(post.published_at).toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Zalo Preview - Redesigned to look more like Zalo OA
  if (post.platform === 'zalo') {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-[400px] mx-auto overflow-hidden">
        {/* Edit Banner */}
        {onSave && !isEditing && post.status === 'draft' && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">
              ✏️ Chỉnh sửa nội dung trước khi đăng
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600"
            >
              Sửa
            </button>
          </div>
        )}

        {/* Zalo Header - OA Style */}
        <div className="p-3 flex items-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="relative">
            <img
              src={pageAvatar}
              alt={pageName}
              className="w-12 h-12 rounded-full object-cover border-2 border-white/30"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-yellow-800" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <span className="font-bold text-[15px]">{pageName}</span>
            <div className="flex items-center gap-1 text-xs text-blue-100 mt-0.5">
              <span className="bg-white/20 px-1.5 py-0.5 rounded">Official Account</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  className="w-full p-0 bg-transparent text-[15px] text-gray-900 resize-none focus:outline-none"
                  rows={5}
                  placeholder="Nhập nội dung bài viết..."
                  autoFocus
                />
              </div>
              <input
                type="text"
                value={editedHashtags}
                onChange={e => setEditedHashtags(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Hashtags: VIB NgânHàng..."
              />

              {/* Image Edit Section - Zalo */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Hình ảnh</span>
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center gap-1"
                    >
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload
                    </button>
                    <button
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      URL
                    </button>
                  </div>
                </div>
                {showUrlInput && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={e => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleUrlAdd} disabled={!imageUrlInput.trim()} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      Thêm
                    </button>
                    <button onClick={() => { setShowUrlInput(false); setImageUrlInput(''); }} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {editedImageUrl ? (
                  <div className="relative group">
                    <img src={editedImageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                    <button onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Xóa ảnh">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 cursor-pointer">
                    <Camera className="w-6 h-6 mb-1 text-gray-400" />
                    <span className="text-xs">Nhấn để upload ảnh</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
              {post.hashtags && post.hashtags.length > 0 && (
                <p className="mt-3 text-blue-500 text-sm font-medium">
                  {post.hashtags.map(h => `#${h}`).join(' ')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Image */}
        {post.image_urls?.[0] && !isEditing && (
          <div className="px-4 pb-4">
            <img
              src={post.image_urls[0]}
              alt="Post image"
              className="w-full rounded-xl object-cover shadow-sm"
            />
          </div>
        )}

        {/* Link Card */}
        {post.link_url && !isEditing && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mx-4 mb-4 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{post.title}</p>
                <p className="text-xs text-gray-500 truncate">{post.link_url}</p>
              </div>
            </div>
          </a>
        )}

        {/* Zalo Engagement Preview */}
        {!isEditing && (
          <div className="mx-4 mb-4 flex items-center justify-between text-gray-500 text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span>56</span>
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span>12</span>
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {post.status === 'draft' ? 'Bản nháp' : formatDate(post.published_at || post.created_at)}
            </span>
          </div>
        )}

        {/* Publish Button */}
        {post.status === 'draft' && onPublish && !isEditing && (
          <div className="p-4 border-t bg-gradient-to-r from-blue-50 to-cyan-50">
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang đăng lên Zalo...
                </>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  Đăng lên Zalo OA
                </>
              )}
            </button>
          </div>
        )}

        {post.status === 'published' && (
          <div className="p-3 border-t bg-green-50 text-center">
            <span className="text-green-700 text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Đã đăng lên Zalo
            </span>
          </div>
        )}
      </div>
    );
  }

  // TikTok Preview - Redesigned with edit mode
  if (post.platform === 'tiktok') {
    return (
      <div className="bg-black rounded-xl shadow-lg max-w-[340px] mx-auto overflow-hidden">
        {/* Edit Banner */}
        {onSave && !isEditing && post.status === 'draft' && (
          <div className="px-3 py-2 bg-gray-900 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              ✏️ Chỉnh sửa mô tả trước khi đăng
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs bg-white/10 text-white rounded-full hover:bg-white/20"
            >
              Sửa
            </button>
          </div>
        )}

        {/* TikTok Video Frame */}
        <div className="relative aspect-[9/16] bg-gradient-to-b from-gray-900 to-black">
          {post.image_urls?.[0] ? (
            <img
              src={post.image_urls[0]}
              alt="Video thumbnail"
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 className="w-16 h-16 text-white/30" />
            </div>
          )}
          
          {/* Right Side Actions */}
          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
            <div className="relative">
              <img
                src={pageAvatar}
                alt={pageName}
                className="w-11 h-11 rounded-full object-cover border-2 border-white"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">+</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <button className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </button>
              <span className="text-white text-xs mt-1 font-medium">12.5K</span>
            </div>
            <div className="flex flex-col items-center">
              <button className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </button>
              <span className="text-white text-xs mt-1 font-medium">234</span>
            </div>
            <div className="flex flex-col items-center">
              <button className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Bookmark className="w-6 h-6 text-white" />
              </button>
              <span className="text-white text-xs mt-1 font-medium">89</span>
            </div>
            <div className="flex flex-col items-center">
              <button className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Share className="w-6 h-6 text-white" />
              </button>
              <span className="text-white text-xs mt-1 font-medium">56</span>
            </div>
            {/* Music Disc */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border-2 border-gray-600 animate-spin" style={{ animationDuration: '3s' }}>
              <div className="w-4 h-4 rounded-full bg-white/20"></div>
            </div>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-0 left-0 right-14 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white text-[15px] font-bold">@vib_bank</span>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm resize-none placeholder:text-white/50"
                  rows={4}
                  placeholder="Mô tả video của bạn..."
                  autoFocus
                />
                <input
                  type="text"
                  value={editedHashtags}
                  onChange={e => setEditedHashtags(e.target.value)}
                  className="w-full p-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white text-sm placeholder:text-white/50"
                  placeholder="Hashtags: foryou fyp banking..."
                />
                
                {/* Thumbnail Upload - TikTok */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/70">Ảnh bìa video</span>
                    <div className="flex gap-1">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30 flex items-center gap-1">
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setShowUrlInput(!showUrlInput)} className="px-2 py-1 text-xs bg-white/20 text-white rounded hover:bg-white/30">
                        <LinkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {showUrlInput && (
                    <div className="flex gap-1 mb-2">
                      <input type="text" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="URL ảnh..." className="flex-1 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder:text-white/40" />
                      <button onClick={handleUrlAdd} className="px-2 py-1 text-xs bg-red-500 text-white rounded">OK</button>
                    </div>
                  )}
                  {editedImageUrl && (
                    <div className="relative">
                      <img src={editedImageUrl} alt="Thumbnail" className="w-full h-20 object-cover rounded" />
                      <button onClick={handleRemoveImage} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm text-white/80 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-white text-sm leading-relaxed line-clamp-3">{post.content}</p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <p className="text-white/90 text-sm mt-2 font-medium">
                    {post.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')} {post.hashtags.length > 4 && '...'}
                  </p>
                )}
                {/* Music Label */}
                <div className="flex items-center gap-2 mt-3">
                  <Music2 className="w-4 h-4 text-white" />
                  <div className="overflow-hidden">
                    <p className="text-white text-xs whitespace-nowrap animate-marquee">
                      ♫ Nhạc nền - VIB Official
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Draft Status */}
          {post.status === 'draft' && !isEditing && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full">
              <span className="text-white/80 text-xs">Bản nháp</span>
            </div>
          )}
        </div>

        {/* Publish Button */}
        {post.status === 'draft' && onPublish && !isEditing && (
          <div className="p-4 bg-gray-900">
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="w-full py-3 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang đăng...
                </>
              ) : (
                <>
                  <Music2 className="w-5 h-5" />
                  Đăng lên TikTok
                </>
              )}
            </button>
            <p className="text-gray-500 text-xs text-center mt-2">
              Video sẽ được đăng công khai
            </p>
          </div>
        )}

        {post.status === 'published' && (
          <div className="p-3 bg-green-900/50 text-center">
            <span className="text-green-400 text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Đã đăng lên TikTok
            </span>
          </div>
        )}
      </div>
    );
  }

  // Generic Preview for Pinterest and other platforms - with edit mode
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-[400px] mx-auto overflow-hidden">
      {/* Edit Banner */}
      {onSave && !isEditing && post.status === 'draft' && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-700 font-medium">
            ✏️ Chỉnh sửa nội dung trước khi đăng
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            Sửa
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <img
          src={pageAvatar}
          alt={pageName}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200"
        />
        <div className="flex-1">
          <p className="font-bold text-[15px] text-gray-900">{pageName}</p>
          <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
            {post.platform === 'pinterest' && (
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0a12 12 0 0 0-4.373 23.178c-.07-.633-.134-1.606.028-2.298.146-.625.938-3.977.938-3.977s-.239-.48-.239-1.187c0-1.113.645-1.943 1.448-1.943.683 0 1.012.512 1.012 1.127 0 .687-.437 1.712-.663 2.663-.188.796.4 1.446 1.185 1.446 1.422 0 2.515-1.5 2.515-3.664 0-1.915-1.377-3.254-3.342-3.254-2.276 0-3.612 1.707-3.612 3.471 0 .688.265 1.425.595 1.826a.24.24 0 0 1 .056.23c-.061.252-.196.796-.222.907-.035.146-.116.177-.268.107-1-.465-1.624-1.926-1.624-3.1 0-2.523 1.834-4.84 5.286-4.84 2.775 0 4.932 1.977 4.932 4.62 0 2.757-1.739 4.976-4.151 4.976-.811 0-1.573-.421-1.834-.919l-.498 1.902c-.181.695-.669 1.566-.995 2.097A12 12 0 1 0 12 0z"/>
              </svg>
            )}
            <span>{post.platform}</span>
            {post.status === 'draft' && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">Bản nháp</span>
            )}
          </p>
        </div>
      </div>
      
      {/* Image - Pinterest style */}
      {post.image_urls?.[0] && !isEditing && (
        <div className="px-4">
          <img
            src={post.image_urls[0]}
            alt="Post image"
            className="w-full rounded-xl object-cover shadow-sm"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full p-0 bg-transparent text-[15px] text-gray-900 resize-none focus:outline-none"
                rows={5}
                placeholder="Nhập mô tả cho Pin..."
                autoFocus
              />
            </div>
            <input
              type="text"
              value={editedHashtags}
              onChange={e => setEditedHashtags(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Hashtags: pinterest inspiration..."
            />

            {/* Image Edit Section - Pinterest */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Hình ảnh Pin</span>
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-1">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Upload
                  </button>
                  <button onClick={() => setShowUrlInput(!showUrlInput)} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    URL
                  </button>
                </div>
              </div>
              {showUrlInput && (
                <div className="flex items-center gap-2 mb-2">
                  <input type="text" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="https://example.com/image.jpg" className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <button onClick={handleUrlAdd} disabled={!imageUrlInput.trim()} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">Thêm</button>
                  <button onClick={() => { setShowUrlInput(false); setImageUrlInput(''); }} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md"><X className="w-4 h-4" /></button>
                </div>
              )}
              {editedImageUrl ? (
                <div className="relative group">
                  <img src={editedImageUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button onClick={handleRemoveImage} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Xóa ảnh">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-red-400 cursor-pointer">
                  <Camera className="w-8 h-8 mb-2 text-gray-400" />
                  <span className="text-sm">Nhấn để upload ảnh</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Lưu
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
            {post.hashtags && post.hashtags.length > 0 && (
              <p className="mt-3 text-red-600 text-sm font-medium">
                {post.hashtags.map(h => `#${h}`).join(' ')}
              </p>
            )}
          </>
        )}
      </div>

      {/* Publish Button */}
      {post.status === 'draft' && onPublish && !isEditing && (
        <div className="p-4 border-t bg-gradient-to-r from-red-50 to-pink-50">
          <button
            onClick={onPublish}
            disabled={isPublishing}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang đăng lên {post.platform}...
              </>
            ) : (
              <>
                {post.platform === 'pinterest' ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0a12 12 0 0 0-4.373 23.178c-.07-.633-.134-1.606.028-2.298.146-.625.938-3.977.938-3.977s-.239-.48-.239-1.187c0-1.113.645-1.943 1.448-1.943.683 0 1.012.512 1.012 1.127 0 .687-.437 1.712-.663 2.663-.188.796.4 1.446 1.185 1.446 1.422 0 2.515-1.5 2.515-3.664 0-1.915-1.377-3.254-3.342-3.254-2.276 0-3.612 1.707-3.612 3.471 0 .688.265 1.425.595 1.826a.24.24 0 0 1 .056.23c-.061.252-.196.796-.222.907-.035.146-.116.177-.268.107-1-.465-1.624-1.926-1.624-3.1 0-2.523 1.834-4.84 5.286-4.84 2.775 0 4.932 1.977 4.932 4.62 0 2.757-1.739 4.976-4.151 4.976-.811 0-1.573-.421-1.834-.919l-.498 1.902c-.181.695-.669 1.566-.995 2.097A12 12 0 1 0 12 0z"/>
                  </svg>
                ) : (
                  <Globe className="w-5 h-5" />
                )}
                Đăng lên {post.platform === 'pinterest' ? 'Pinterest' : post.platform}
              </>
            )}
          </button>
        </div>
      )}

      {post.status === 'published' && (
        <div className="p-3 border-t bg-green-50 text-center">
          <span className="text-green-700 text-sm flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Đã đăng lên {post.platform}
          </span>
        </div>
      )}
    </div>
  );
}

export default SocialMediaPreview;
