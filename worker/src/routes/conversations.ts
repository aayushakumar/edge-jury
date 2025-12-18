import { Hono } from 'hono';
import { Env, Conversation, Message } from '../types';
import { generateId } from '../utils/id';

export const conversationsRouter = new Hono<{ Bindings: Env }>();

// Helper to get user ID from auth token
const getUserId = (c: { req: { header: (name: string) => string | undefined } }) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            const parts = token.split('.');
            if (parts.length === 2) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp > Date.now() && payload.sub) {
                    return payload.sub as string;
                }
            }
        } catch {
            // Invalid token
        }
    }
    return 'anonymous';
};

// GET /api/conversations - List user's conversations only
conversationsRouter.get('/', async (c) => {
    const userId = getUserId(c);

    const result = await c.env.DB.prepare(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50'
    ).bind(userId).all<Conversation>();

    return c.json({ conversations: result.results });
});

// POST /api/conversations - Create new conversation for user
conversationsRouter.post('/', async (c) => {
    const userId = getUserId(c);
    const body = await c.req.json<{ title?: string }>();
    const id = generateId();
    const title = body.title || 'New Conversation';

    await c.env.DB.prepare(
        'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)'
    ).bind(id, userId, title).run();

    return c.json({ id, title }, 201);
});

// GET /api/conversations/:id - Get conversation with messages (verify ownership)
conversationsRouter.get('/:id', async (c) => {
    const userId = getUserId(c);
    const id = c.req.param('id');

    const conversation = await c.env.DB.prepare(
        'SELECT * FROM conversations WHERE id = ?'
    ).bind(id).first<Conversation & { user_id: string }>();

    if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404);
    }

    // Verify ownership (allow anonymous for backwards compatibility)
    if (conversation.user_id !== userId && conversation.user_id !== 'anonymous') {
        return c.json({ error: 'Conversation not found' }, 404);
    }

    const messages = await c.env.DB.prepare(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(id).all<Message>();

    return c.json({
        conversation,
        messages: messages.results,
    });
});

// DELETE /api/conversations/:id - Delete conversation (verify ownership)
conversationsRouter.delete('/:id', async (c) => {
    const userId = getUserId(c);
    const id = c.req.param('id');

    // Verify ownership before delete
    const conversation = await c.env.DB.prepare(
        'SELECT user_id FROM conversations WHERE id = ?'
    ).bind(id).first<{ user_id: string }>();

    if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404);
    }

    if (conversation.user_id !== userId && conversation.user_id !== 'anonymous') {
        return c.json({ error: 'Conversation not found' }, 404);
    }

    await c.env.DB.prepare(
        'DELETE FROM conversations WHERE id = ?'
    ).bind(id).run();

    return c.json({ success: true });
});

