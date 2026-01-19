'use client';

/**
 * RoleGuard Component
 * 
 * v0.7 - Protects routes based on user role and permissions
 */

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole, Permission } from '@/types/auth';

interface RoleGuardProps {
  children: ReactNode;
  // Require specific roles (OR logic)
  allowedRoles?: UserRole[];
  // Require specific permissions (AND logic for multiple)
  requiredPermissions?: Permission[];
  // Custom fallback URL (default: /login for unauthenticated, /dashboard for unauthorized)
  fallbackUrl?: string;
  // Show loading state while checking
  loadingComponent?: ReactNode;
}

// Default loading component
function DefaultLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function RoleGuard({
  children,
  allowedRoles,
  requiredPermissions,
  fallbackUrl,
  loadingComponent = <DefaultLoading />,
}: RoleGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();

  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return;

    // Not authenticated -> redirect to login
    if (!isAuthenticated || !user) {
      router.push(fallbackUrl || '/login');
      return;
    }

    // Check role-based access
    if (allowedRoles && allowedRoles.length > 0) {
      const hasAllowedRole = allowedRoles.some(role => hasRole(role));
      if (!hasAllowedRole) {
        router.push(fallbackUrl || '/dashboard');
        return;
      }
    }

    // Check permission-based access
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every(permission => hasPermission(permission));
      if (!hasAllPermissions) {
        router.push(fallbackUrl || '/dashboard');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, requiredPermissions, hasRole, hasPermission, router, fallbackUrl]);

  // Show loading while auth is initializing
  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return <>{loadingComponent}</>;
  }

  // Check roles
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => hasRole(role));
    if (!hasAllowedRole) {
      return <>{loadingComponent}</>;
    }
  }

  // Check permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => hasPermission(permission));
    if (!hasAllPermissions) {
      return <>{loadingComponent}</>;
    }
  }

  // Authorized
  return <>{children}</>;
}

/**
 * Higher-order component for role-based access
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<RoleGuardProps, 'children'>
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard {...options}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}

/**
 * Hook to check if user can access certain features
 */
export function useCanAccess() {
  const { hasPermission, hasRole } = useAuth();

  return {
    canCreateProject: hasPermission('projects:create'),
    canEditProject: hasPermission('projects:edit'),
    canDeleteProject: hasPermission('projects:delete'),
    canManageUsers: hasPermission('users:manage'),
    canManageSettings: hasPermission('settings:manage'),
    isAdmin: hasRole(UserRole.ADMIN),
    isEditor: hasRole(UserRole.EDITOR),
  };
}

export default RoleGuard;
