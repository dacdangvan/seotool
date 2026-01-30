/**
 * Auth Controller
 * API endpoints for authentication
 * 
 * Simple auth implementation for AI SEO Tool
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import { Logger } from '../../../shared/Logger';

// Simple password comparison (for dev - passwords stored as bcrypt would need bcrypt lib)
// For now, we'll use a simple comparison approach
const USERS: Record<string, { id: string; email: string; password: string; name: string; role: string; avatar: string }> = {
  'admin@seo.tool': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@seo.tool',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff',
  },
  'editor@seo.tool': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'editor@seo.tool',
    password: 'editor123',
    name: 'Editor User',
    role: 'editor',
    avatar: 'https://ui-avatars.com/api/?name=Editor+User&background=28A745&color=fff',
  },
};

// In-memory token store (for dev - in production use Redis or DB)
const tokenStore = new Map<string, { userId: string; expiresAt: Date }>();

export class AuthController {
  private readonly logger: Logger;
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.logger = new Logger('AuthController');
    this.pool = pool;
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    app.post('/api/auth/login', this.login.bind(this));
    app.post('/api/auth/logout', this.logout.bind(this));
    app.post('/api/auth/verify', this.verifyToken.bind(this));
    app.get('/api/auth/me', this.getCurrentUser.bind(this));
  }

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  async login(
    request: FastifyRequest<{ Body: { email: string; password: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { email, password } = request.body;

      this.logger.info('Login attempt', { email });

      if (!email || !password) {
        reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        });
        return;
      }

      // Check user credentials
      const user = USERS[email.toLowerCase()];
      
      if (!user || user.password !== password) {
        this.logger.warn('Invalid login attempt', { email });
        reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
        return;
      }

      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store token
      tokenStore.set(token, {
        userId: user.id,
        expiresAt,
      });

      this.logger.info('Login successful', { email, userId: user.id });

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          createdAt: '2024-01-01T00:00:00Z',
        },
        token,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      this.logger.error('Login error', { error });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during login',
        },
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout and invalidate token
   */
  async logout(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const authHeader = request.headers.authorization;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        tokenStore.delete(token);
        this.logger.info('Logout successful');
      }

      reply.send({ success: true });
    } catch (error) {
      this.logger.error('Logout error', { error });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during logout',
        },
      });
    }
  }

  /**
   * POST /api/auth/verify
   * Verify if token is valid
   */
  async verifyToken(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader?.startsWith('Bearer ')) {
        reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided',
          },
        });
        return;
      }

      const token = authHeader.substring(7);
      const session = tokenStore.get(token);

      if (!session || session.expiresAt < new Date()) {
        tokenStore.delete(token);
        reply.status(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
          },
        });
        return;
      }

      reply.send({ valid: true });
    } catch (error) {
      this.logger.error('Token verify error', { error });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during token verification',
        },
      });
    }
  }

  /**
   * GET /api/auth/me
   * Get current user profile
   */
  async getCurrentUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader?.startsWith('Bearer ')) {
        reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided',
          },
        });
        return;
      }

      const token = authHeader.substring(7);
      const session = tokenStore.get(token);

      if (!session || session.expiresAt < new Date()) {
        tokenStore.delete(token);
        reply.status(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
          },
        });
        return;
      }

      // Find user
      const user = Object.values(USERS).find(u => u.id === session.userId);
      
      if (!user) {
        reply.status(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        createdAt: '2024-01-01T00:00:00Z',
      });
    } catch (error) {
      this.logger.error('Get current user error', { error });
      reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred',
        },
      });
    }
  }
}
