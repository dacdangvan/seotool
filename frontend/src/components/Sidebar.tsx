'use client';

/**
 * Sidebar Component
 * 
 * v0.7 - Main navigation sidebar with role-based menu items
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCanAccess } from '@/components/RoleGuard';
import { ProjectSelector } from '@/components/ProjectSelector';
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Settings,
  Users,
  LogOut,
  TrendingUp,
  Search,
  Link2,
  AlertTriangle,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  requiresPermission?: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/keywords', label: 'Keywords', icon: Search },
  { href: '/backlinks', label: 'Backlinks', icon: Link2 },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle, badge: '3' },
];

const adminNavItems: NavItem[] = [
  { href: '/projects', label: 'Projects', icon: FolderKanban, requiresPermission: 'projects:edit' },
  { href: '/users', label: 'Users', icon: Users, requiresPermission: 'users:manage' },
  { href: '/settings', label: 'Settings', icon: Settings, requiresPermission: 'settings:manage' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { canEditProject, canManageUsers, canManageSettings } = useCanAccess();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const canSeeItem = (item: NavItem) => {
    if (!item.requiresPermission) return true;
    switch (item.requiresPermission) {
      case 'projects:edit':
        return canEditProject;
      case 'users:manage':
        return canManageUsers;
      case 'settings:manage':
        return canManageSettings;
      default:
        return true;
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">SEO Tool</span>
        </Link>
      </div>

      {/* Project Selector */}
      <ProjectSelector />

      {/* Main Navigation */}
      <nav className="flex-1 overflow-auto py-4">
        <div className="px-3">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Main
          </p>
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Admin Section */}
        {adminNavItems.some(canSeeItem) && (
          <div className="px-3 mt-6">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Admin
            </p>
            <ul className="space-y-1">
              {adminNavItems.filter(canSeeItem).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {user?.name?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role || 'Guest'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
