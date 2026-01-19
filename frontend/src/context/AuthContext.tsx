'use client';

/**
 * Auth Context
 * 
 * v0.7 - Global authentication state management
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
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

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      dispatch({ type: 'AUTH_INIT' });

      try {
        const stored = localStorage.getItem('auth');
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
        dispatch({ type: 'AUTH_FAILURE' });
      } catch (error) {
        console.error('Auth init error:', error);
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_INIT' });

    try {
      const response = await authService.login(credentials);
      
      // Store in localStorage
      localStorage.setItem('auth', JSON.stringify({
        user: response.user,
        token: response.token,
        expiresAt: response.expiresAt,
      }));

      dispatch({ type: 'AUTH_SUCCESS', payload: { user: response.user, token: response.token } });
    } catch (error) {
      dispatch({ type: 'AUTH_FAILURE' });
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('auth');
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
