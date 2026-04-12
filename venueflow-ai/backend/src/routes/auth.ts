import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['FAN', 'STAFF', 'MANAGER']).optional().default('FAN'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateToken(user: { id: string; email: string; role: string; name: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    secret,
    { expiresIn: JWT_EXPIRES } as any
  );
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { name, email, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } }).catch(() => null);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
    }).catch(() => {
      // DB not available — return mock user
      return {
        id: `mock-${Date.now()}`,
        name,
        email,
        role: role as any,
        avatarUrl: null,
        createdAt: new Date(),
      };
    });

    const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    });
  } catch (err: any) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid credentials format' });
      return;
    }

    const { email, password } = parsed.data;

    // Demo mode: accept seeded users
    const demoUsers: Record<string, { id: string; name: string; role: string; password: string }> = {
      'manager@venueflow.ai': { id: 'seed-manager-1', name: 'Arjun Sharma', role: 'MANAGER', password: 'Manager@123' },
      'fan1@venueflow.ai': { id: 'seed-fan-1', name: 'Priya Patel', role: 'FAN', password: 'Fan@12345' },
      'staff1@venueflow.ai': { id: 'seed-staff-1', name: 'Ravi Kumar', role: 'STAFF', password: 'Staff@123' },
      'admin@venueflow.ai': { id: 'seed-admin-1', name: 'Admin User', role: 'ADMIN', password: 'Admin@123' },
    };

    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch {
      user = null;
    }

    if (!user) {
      // Try demo users
      const demoUser = demoUsers[email];
      if (demoUser && demoUser.password === password) {
        const token = generateToken({ id: demoUser.id, email, role: demoUser.role, name: demoUser.name });
        res.json({
          token,
          user: { id: demoUser.id, name: demoUser.name, email, role: demoUser.role, avatarUrl: null },
        });
        return;
      }
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'Please log in with Google for this account' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
    }).catch(() => null);

    if (!user) {
      // Return from JWT payload if DB unavailable
      res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
      return;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const newToken = generateToken(req.user as any);
  res.json({ token: newToken });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  // JWT is stateless — client should delete the token
  res.json({ message: 'Logged out successfully' });
});

// ─── Google OAuth 2.0 ──────────────────────────────────────────────────────
// Configure strategy (only when credentials are available)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || 'Google User';
        const avatarUrl = profile.photos?.[0]?.value;
        const googleId = profile.id;

        if (!email) return done(new Error('No email from Google'), undefined);

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } }).catch(() => null);

        if (!user) {
          user = await prisma.user.create({
            data: {
              name,
              email,
              googleId,
              avatarUrl: avatarUrl || null,
              role: 'FAN',
              passwordHash: null,
            },
          }).catch(() => null);
        } else if (!user.googleId) {
          // Link Google to existing account
          user = await prisma.user.update({
            where: { email },
            data: { googleId, avatarUrl: avatarUrl || user.avatarUrl },
          }).catch(() => user);
        }

        if (!user) {
          // DB unavailable — create mock user
          return done(null, {
            id: `google-${googleId}`,
            email,
            name,
            role: 'FAN',
            avatarUrl: avatarUrl || null,
          } as any);
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  ));

  // Serialize/deserialize (needed by passport, even for JWT flows)
  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));
}

// GET /api/auth/google — Initiate OAuth
router.get('/google', (req: Request, res: Response, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      error: 'Google OAuth not configured on this server',
      hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
    });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, prompt: 'select_account' })(req, res, next);
});

// GET /api/auth/google/callback — OAuth Callback
router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    passport.authenticate('google', { session: false }, (err: any, user: any) => {
      if (err || !user) {
        const reason = encodeURIComponent(err?.message || 'Google login failed');
        res.redirect(`${FRONTEND_URL}/auth/callback?error=${reason}`);
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        secret,
        { expiresIn: JWT_EXPIRES } as any
      );

      const userPayload = encodeURIComponent(JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
      }));

      res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&user=${userPayload}`);
    })(req, res, next);
  }
);

export default router;
