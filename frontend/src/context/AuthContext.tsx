'use client';

/**
 * Auth Context
 * 
 * v0.7 - Global authentication state management
 */

import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, UserRole, AuthState, LoginCredentials, RolePermissions, Permission } from '@/types/auth';
import { authService } from '@/services/auth.service';

// Action types
type AuthAction =
  | { type: 'AUTH_INIT' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'AUTH_LOGOUT' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT':
      return { ...state, isLoading: true };
    case 'AUTH_SUCCESS':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'AUTH_FAILURE':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'AUTH_LOGOUT':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

// Context interface
interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
}

// Create context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [isClient, setIsClient] = useState(false);

  // Check if we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize auth state from storage
  useEffect(() => {
    if (!isClient) return;

    const initAuth = async () => {
      dispatch({ type: 'AUTH_INIT' });

      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
        if (stored) {
          const { user, token, expiresAt } = JSON.parse(stored);
          
          // Check if token is expired
          if (new Date(expiresAt) > new Date()) {
            // Verify token with API (optional)
            const isValid = await authService.verifyToken(token);
            if (isValid) {
              dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
              return;
            }
          }
        }
        
        // AUTO-LOGIN with mock user for development
        const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
        if (USE_MOCK) {
          const mockUser: User = {
            id: 'user-1',
            email: 'admin@seo.tool',
            name: 'Admin User',
            role: UserRole.ADMIN,
            avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff',
            createdAt: '2024-01-01T00:00:00Z',
          };
          const mockToken = 'mock-token-123';
          dispatch({ type: 'AUTH_SUCCESS', payload: { user: mockUser, token: mockToken } });
          return;
        }
        
        dispatch({ type: 'AUTH_FAILURE' });
      } catch (error) {
        console.error('Auth init error:', error);
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initAuth();
  }, [isClient]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_INIT' });

    try {
      const response = await authService.login(credentials);
      
      // Store in localStorage (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth', JSON.stringify({
          user: response.user,
          token: response.token,
          expiresAt: response.expiresAt,
        }));
      }

      dispatch({ type: 'AUTH_SUCCESS', payload: { user: response.user, token: response.token } });
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth');
    }
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  // Permission check
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!state.user) return false;
    const permissions = RolePermissions[state.user.role] as readonly string[];
    return permissions.includes(permission);
  }, [state.user]);

  // Role check
  const hasRole = useCallback((role: UserRole): boolean => {
    if (!state.user) return false;
    return state.user.role === role;
  }, [state.user]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
