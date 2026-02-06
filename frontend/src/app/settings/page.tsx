'use client';

/**
 * Settings Page
 * 
 * v0.8 - Admin-only settings management with GA4 Integration
 */

import { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { UserRole } from '@/types/auth';
import { GA4Settings } from '@/components/settings/GA4Settings';
import { GSCSettings } from '@/components/settings/GSCSettings';
import { AISettings } from '@/components/settings/AISettings';
import { SocialMediaSettings } from '@/components/settings/SocialMediaSettings';
import { useProject } from '@/context/ProjectContext';
import {
  Settings as SettingsIcon,
  Bell,
  Globe,
  Lock,
  Database,
  Mail,
  Save,
  Check,
  Bot,
  Share2,
} from 'lucide-react';

interface SettingSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface Project {
  id: string;
  name: string;
  domain: string;
}

const SECTIONS: SettingSection[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Globe },
  { id: 'social', label: 'Social Media', icon: Share2 },
  { id: 'ai', label: 'AI Settings', icon: Bot },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'data', label: 'Data & Privacy', icon: Database },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function SettingsContent() {
  const [activeSection, setActiveSection] = useState('integrations'); // Default to integrations
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { currentProject } = useProject();
  
  // Fallback: Load project directly if context doesn't have it
  const [fallbackProject, setFallbackProject] = useState<Project | null>(null);
  
  useEffect(() => {
    if (!currentProject && !fallbackProject) {
      // Load projects directly from API
      fetch(`${API_BASE}/projects`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.projects.length > 0) {
            setFallbackProject(data.data.projects[0]);
          }
        })
        .catch(err => console.error('Failed to load projects:', err));
    }
  }, [currentProject, fallbackProject]);
  
  const activeProject = currentProject || fallbackProject;

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your application settings</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 flex-shrink-0">
            <ul className="space-y-1">
              {SECTIONS.map(section => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <section.icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {activeSection === 'general' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      defaultValue="VIB SEO Team"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Language
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="vi">Vietnamese</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="Asia/Ho_Chi_Minh">Asia/Ho Chi Minh (GMT+7)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              )}

              {activeSection === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
                  
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Email Notifications</p>
                        <p className="text-sm text-gray-500">Receive alerts via email</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </label>

                    <label className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Traffic Alerts</p>
                        <p className="text-sm text-gray-500">Get notified of significant traffic changes</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </label>

                    <label className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Ranking Changes</p>
                        <p className="text-sm text-gray-500">Alerts for keyword ranking movements</p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                  </div>
                </div>
              )}

              {activeSection === 'integrations' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
                  <p className="text-gray-500 text-sm">
                    Kết nối các công cụ bên ngoài để lấy dữ liệu thực cho project: <strong>{activeProject?.name || 'Chưa chọn project'}</strong>
                  </p>
                  
                  {activeProject ? (
                    <>
                      {/* GA4 Integration */}
                      <GA4Settings 
                        projectId={activeProject.id} 
                        projectName={activeProject.name} 
                      />
                      
                      {/* GSC Integration */}
                      <GSCSettings 
                        projectId={activeProject.id} 
                        projectName={activeProject.name} 
                      />
                    </>
                  ) : (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-700">Vui lòng chọn một project để cấu hình integrations</p>
                    </div>
                  )}

                  {/* Other Integrations - Placeholder */}
                  <div className="grid gap-4 mt-6">
                    <h3 className="text-md font-medium text-gray-700">Các kết nối khác</h3>
                    {[
                      { name: 'Ahrefs', connected: false, description: 'Backlinks analysis' },
                      { name: 'SEMrush', connected: false, description: 'Keyword research' },
                    ].map(integration => (
                      <div key={integration.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Globe className="w-8 h-8 text-gray-400" />
                          <div>
                            <span className="font-medium text-gray-900">{integration.name}</span>
                            <p className="text-xs text-gray-500">{integration.description}</p>
                          </div>
                        </div>
                        <button
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                          disabled
                        >
                          Coming Soon
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'ai' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">AI Content Generation Settings</h2>
                  <p className="text-gray-500 text-sm">
                    Cấu hình AI provider để tạo nội dung tự động cho project: <strong>{activeProject?.name || 'Chưa chọn project'}</strong>
                  </p>
                  
                  {activeProject ? (
                    <AISettings 
                      projectId={activeProject.id} 
                      projectName={activeProject.name} 
                    />
                  ) : (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-700">Vui lòng chọn một project để cấu hình AI Settings</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'social' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Social Media Integration</h2>
                  <p className="text-gray-500 text-sm">
                    Kết nối tài khoản mạng xã hội để đăng bài tự động cho project: <strong>{activeProject?.name || 'Chưa chọn project'}</strong>
                  </p>
                  
                  {activeProject ? (
                    <SocialMediaSettings 
                      projectId={activeProject.id} 
                      projectName={activeProject.name} 
                    />
                  ) : (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-700">Vui lòng chọn một project để cấu hình Social Media</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-500">Require 2FA for all users</p>
                    </div>
                    <input type="checkbox" className="toggle" />
                  </label>
                </div>
              )}

              {activeSection === 'data' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900">Data & Privacy</h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Retention Period (days)
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                      <option value="730">2 years</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      Export All Data
                    </button>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saved ? (
                    <>
                      <Check className="w-5 h-5" />
                      Saved!
                    </>
                  ) : isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <SettingsContent />
    </RoleGuard>
  );
}
