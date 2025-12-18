import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { chatRouter } from './routes/chat';
import { conversationsRouter } from './routes/conversations';
import { runsRouter } from './routes/runs';
import { authRouter } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware for frontend
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
    return c.json({
        name: 'EdgeJury API',
        version: '0.0.1',
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// API routes
app.route('/api/auth', authRouter);
app.route('/api/chat', chatRouter);
app.route('/api/conversations', conversationsRouter);
app.route('/api/runs', runsRouter);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
