import { Env, Stage1Result, Stage2Result, COUNCIL_MODELS } from '../types';
import { STAGE2_REVIEW_PROMPT } from '../prompts/stage1';

export class ReviewService {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Anonymize model responses for cross-review
     */
    private anonymizeResponses(results: Stage1Result[]): string {
        return results
            .map((r, i) => `## Candidate ${String.fromCharCode(65 + i)}\n${r.response}`)
            .join('\n\n---\n\n');
    }

    /**
     * Stage 2: Have each model review the others' responses
     */
    async crossReview(
        stage1Results: Stage1Result[],
        anonymize: boolean = true
    ): Promise<Stage2Result[]> {
        const maxTokens = parseInt(this.env.MAX_TOKENS_STAGE2 || '300');
        const anonymizedContent = anonymize
            ? this.anonymizeResponses(stage1Results)
            : stage1Results.map((r) => `## ${r.model_id}\n${r.response}`).join('\n\n---\n\n');

        // Each model reviews all responses
        const reviewerModels = stage1Results.map((r) => r.model_id);

        const promises = reviewerModels.map(async (modelId): Promise<Stage2Result> => {
            try {
                const response = await this.env.AI.run(modelId as Parameters<Ai['run']>[0], {
                    messages: [
                        { role: 'system', content: STAGE2_REVIEW_PROMPT },
                        {
                            role: 'user',
                            content: `Review these candidate responses:\n\n${anonymizedContent}`,
                        },
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.3, // Lower temperature for more consistent JSON
                });

                const text = typeof response === 'object' && 'response' in response
                    ? (response as { response: string }).response
                    : String(response);

                // Parse JSON response
                const parsed = this.parseJsonResponse(text);

                return {
                    reviewer_model_id: modelId,
                    rankings: parsed.rankings || [],
                    issues: parsed.issues || [],
                    best_bits: parsed.best_bits || [],
                };
            } catch (error) {
                console.error(`Review by ${modelId} failed:`, error);
                return {
                    reviewer_model_id: modelId,
                    rankings: [],
                    issues: [],
                    best_bits: [],
                };
            }
        });

        return Promise.all(promises);
    }

    /**
     * Parse JSON from LLM response, handling common issues
     */
    private parseJsonResponse(text: string): Partial<Stage2Result> {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return {};
        } catch {
            console.error('Failed to parse review JSON:', text);
            return {};
        }
    }

    /**
     * Aggregate rankings from multiple reviews
     */
    static aggregateRankings(reviews: Stage2Result[]): Map<string, number> {
        const scores = new Map<string, number>();

        for (const review of reviews) {
            for (const ranking of review.rankings) {
                const total = ranking.accuracy + ranking.insight + ranking.clarity;
                const current = scores.get(ranking.candidate) || 0;
                scores.set(ranking.candidate, current + total);
            }
        }

        return scores;
    }
}
