import {
    Env,
    Stage1Result,
    Stage4Result,
    Claim,
    COUNCIL_MODELS,
} from '../types';
import {
    STAGE4_VERIFY_CONSISTENCY_PROMPT,
    STAGE4_VERIFY_EVIDENCE_PROMPT,
} from '../prompts/stage1';

export class VerifyService {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Stage 4: Verify the chairman's answer
     */
    async verify(
        chairmanAnswer: string,
        stage1Results: Stage1Result[],
        mode: 'consistency' | 'evidence'
    ): Promise<Stage4Result> {
        if (mode === 'consistency') {
            return this.verifyConsistency(chairmanAnswer, stage1Results);
        } else {
            return this.verifyWithEvidence(chairmanAnswer);
        }
    }

    /**
     * Mode A: Consistency Checking
     * Check if claims are consistent across models
     */
    private async verifyConsistency(
        chairmanAnswer: string,
        stage1Results: Stage1Result[]
    ): Promise<Stage4Result> {
        const maxTokens = parseInt(this.env.MAX_TOKENS_STAGE4 || '400');

        // Provide all model responses for cross-checking
        const context = `
# Chairman's Final Answer
${chairmanAnswer}

# Individual Model Responses
${stage1Results.map((r, i) => `## Model ${String.fromCharCode(65 + i)}\n${r.response}`).join('\n\n')}

Extract factual claims from the Chairman's answer and check for consistency with individual model responses.
`;

        try {
            const response = await this.env.AI.run(COUNCIL_MODELS.LLAMA_3_1_8B, {
                messages: [
                    { role: 'system', content: STAGE4_VERIFY_CONSISTENCY_PROMPT },
                    { role: 'user', content: context },
                ],
                max_tokens: maxTokens,
                temperature: 0.2,
            });

            const text =
                typeof response === 'object' && 'response' in response
                    ? (response as { response: string }).response
                    : String(response);

            const parsed = this.parseJsonResponse(text);

            return {
                mode: 'consistency',
                claims: this.normalizeClaims(parsed.claims || []),
            };
        } catch (error) {
            console.error('Consistency verification failed:', error);
            return {
                mode: 'consistency',
                claims: [],
            };
        }
    }

    /**
     * Mode B: Evidence-Based Verification
     * Check claims against stored evidence cards
     */
    private async verifyWithEvidence(
        chairmanAnswer: string
    ): Promise<Stage4Result> {
        const maxTokens = parseInt(this.env.MAX_TOKENS_STAGE4 || '400');

        // In a full implementation, we would:
        // 1. Extract claims from the answer
        // 2. Query Vectorize for relevant evidence
        // 3. Check entailment/contradiction

        // For now, use the simpler approach without vector search
        const context = `
# Answer to Verify
${chairmanAnswer}

Extract factual claims and assess their verifiability. Mark claims that would require external verification as "uncertain".
`;

        try {
            const response = await this.env.AI.run(COUNCIL_MODELS.LLAMA_3_1_8B, {
                messages: [
                    { role: 'system', content: STAGE4_VERIFY_EVIDENCE_PROMPT },
                    { role: 'user', content: context },
                ],
                max_tokens: maxTokens,
                temperature: 0.2,
            });

            const text =
                typeof response === 'object' && 'response' in response
                    ? (response as { response: string }).response
                    : String(response);

            const parsed = this.parseJsonResponse(text);

            return {
                mode: 'evidence',
                claims: this.normalizeClaims(parsed.claims || []),
            };
        } catch (error) {
            console.error('Evidence verification failed:', error);
            return {
                mode: 'evidence',
                claims: [],
            };
        }
    }

    /**
     * Normalize claim labels to standard values
     */
    private normalizeClaims(claims: Claim[]): Claim[] {
        return claims.map((claim) => ({
            ...claim,
            label: this.normalizeLabel(claim.label),
        }));
    }

    /**
     * Normalize label strings
     */
    private normalizeLabel(
        label: string
    ): 'verified' | 'consistent' | 'uncertain' | 'contradicted' {
        const normalized = label.toLowerCase().trim();
        if (normalized === 'verified' || normalized === 'consistent') {
            return 'verified';
        }
        if (normalized === 'contradicted') {
            return 'contradicted';
        }
        return 'uncertain';
    }

    /**
     * Parse JSON from LLM response
     */
    private parseJsonResponse(text: string): { claims?: Claim[] } {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return {};
        } catch {
            console.error('Failed to parse verification JSON:', text);
            return {};
        }
    }
}
