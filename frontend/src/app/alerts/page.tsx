'use client';

/**
 * Alerts Page
 * 
 * v0.7 - SEO Alerts and notifications
 */

import { useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import {
  AlertTriangle,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Bell,
} from 'lucide-react';

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'acknowledged' | 'resolved';

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  projectId: string;
  createdAt: string;
}

const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    title: 'Organic Traffic Drop Detected',
    description: 'Traffic from organic search has dropped by 15% compared to last week. Potential algorithm update impact.',
    severity: 'critical',
    status: 'active',
    projectId: 'project-1',
    createdAt: '2024-03-15T08:00:00Z',
  },
  {
    id: 'alert-2',
    title: 'Core Web Vitals Warning',
    description: 'LCP (Largest Contentful Paint) has exceeded 2.5s threshold on mobile devices.',
    severity: 'warning',
    status: 'active',
    projectId: 'project-1',
    createdAt: '2024-03-14T14:30:00Z',
  },
  {
    id: 'alert-3',
    title: 'New Backlinks Detected',
    description: '5 new backlinks discovered from high-authority domains (DA > 50).',
    severity: 'info',
    status: 'acknowledged',
    projectId: 'project-1',
    createdAt: '2024-03-13T10:00:00Z',
  },
];

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
  warning: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  info: { icon: Bell, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-red-600', bg: 'bg-red-100' },
  acknowledged: { label: 'Acknowledged', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  resolved: { label: 'Resolved', color: 'text-green-600', bg: 'bg-green-100' },
};

function AlertsContent() {
  const { currentProject } = useProject();
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [filter, setFilter] = useState<AlertStatus | 'all'>('all');

  const filteredAlerts = alerts.filter(
    a => (filter === 'all' || a.status === filter) && 
         (!currentProject || a.projectId === currentProject.id)
  );

  const handleStatusChange = (alertId: string, newStatus: AlertStatus) => {
    setAlerts(prev => 
      prev.map(a => a.id === alertId ? { ...a, status: newStatus } : a)
    );
  };

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
            <p className="text-gray-600 mt-1">Monitor SEO issues and notifications</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
            className={`p-4 rounded-xl border transition-all ${
              filter === 'active' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setFilter(filter === 'acknowledged' ? 'all' : 'acknowledged')}
            className={`p-4 rounded-xl border transition-all ${
              filter === 'acknowledged' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">{acknowledgedCount}</p>
                <p className="text-sm text-gray-500">Acknowledged</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setFilter(filter === 'resolved' ? 'all' : 'resolved')}
            className={`p-4 rounded-xl border transition-all ${
              filter === 'resolved' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">{resolvedCount}</p>
                <p className="text-sm text-gray-500">Resolved</p>
              </div>
            </div>
          </button>
        </div>

        {/* Alert List */}
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-500">No alerts matching your filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map(alert => {
              const severity = SEVERITY_CONFIG[alert.severity];
              const status = STATUS_CONFIG[alert.status];
              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl border ${severity.border} p-6`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${severity.bg}`}>
                      <severity.icon className={`w-5 h-5 ${severity.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{alert.description}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleStatusChange(alert.id, 'acknowledged')}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            onClick={() => handleStatusChange(alert.id, 'resolved')}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <AlertsContent />
    </RoleGuard>
  );
}
