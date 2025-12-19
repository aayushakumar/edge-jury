import { Env } from '../types';

export interface RunTrace {
    run_id: string;
    timestamp: string;
    colo: string;  // Edge location (Cloudflare colo code)
    user_id?: string;
    session_id?: string;

    // Request info
    question: string;
    council_size: number;
    enable_cross_review: boolean;
    verification_mode: string;

    // Stage timings
    stages: {
        stage: string;
        start_time: number;
        end_time: number;
        duration_ms: number;
        success: boolean;
        retries: number;
        fallback_used: boolean;
        token_count: number;
        output_length: number;
    }[];

    // Outputs
    stage1_results?: object[];
    stage2_results?: object[];
    stage3_result?: object;
    stage4_result?: object;

    // Aggregates
    total_latency_ms: number;
    total_tokens: number;
    cache_hit: boolean;
    error?: string;
}

export class EvalLogger {
    private env: Env;
    private trace: Partial<RunTrace>;
    private stageStartTimes: Map<string, number> = new Map();

    constructor(env: Env) {
        this.env = env;
        this.trace = {
            run_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            stages: [],
            total_tokens: 0,
            cache_hit: false,
        };
    }

    setRequestInfo(info: {
        colo?: string;
        user_id?: string;
        session_id?: string;
        question: string;
        council_size: number;
        enable_cross_review: boolean;
        verification_mode: string;
    }) {
        this.trace = { ...this.trace, ...info };
    }

    startStage(stage: string) {
        this.stageStartTimes.set(stage, Date.now());
    }

    endStage(stage: string, result: {
        success: boolean;
        retries?: number;
        fallback_used?: boolean;
        token_count?: number;
        output_length?: number;
        output?: object | object[];
    }) {
        const startTime = this.stageStartTimes.get(stage) || Date.now();
        const endTime = Date.now();

        this.trace.stages?.push({
            stage,
            start_time: startTime,
            end_time: endTime,
            duration_ms: endTime - startTime,
            success: result.success,
            retries: result.retries || 0,
            fallback_used: result.fallback_used || false,
            token_count: result.token_count || 0,
            output_length: result.output_length || 0,
        });

        // Store outputs
        if (result.output) {
            if (stage === 'stage1') this.trace.stage1_results = result.output as object[];
            if (stage === 'stage2') this.trace.stage2_results = result.output as object[];
            if (stage === 'stage3') this.trace.stage3_result = result.output as object;
            if (stage === 'stage4') this.trace.stage4_result = result.output as object;
        }

        this.trace.total_tokens = (this.trace.total_tokens || 0) + (result.token_count || 0);
    }

    setError(error: string) {
        this.trace.error = error;
    }

    setCacheHit(hit: boolean) {
        this.trace.cache_hit = hit;
    }

    finalize(): RunTrace {
        const stages = this.trace.stages || [];
        const firstStart = stages.length > 0 ? Math.min(...stages.map(s => s.start_time)) : Date.now();
        const lastEnd = stages.length > 0 ? Math.max(...stages.map(s => s.end_time)) : Date.now();

        this.trace.total_latency_ms = lastEnd - firstStart;

        return this.trace as RunTrace;
    }

    async save(): Promise<void> {
        const trace = this.finalize();

        try {
            await this.env.DB.prepare(`
                INSERT INTO eval_runs (
                    run_id, timestamp, colo, user_id, session_id,
                    question, council_size, enable_cross_review, verification_mode,
                    stages_json, stage1_json, stage2_json, stage3_json, stage4_json,
                    total_latency_ms, total_tokens, cache_hit, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                trace.run_id,
                trace.timestamp,
                trace.colo || 'unknown',
                trace.user_id || null,
                trace.session_id || null,
                trace.question,
                trace.council_size,
                trace.enable_cross_review ? 1 : 0,
                trace.verification_mode,
                JSON.stringify(trace.stages),
                JSON.stringify(trace.stage1_results || []),
                JSON.stringify(trace.stage2_results || []),
                JSON.stringify(trace.stage3_result || {}),
                JSON.stringify(trace.stage4_result || {}),
                trace.total_latency_ms,
                trace.total_tokens,
                trace.cache_hit ? 1 : 0,
                trace.error || null
            ).run();
        } catch (error) {
            console.error('Failed to save eval run:', error);
        }
    }

    toJSONL(): string {
        return JSON.stringify(this.finalize());
    }
}
