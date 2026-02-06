'use client';

/**
 * Social Media Integration Settings
 * 
 * Cấu hình kết nối các tài khoản mạng xã hội:
 * - Facebook Page
 * - Zalo Official Account
 * - TikTok Business
 * - Pinterest Business
 */

import { useState, useEffect } from 'react';
import {
  Facebook,
  MessageCircle,
  Music2,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  RefreshCw,
  ExternalLink,
  Settings,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SocialAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  account_type: string;
  page_name?: string;
  profile_url?: string;
  avatar_url?: string;
  is_active: boolean;
  last_sync_at?: string;
  token_expires_at?: string;
}

interface SocialMediaSettingsProps {
  projectId: string;
  projectName: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description: string;
  authUrl?: string;
  features: string[];
  setupSteps: string[];
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Đăng bài lên Facebook Page',
    features: ['Đăng bài với ảnh', 'Đăng link với preview', 'Lên lịch đăng bài'],
    setupSteps: [
      '1. Vào Facebook Developers và tạo App',
      '2. Thêm Facebook Login và Pages API',
      '3. Lấy Page Access Token',
      '4. Dán token vào ô bên dưới',
    ],
  },
  {
    id: 'zalo',
    name: 'Zalo OA',
    icon: MessageCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Đăng bài lên Zalo Official Account',
    features: ['Đăng bài Article', 'Gửi broadcast', 'Tương tác với followers'],
    setupSteps: [
      '1. Đăng ký Zalo OA tại oa.zalo.me',
      '2. Tạo App trên Zalo Developers',
      '3. Lấy OA Access Token',
      '4. Dán token vào ô bên dưới',
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Music2,
    color: 'text-black',
    bgColor: 'bg-gray-100',
    description: 'Đăng video lên TikTok Business',
    features: ['Đăng video', 'Thêm hashtags', 'Phân tích engagement'],
    setupSteps: [
      '1. Tạo TikTok Developer Account',
      '2. Đăng ký TikTok for Business API',
      '3. Lấy Access Token',
      '4. Dán token vào ô bên dưới',
    ],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: ImageIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: 'Tạo Pin trên Pinterest Business',
    features: ['Tạo Pin với ảnh', 'Pin vào Board', 'Rich Pins'],
    setupSteps: [
      '1. Tạo Pinterest Business Account',
      '2. Vào Pinterest Developers tạo App',
      '3. Lấy Access Token',
      '4. Dán token vào ô bên dưới',
    ],
  },
];

export function SocialMediaSettings({ projectId, projectName }: SocialMediaSettingsProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  
  // Form states for each platform
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [pageIdInputs, setPageIdInputs] = useState<Record<string, string>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  // Load connected accounts
  useEffect(() => {
    loadAccounts();
  }, [projectId]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects/${projectId}/social/accounts`);
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load social accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccountForPlatform = (platformId: string) => {
    return accounts.find(a => a.platform === platformId && a.is_active);
  };

  const handleConnect = async (platformId: string) => {
    const token = tokenInputs[platformId];
    const pageId = pageIdInputs[platformId];

    if (!token) {
      setError('Vui lòng nhập Access Token');
      return;
    }

    try {
      setConnecting(platformId);
      setError(null);

      const res = await fetch(`${API_BASE}/projects/${projectId}/social/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformId,
          access_token: token,
          page_id: pageId || undefined,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setAccounts([...accounts, data.data.account]);
        setTokenInputs({ ...tokenInputs, [platformId]: '' });
        setPageIdInputs({ ...pageIdInputs, [platformId]: '' });
        setExpandedPlatform(null);
      } else {
        setError(data.error || 'Không thể kết nối tài khoản');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string, platformId: string) => {
    if (!confirm('Bạn có chắc muốn ngắt kết nối tài khoản này?')) return;

    try {
      setConnecting(platformId);
      const res = await fetch(
        `${API_BASE}/projects/${projectId}/social/accounts/${accountId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setAccounts(accounts.filter(a => a.id !== accountId));
      }
    } catch (err) {
      setError('Không thể ngắt kết nối');
    } finally {
      setConnecting(null);
    }
  };

  const handleRefreshToken = async (accountId: string, platformId: string) => {
    try {
      setConnecting(platformId);
      // In real implementation, this would refresh the token via OAuth
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadAccounts();
    } catch (err) {
      setError('Không thể làm mới token');
    } finally {
      setConnecting(null);
    }
  };

  const isTokenExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expires = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white border rounded-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Đang tải cấu hình Social Media...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            Social Media Integration
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Kết nối tài khoản mạng xã hội để đăng bài tự động
          </p>
        </div>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
          {accounts.filter(a => a.is_active).length}/{PLATFORMS.length} đã kết nối
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {PLATFORMS.map(platform => {
          const Icon = platform.icon;
          const account = getAccountForPlatform(platform.id);
          const isExpanded = expandedPlatform === platform.id;
          const isConnecting = connecting === platform.id;

          return (
            <div
              key={platform.id}
              className={cn(
                'border rounded-xl overflow-hidden transition-all',
                account ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'
              )}
            >
              {/* Platform Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', platform.bgColor)}>
                    <Icon className={cn('w-6 h-6', platform.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{platform.name}</span>
                      {account && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{platform.description}</p>
                    {account && (
                      <p className="text-xs text-green-600 mt-1">
                        Đã kết nối: {account.page_name || account.account_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {account ? (
                    <>
                      {isTokenExpiringSoon(account.token_expires_at) && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Token sắp hết hạn
                        </span>
                      )}
                      <button
                        onClick={() => handleRefreshToken(account.id, platform.id)}
                        disabled={isConnecting}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Làm mới token"
                      >
                        <RefreshCw className={cn('w-4 h-4', isConnecting && 'animate-spin')} />
                      </button>
                      <button
                        onClick={() => handleDisconnect(account.id, platform.id)}
                        disabled={isConnecting}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Ngắt kết nối"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors',
                        isExpanded
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      <Link2 className="w-4 h-4" />
                      {isExpanded ? 'Đóng' : 'Kết nối'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Setup Form */}
              {isExpanded && !account && (
                <div className="border-t bg-gray-50 p-4 space-y-4">
                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Tính năng hỗ trợ:</h4>
                    <div className="flex flex-wrap gap-2">
                      {platform.features.map(feature => (
                        <span
                          key={feature}
                          className="text-xs bg-white border px-2 py-1 rounded-full text-gray-600"
                        >
                          ✓ {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Setup Steps */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Hướng dẫn lấy Access Token:
                    </h4>
                    <ol className="text-sm text-amber-700 space-y-1">
                      {platform.setupSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Token Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showTokens[platform.id] ? 'text' : 'password'}
                        value={tokenInputs[platform.id] || ''}
                        onChange={e => setTokenInputs({ ...tokenInputs, [platform.id]: e.target.value })}
                        placeholder="Dán access token vào đây..."
                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTokens({ ...showTokens, [platform.id]: !showTokens[platform.id] })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showTokens[platform.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Page ID (for Facebook) */}
                  {platform.id === 'facebook' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Page ID <span className="text-gray-400">(tùy chọn)</span>
                      </label>
                      <input
                        type="text"
                        value={pageIdInputs[platform.id] || ''}
                        onChange={e => setPageIdInputs({ ...pageIdInputs, [platform.id]: e.target.value })}
                        placeholder="ID của Facebook Page..."
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Connect Button */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setExpandedPlatform(null)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={isConnecting || !tokenInputs[platform.id]}
                      className={cn(
                        'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
                        isConnecting || !tokenInputs[platform.id]
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      )}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang kết nối...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Xác nhận kết nối
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Connected Account Details */}
              {account && (
                <div className="border-t bg-green-50/50 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Account ID:</span>
                      <p className="font-medium text-gray-900">{account.account_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Loại tài khoản:</span>
                      <p className="font-medium text-gray-900 capitalize">{account.account_type || 'Page'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Lần sync cuối:</span>
                      <p className="font-medium text-gray-900">
                        {account.last_sync_at
                          ? new Date(account.last_sync_at).toLocaleDateString('vi-VN')
                          : 'Chưa sync'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Token hết hạn:</span>
                      <p className={cn(
                        'font-medium',
                        isTokenExpiringSoon(account.token_expires_at) ? 'text-amber-600' : 'text-gray-900'
                      )}>
                        {account.token_expires_at
                          ? new Date(account.token_expires_at).toLocaleDateString('vi-VN')
                          : 'Không xác định'}
                      </p>
                    </div>
                  </div>
                  
                  {account.profile_url && (
                    <a
                      href={account.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Xem trang
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">💡 Lưu ý quan trọng:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Access Token cần có quyền đăng bài (publish permission)</li>
          <li>• Token có thể hết hạn sau 60-90 ngày, cần làm mới định kỳ</li>
          <li>• Nên sử dụng Page Token thay vì User Token để bảo mật</li>
          <li>• Mỗi nền tảng có chính sách API riêng, đảm bảo tuân thủ</li>
        </ul>
      </div>
    </div>
  );
}
