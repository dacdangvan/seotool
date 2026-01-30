'use client';

/**
 * GA4 Integration Settings Component
 * 
 * Allows users to configure Google Analytics 4 integration for a project
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Link2,
  RefreshCw,
  Check,
  AlertCircle,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
} from 'lucide-react';

interface GA4Config {
  propertyId: string | null;
  hasCredentials: boolean;
  serviceAccountEmail: string | null;
  lastSyncAt: string | null;
  syncEnabled: boolean;
}

interface GA4SyncStatus {
  configured: boolean;
  propertyId: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  dataRange: {
    from: string | null;
    to: string | null;
    totalDays: number;
  };
  totals: {
    organicTraffic: number;
    totalTraffic: number;
  };
}

interface GA4SettingsProps {
  projectId: string;
  projectName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function GA4Settings({ projectId, projectName }: GA4SettingsProps) {
  const [config, setConfig] = useState<GA4Config | null>(null);
  const [status, setStatus] = useState<GA4SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [propertyId, setPropertyId] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncDays, setSyncDays] = useState(30);

  // Load config
  useEffect(() => {
    loadConfig();
    loadStatus();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/ga4/config`);
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setPropertyId(data.data.propertyId || '');
        setSyncEnabled(data.data.syncEnabled || false);
      }
    } catch (err) {
      console.error('Failed to load GA4 config:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/ga4/status`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to load GA4 status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      // Parse service account key if provided
      let parsedKey = null;
      if (serviceAccountKey) {
        try {
          parsedKey = JSON.parse(serviceAccountKey);
          if (!parsedKey.client_email || !parsedKey.private_key) {
            throw new Error('Invalid key format');
          }
        } catch {
          setError('Invalid service account key JSON. Please paste the entire contents of the JSON key file.');
          setSaving(false);
          return;
        }
      }

      const body: Record<string, unknown> = {};
      if (propertyId) body.propertyId = propertyId;
      if (parsedKey) body.serviceAccountKey = parsedKey;
      body.syncEnabled = syncEnabled;

      const response = await fetch(`${API_BASE}/projects/${projectId}/ga4/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('GA4 configuration saved successfully!');
        setServiceAccountKey(''); // Clear sensitive data
        loadConfig();
        loadStatus();
      } else {
        setError(data.error?.message || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setSuccess(null);
    setSyncing(true);

    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/ga4/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: syncDays }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Sync started successfully!');
        // Poll status after a delay
        setTimeout(() => {
          loadStatus();
        }, 5000);
      } else {
        setError(data.error?.message || 'Failed to start sync');
      }
    } catch (err) {
      setError('Failed to start sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setServiceAccountKey(content);
        // Try to extract property ID from key file (optional)
        try {
          const parsed = JSON.parse(content);
          if (parsed.project_id && !propertyId) {
            // Note: project_id in key file is GCP project, not GA4 property
          }
        } catch {}
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Google Analytics 4</h3>
              <p className="text-sm text-gray-500">Kết nối GA4 để lấy dữ liệu traffic thực</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status?.configured
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {status?.configured ? 'Đã kết nối' : 'Chưa kết nối'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Status Info */}
      {status?.configured && (
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Đã có dữ liệu:</p>
              <p>• Từ ngày: {status.dataRange.from || 'N/A'} đến {status.dataRange.to || 'N/A'}</p>
              <p>• Tổng số ngày: {status.dataRange.totalDays}</p>
              <p>• Organic traffic: {status.totals.organicTraffic.toLocaleString()}</p>
              {status.lastSyncAt && (
                <p>• Lần sync cuối: {new Date(status.lastSyncAt).toLocaleString('vi-VN')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="p-6 space-y-6">
        {/* GA4 Property ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GA4 Property ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="123456789"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Tìm tại: Google Analytics → Admin → Property Settings
          </p>
        </div>

        {/* Service Account Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Account Key (JSON)
            {config?.hasCredentials && (
              <span className="ml-2 text-green-600 text-xs font-normal">✓ Đã cấu hình</span>
            )}
          </label>
          
          <div className="space-y-2">
            {/* File upload */}
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                Click để upload file JSON hoặc kéo thả vào đây
              </span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Or paste directly */}
            <div className="relative">
              <textarea
                value={serviceAccountKey}
                onChange={(e) => setServiceAccountKey(e.target.value)}
                placeholder='{"type": "service_account", "client_email": "...", "private_key": "..."}'
                rows={4}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                  showKey ? '' : 'text-security-disc'
                }`}
                style={!showKey && serviceAccountKey ? { WebkitTextSecurity: 'disc' } as React.CSSProperties : {}}
              />
              {serviceAccountKey && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          <p className="mt-1 text-xs text-gray-500">
            Paste nội dung của file JSON key từ Google Cloud Console.{' '}
            <a
              href="https://console.cloud.google.com/iam-admin/serviceaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Tạo Service Account <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Auto Sync Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Tự động sync</p>
            <p className="text-sm text-gray-500">Sync dữ liệu GA4 tự động mỗi 6 tiếng</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !propertyId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              Lưu cấu hình
            </>
          )}
        </button>
      </div>

      {/* Manual Sync Section */}
      {status?.configured && (
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">Sync dữ liệu</h4>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Số ngày cần sync</label>
              <select
                value={syncDays}
                onChange={(e) => setSyncDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 ngày</option>
                <option value={14}>14 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={60}>60 ngày</option>
                <option value={90}>90 ngày</option>
              </select>
            </div>
            
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors mt-6"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Đang sync...
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  Sync ngay
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Setup Guide */}
      {!status?.configured && (
        <div className="p-6 border-t border-gray-200 bg-amber-50">
          <h4 className="font-medium text-amber-900 mb-3">Hướng dẫn cài đặt</h4>
          <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
            <li>
              Vào{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
            </li>
            <li>Tạo hoặc chọn project → Enable "Google Analytics Data API"</li>
            <li>Vào IAM & Admin → Service Accounts → Create Service Account</li>
            <li>Click vào service account → Keys → Add Key → JSON → Download</li>
            <li>
              Vào{' '}
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Analytics
              </a>
              {' '}→ Admin → Property Access Management
            </li>
            <li>Add user với email của Service Account (role: Viewer)</li>
            <li>Copy Property ID từ Property Settings</li>
            <li>Paste vào form trên và upload file JSON key</li>
          </ol>
        </div>
      )}
    </div>
  );
}
