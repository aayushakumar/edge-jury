import {
    Env,
    Stage1Result,
    ModelRole,
    CouncilSettings,
    COUNCIL_MODELS,
    CouncilModelId,
    Message,
} from '../types';
import { STAGE1_PROMPTS } from '../prompts/stage1';

export class CouncilService {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Get the list of models for the council based on size
     */
    static getCouncilModels(councilSize: number): CouncilModelId[] {
        const allModels: CouncilModelId[] = [
            COUNCIL_MODELS.LLAMA_3_1_8B_FAST,
            COUNCIL_MODELS.LLAMA_3_1_8B,
            COUNCIL_MODELS.LLAMA_3_2_3B,
            COUNCIL_MODELS.MISTRAL_7B,
        ];
        return allModels.slice(0, Math.min(councilSize, allModels.length));
    }

    /**
     * Get role assignment for each model index
     */
    private getRole(index: number): ModelRole {
        const roles: ModelRole[] = [
            'direct_answerer',
            'edge_case_finder',
            'step_by_step_explainer',
            'pragmatic_implementer',
        ];
        return roles[index % roles.length];
    }

    /**
     * Build conversation history for LLM context
     * Limits to last N messages to stay within token limits
     */
    private buildHistoryMessages(history: Message[]): { role: 'user' | 'assistant'; content: string }[] {
        // Limit to last 10 messages to avoid token limits
        const recentHistory = history.slice(-10);
        return recentHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content,
        }));
    }

    /**
     * Stage 1: Get first opinions from all council models in parallel
     */
    async getFirstOpinions(
        userMessage: string,
        settings: CouncilSettings,
        history: Message[] = []
    ): Promise<Stage1Result[]> {
        const models = CouncilService.getCouncilModels(settings.council_size || 3);
        const maxTokens = parseInt(this.env.MAX_TOKENS_STAGE1 || '400');
        const historyMessages = this.buildHistoryMessages(history);

        const promises = models.map(async (modelId, index): Promise<Stage1Result> => {
            const role = this.getRole(index);
            const systemPrompt = STAGE1_PROMPTS[role];
            const startTime = Date.now();

            try {
                // Cast modelId to work with Workers AI types
                const response = await this.env.AI.run(modelId as Parameters<Ai['run']>[0], {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...historyMessages,
                        { role: 'user', content: userMessage },
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.7,
                });

                const latency = Date.now() - startTime;
                const text = typeof response === 'object' && 'response' in response
                    ? (response as { response: string }).response
                    : String(response);

                return {
                    model_id: modelId,
                    role,
                    response: text,
                    tokens_used: Math.ceil(text.length / 4), // Rough estimate
                    latency_ms: latency,
                };
            } catch (error) {
                console.error(`Model ${modelId} failed:`, error);
                return {
                    model_id: modelId,
                    role,
                    response: `[Error: Model ${modelId} failed to respond - ${error instanceof Error ? error.message : 'Unknown error'}]`,
                    tokens_used: 0,
                    latency_ms: Date.now() - startTime,
                };
            }
        });

        return Promise.all(promises);
    }
}

