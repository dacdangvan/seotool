/**
 * Auth Service
 * 
 * v0.7 - Authentication API service with mock support
 */

import { LoginCredentials, AuthResponse, User, UserRole } from '@/types/auth';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// Mock users for development
const MOCK_USERS: Record<string, { user: User; password: string }> = {
  'admin@seo.tool': {
    user: {
      id: 'user-1',
      email: 'admin@seo.tool',
      name: 'Admin User',
      role: UserRole.ADMIN,
      avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff',
      createdAt: '2024-01-01T00:00:00Z',
    },
    password: 'admin123',
  },
  'editor@seo.tool': {
    user: {
      id: 'user-2',
      email: 'editor@seo.tool',
      name: 'Editor User',
      role: UserRole.EDITOR,
      avatar: 'https://ui-avatars.com/api/?name=Editor+User&background=28A745&color=fff',
      createdAt: '2024-01-15T00:00:00Z',
    },
    password: 'editor123',
  },
  'editor2@seo.tool': {
    user: {
      id: 'user-3',
      email: 'editor2@seo.tool',
      name: 'Jane Editor',
      role: UserRole.EDITOR,
      avatar: 'https://ui-avatars.com/api/?name=Jane+Editor&background=DC3545&color=fff',
      createdAt: '2024-02-01T00:00:00Z',
    },
    password: 'editor123',
  },
};

// Simulated delay for mock API
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (USE_MOCK) {
      return this.mockLogin(credentials);
    }

    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  }

  /**
   * Verify token is still valid
   */
  async verifyToken(token: string): Promise<boolean> {
    if (USE_MOCK) {
      // Mock: token is valid if it starts with 'mock-token-'
      return token.startsWith('mock-token-');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(token: string): Promise<User> {
    if (USE_MOCK) {
      return this.mockGetCurrentUser(token);
    }

    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    return response.json();
  }

  /**
   * Logout (invalidate token)
   */
  async logout(token: string): Promise<void> {
    if (USE_MOCK) {
      await mockDelay(100);
      return;
    }

    await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // Mock implementations
  private async mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    await mockDelay();

    const mockUser = MOCK_USERS[credentials.email];
    
    if (!mockUser || mockUser.password !== credentials.password) {
      throw new Error('Invalid email or password');
    }

    // Generate mock token
    const token = `mock-token-${mockUser.user.id}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    return {
      user: mockUser.user,
      token,
      expiresAt,
    };
  }

  private async mockGetCurrentUser(token: string): Promise<User> {
    await mockDelay(200);

    // Extract user ID from mock token
    const parts = token.split('-');
    if (parts.length < 3) {
      throw new Error('Invalid token');
    }

    const userId = parts[2];
    const mockUser = Object.values(MOCK_USERS).find(u => u.user.id === userId);
    
    if (!mockUser) {
      throw new Error('User not found');
    }

    return mockUser.user;
  }
}

export const authService = new AuthService();
export default authService;
