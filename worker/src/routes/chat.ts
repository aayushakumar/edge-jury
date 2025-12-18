import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Env, ChatRequest, CouncilSettings, SSEEvent, Message } from '../types';
import { CouncilService } from '../services/council';
import { ReviewService } from '../services/review';
import { ChairmanService } from '../services/chairman';
import { VerifyService } from '../services/verify';
import { generateId } from '../utils/id';

export const chatRouter = new Hono<{ Bindings: Env }>();

// POST /api/chat - Start a new council run
chatRouter.post('/', async (c) => {
    const env = c.env;

    // === SANITY CHECKS ===

    // Check required bindings
    if (!env.DB) {
        console.error('FATAL: D1 database binding (DB) is not configured');
        return c.json({
            error: 'Database not configured. Please check wrangler.toml D1 binding.'
        }, 500);
    }

    if (!env.AI) {
        console.error('FATAL: AI binding is not configured');
        return c.json({
            error: 'AI binding not configured. Please check wrangler.toml AI binding.'
        }, 500);
    }

    // Parse and validate request body
    let body: ChatRequest;
    try {
        body = await c.req.json<ChatRequest>();
    } catch (parseError) {
        console.error('Request body parsing failed:', parseError);
        return c.json({ error: 'Invalid JSON in request body' }, 400);
    }

    const { message, conversation_id, settings } = body;

    if (!message?.trim()) {
        return c.json({ error: 'Message is required' }, 400);
    }

    if (message.length > 10000) {
        return c.json({ error: 'Message too long. Maximum 10000 characters.' }, 400);
    }

    // Validate settings
    const councilSize = settings?.council_size ?? parseInt(env.COUNCIL_SIZE || '3');
    if (councilSize < 1 || councilSize > 10) {
        return c.json({ error: 'council_size must be between 1 and 10' }, 400);
    }

    const verificationMode = settings?.verification_mode ?? 'consistency';
    if (!['off', 'consistency', 'evidence'].includes(verificationMode)) {
        return c.json({
            error: 'verification_mode must be one of: off, consistency, evidence'
        }, 400);
    }

    const councilSettings: CouncilSettings = {
        council_size: councilSize,
        verification_mode: verificationMode,
        enable_cross_review: settings?.enable_cross_review ?? true,
        anonymize_reviews: settings?.anonymize_reviews ?? true,
    };

    // Extract user identity from auth token or default to 'anonymous'
    let userId = 'anonymous';
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            const parts = token.split('.');
            if (parts.length === 2) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp > Date.now() && payload.sub) {
                    userId = payload.sub;
                }
            }
        } catch {
            // Invalid token, stay anonymous
        }
    }

    // Create or get conversation with proper error handling
    let convId = conversation_id;
    let conversationHistory: Message[] = [];

    try {
        if (!convId) {
            // New conversation - associate with user
            convId = generateId();
            await env.DB.prepare(
                'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)'
            ).bind(convId, userId, message.substring(0, 50) + (message.length > 50 ? '...' : '')).run();
        } else {
            // Existing conversation - verify ownership and fetch history for context
            const convCheck = await env.DB.prepare(
                'SELECT user_id FROM conversations WHERE id = ?'
            ).bind(convId).first<{ user_id: string }>();

            if (convCheck && convCheck.user_id !== userId && convCheck.user_id !== 'anonymous') {
                return c.json({ error: 'Conversation not found' }, 404);
            }

            const historyResult = await env.DB.prepare(
                `SELECT id, conversation_id, role, model_id, content, created_at 
                 FROM messages 
                 WHERE conversation_id = ? 
                 ORDER BY created_at ASC`
            ).bind(convId).all<Message>();

            if (historyResult.results) {
                conversationHistory = historyResult.results;
                console.log(`Loaded ${conversationHistory.length} messages for conversation ${convId}`);
            }
        }
    } catch (dbError) {
        console.error('Database error with conversation:', dbError);
        return c.json({
            error: 'Database error. Please ensure the database schema is initialized (npm run db:init).'
        }, 500);
    }

    // Create user message
    let userMessageId: string;
    try {
        userMessageId = generateId();
        await env.DB.prepare(
            'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
        ).bind(userMessageId, convId, 'user', message).run();
    } catch (dbError) {
        console.error('Database error creating user message:', dbError);
        return c.json({
            error: 'Database error storing message. Please check database connectivity.'
        }, 500);
    }

    // Create run
    let runId: string;
    try {
        runId = generateId();
        const councilModels = JSON.stringify(
            CouncilService.getCouncilModels(councilSettings.council_size!)
        );
        await env.DB.prepare(
            `INSERT INTO runs (id, conversation_id, user_message_id, council_models, chairman_model_id)
     VALUES (?, ?, ?, ?, ?)`
        ).bind(runId, convId, userMessageId, councilModels, '@cf/meta/llama-3.1-8b-instruct').run();
    } catch (dbError) {
        console.error('Database error creating run:', dbError);
        return c.json({
            error: 'Database error creating run record. Please check database connectivity.'
        }, 500);
    }

    // Stream SSE response
    return streamSSE(c, async (stream) => {
        const sendEvent = async (event: SSEEvent) => {
            await stream.writeSSE({
                event: event.event,
                data: JSON.stringify(event.data),
            });
        };

        try {
            const startTime = Date.now();

            // Stage 1: First Opinions (with conversation history for context)
            await sendEvent({ event: 'stage1.start', data: { run_id: runId } });
            const council = new CouncilService(env);
            const stage1Results = await council.getFirstOpinions(message, councilSettings, conversationHistory);

            for (const result of stage1Results) {
                await sendEvent({ event: 'stage1.model_result', data: result });
            }

            await env.DB.prepare(
                "UPDATE runs SET stage1_status = 'completed', stage1_results = ? WHERE id = ?"
            ).bind(JSON.stringify(stage1Results), runId).run();
            await sendEvent({ event: 'stage1.complete', data: { results: stage1Results } });

            // Stage 2: Cross-Review (if enabled)
            let stage2Results = null;
            if (councilSettings.enable_cross_review) {
                await sendEvent({ event: 'stage2.start', data: {} });
                const reviewService = new ReviewService(env);
                stage2Results = await reviewService.crossReview(
                    stage1Results,
                    councilSettings.anonymize_reviews!
                );

                for (const review of stage2Results) {
                    await sendEvent({ event: 'stage2.review_result', data: review });
                }

                await env.DB.prepare(
                    "UPDATE runs SET stage2_status = 'completed', stage2_results = ? WHERE id = ?"
                ).bind(JSON.stringify(stage2Results), runId).run();
                await sendEvent({ event: 'stage2.complete', data: { results: stage2Results } });
            }

            // Stage 3: Chairman Synthesis (with conversation history for context)
            await sendEvent({ event: 'stage3.start', data: {} });
            const chairmanService = new ChairmanService(env);
            const stage3Result = await chairmanService.synthesize(
                message,
                stage1Results,
                stage2Results,
                conversationHistory
            );

            await env.DB.prepare(
                "UPDATE runs SET stage3_status = 'completed', stage3_results = ? WHERE id = ?"
            ).bind(JSON.stringify(stage3Result), runId).run();
            await sendEvent({ event: 'stage3.chairman_result', data: stage3Result });
            await sendEvent({ event: 'stage3.complete', data: { result: stage3Result } });

            // Stage 4: Verification (if enabled)
            let stage4Result = null;
            if (councilSettings.verification_mode !== 'off') {
                await sendEvent({ event: 'stage4.start', data: {} });
                const verifyService = new VerifyService(env);
                stage4Result = await verifyService.verify(
                    stage3Result.final_answer,
                    stage1Results,
                    councilSettings.verification_mode!
                );

                await env.DB.prepare(
                    "UPDATE runs SET stage4_status = 'completed', stage4_results = ? WHERE id = ?"
                ).bind(JSON.stringify(stage4Result), runId).run();
                await sendEvent({ event: 'stage4.verification_result', data: stage4Result });
                await sendEvent({ event: 'stage4.complete', data: { result: stage4Result } });
            }

            // Store chairman message
            await env.DB.prepare(
                'INSERT INTO messages (id, conversation_id, role, model_id, content) VALUES (?, ?, ?, ?, ?)'
            ).bind(generateId(), convId, 'chairman', '@cf/meta/llama-3.1-8b-instruct', stage3Result.final_answer).run();

            // Update run with final stats
            const latency = Date.now() - startTime;
            await env.DB.prepare(
                'UPDATE runs SET latency_ms = ? WHERE id = ?'
            ).bind(latency, runId).run();

            await sendEvent({
                event: 'done',
                data: {
                    run_id: runId,
                    conversation_id: convId,
                    latency_ms: latency,
                },
            });

        } catch (error) {
            console.error('Council run error:', error);
            await sendEvent({
                event: 'error',
                data: { message: error instanceof Error ? error.message : 'Unknown error' },
            });
        }
    });
});
