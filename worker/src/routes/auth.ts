import { Hono } from 'hono';
import { Env } from '../types';
import { generateId } from '../utils/id';

export const authRouter = new Hono<{ Bindings: Env }>();

// Simple JWT secret - in production, use a proper secret management
const JWT_SECRET = 'edgejury-secret-key-2024';

// Hash password using Web Crypto API (built into Workers)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const newHash = await hashPassword(password);
    return newHash === hash;
}

// Create simple JWT token
function createToken(userId: string, email: string): string {
    const payload = {
        sub: userId,
        email: email,
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    };
    const base64Payload = btoa(JSON.stringify(payload));
    const signature = btoa(JSON.stringify({ alg: 'HS256' }));
    return `${signature}.${base64Payload}`;
}

// Verify and decode token
function verifyToken(token: string): { sub: string; email: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp < Date.now()) return null;

        return { sub: payload.sub, email: payload.email };
    } catch {
        return null;
    }
}

// POST /api/auth/signup
authRouter.post('/signup', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>();

    // Validate input
    if (!email || !password) {
        return c.json({ error: 'Email and password required' }, 400);
    }

    if (password.length < 6) {
        return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Check if user exists
    const existing = await c.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) {
        return c.json({ error: 'Email already registered' }, 409);
    }

    // Create user
    const id = generateId();
    const passwordHash = await hashPassword(password);

    await c.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).bind(id, email.toLowerCase(), passwordHash).run();

    // Return token
    const token = createToken(id, email.toLowerCase());

    return c.json({
        token,
        user: { id, email: email.toLowerCase() }
    }, 201);
});

// POST /api/auth/login
authRouter.post('/login', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>();

    if (!email || !password) {
        return c.json({ error: 'Email and password required' }, 400);
    }

    // Find user
    const user = await c.env.DB.prepare(
        'SELECT id, email, password_hash FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{ id: string; email: string; password_hash: string }>();

    if (!user) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Return token
    const token = createToken(user.id, user.email);

    return c.json({
        token,
        user: { id: user.id, email: user.email }
    });
});

// GET /api/auth/me - Get current user from token
authRouter.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Not authenticated' }, 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }

    return c.json({
        user: { id: decoded.sub, email: decoded.email }
    });
});

// Export helper for other routes
export { verifyToken };
