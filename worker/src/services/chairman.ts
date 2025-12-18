import {
    Env,
    Stage1Result,
    Stage2Result,
    Stage3Result,
    COUNCIL_MODELS,
    Message,
} from '../types';
import { STAGE3_CHAIRMAN_PROMPT } from '../prompts/stage1';
import { ReviewService } from './review';

export class ChairmanService {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Format stage 1 results for chairman
     */
    private formatStage1(results: Stage1Result[]): string {
        return results
            .map(
                (r, i) =>
                    `## Model ${String.fromCharCode(65 + i)} (${r.role})\n${r.response}`
            )
            .join('\n\n---\n\n');
    }

    /**
     * Format stage 2 reviews for chairman
     */
    private formatStage2(reviews: Stage2Result[] | null): string {
        if (!reviews || reviews.length === 0) return 'No reviews available.';

        const allIssues = reviews.flatMap((r) => r.issues);
        const allBestBits = reviews.flatMap((r) => r.best_bits);
        const aggregatedScores = ReviewService.aggregateRankings(reviews);

        let output = '## Aggregated Rankings\n';
        for (const [candidate, score] of aggregatedScores.entries()) {
            output += `- Candidate ${candidate}: ${score} points\n`;
        }

        output += '\n## Issues Identified\n';
        for (const issue of allIssues) {
            output += `- [${issue.candidate}] ${issue.type}: ${issue.detail}\n`;
        }

        output += '\n## Best Elements\n';
        for (const bit of allBestBits) {
            output += `- [${bit.candidate}]: "${bit.extract}"\n`;
        }

        return output;
    }

    /**
     * Format conversation history for chairman context
     */
    private formatConversationHistory(history: Message[]): string {
        if (!history || history.length === 0) return 'No prior conversation.';

        // Take last 6 messages for summary
        const recent = history.slice(-6);
        return recent
            .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`)
            .join('\n');
    }

    /**
     * Stage 3: Chairman synthesizes final answer
     */
    async synthesize(
        userMessage: string,
        stage1Results: Stage1Result[],
        stage2Results: Stage2Result[] | null,
        conversationHistory: Message[] = []
    ): Promise<Stage3Result> {
        const maxTokens = parseInt(this.env.MAX_TOKENS_STAGE3 || '600');

        const context = `
# Conversation History
${this.formatConversationHistory(conversationHistory)}

# Current Question
${userMessage}

# Model Responses
${this.formatStage1(stage1Results)}

# Review Summary
${this.formatStage2(stage2Results)}
`;

        try {
            // Cast model to work with Workers AI types
            const response = await this.env.AI.run(COUNCIL_MODELS.LLAMA_3_1_8B as Parameters<Ai['run']>[0], {
                messages: [
                    { role: 'system', content: STAGE3_CHAIRMAN_PROMPT },
                    { role: 'user', content: context },
                ],
                max_tokens: maxTokens,
                temperature: 0.5,
            });

            const text =
                typeof response === 'object' && 'response' in response
                    ? (response as { response: string }).response
                    : String(response);

            // Parse JSON response
            const parsed = this.parseJsonResponse(text);

            return {
                final_answer: parsed.final_answer || text,
                rationale: parsed.rationale || [],
                open_questions: parsed.open_questions || [],
                disagreements: parsed.disagreements || [],
            };
        } catch (error) {
            console.error('Chairman synthesis failed:', error);
            // Fallback: use the highest-ranked model's response
            const fallbackResponse =
                stage1Results[0]?.response || 'Unable to generate response.';
            return {
                final_answer: fallbackResponse,
                rationale: ['Fallback: used first model response due to synthesis error'],
                open_questions: [],
                disagreements: [],
            };
        }
    }

    /**
     * Parse JSON from LLM response
     */
    private parseJsonResponse(text: string): Partial<Stage3Result> {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // If no JSON found, treat the whole response as the final answer
            return { final_answer: text };
        } catch {
            console.error('Failed to parse chairman JSON:', text);
            return { final_answer: text };
        }
    }
}
