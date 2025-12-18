import { useState, useCallback } from 'react';

// Types matching backend
interface Stage1Result {
    model_id: string;
    role: string;
    response: string;
    tokens_used: number;
    latency_ms: number;
}

interface Stage2Result {
    reviewer_model_id: string;
    rankings: { candidate: string; accuracy: number; insight: number; clarity: number }[];
    issues: { candidate: string; type: string; detail: string }[];
    best_bits: { candidate: string; extract: string }[];
}

interface Stage3Result {
    final_answer: string;
    rationale: string[];
    open_questions: string[];
    disagreements: { topic: string; positions: { model: string; stance: string }[]; resolution: string }[];
}

interface Stage4Result {
    mode: 'consistency' | 'evidence';
    claims: { text: string; label: 'verified' | 'consistent' | 'uncertain' | 'contradicted'; evidence?: string; note?: string; source?: string }[];
}

interface Message {
    id: string;
    role: 'user' | 'chairman';
    content: string;
}

interface Run {
    id: string;
    conversation_id: string;
}

interface CouncilSettings {
    council_size: number;
    verification_mode: 'off' | 'consistency' | 'evidence';
    enable_cross_review: boolean;
    anonymize_reviews: boolean;
}

export function useCouncilChat(settings: CouncilSettings) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentRun, setCurrentRun] = useState<Run | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [stage1Results, setStage1Results] = useState<Stage1Result[] | null>(null);
    const [stage2Results, setStage2Results] = useState<Stage2Result[] | null>(null);
    const [stage3Result, setStage3Result] = useState<Stage3Result | null>(null);
    const [stage4Result, setStage4Result] = useState<Stage4Result | null>(null);

    const sendMessage = useCallback(async (content: string) => {
        // Add user message
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
        };
        setMessages(prev => [...prev, userMessage]);

        // Reset stage results
        setStage1Results(null);
        setStage2Results(null);
        setStage3Result(null);
        setStage4Result(null);
        setIsLoading(true);

        // Use environment variable for API URL (production) or relative path (dev)
        const apiBase = import.meta.env.VITE_API_URL || '';

        try {
            const response = await fetch(`${apiBase}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    conversation_id: currentRun?.conversation_id,
                    settings: {
                        council_size: settings.council_size,
                        verification_mode: settings.verification_mode,
                        enable_cross_review: settings.enable_cross_review,
                        anonymize_reviews: settings.anonymize_reviews,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            // Process SSE stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let buffer = '';
            const stage1Accumulator: Stage1Result[] = [];
            const stage2Accumulator: Stage2Result[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        // Event type indicator line, skip to data line
                        continue;
                    }

                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        if (!data) continue;

                        try {
                            const parsed = JSON.parse(data);

                            // Handle different event types based on data structure
                            if (parsed.model_id && parsed.role && parsed.response) {
                                // Stage 1 model result
                                stage1Accumulator.push(parsed);
                                setStage1Results([...stage1Accumulator]);
                            } else if (parsed.reviewer_model_id) {
                                // Stage 2 review result
                                stage2Accumulator.push(parsed);
                                setStage2Results([...stage2Accumulator]);
                            } else if (parsed.final_answer) {
                                // Stage 3 chairman result
                                setStage3Result(parsed);
                                // Add chairman message
                                const chairmanMessage: Message = {
                                    id: crypto.randomUUID(),
                                    role: 'chairman',
                                    content: parsed.final_answer,
                                };
                                setMessages(prev => [...prev, chairmanMessage]);
                            } else if (parsed.mode && parsed.claims) {
                                // Stage 4 verification result
                                setStage4Result(parsed);
                            } else if (parsed.run_id && parsed.conversation_id) {
                                // Done event
                                setCurrentRun({
                                    id: parsed.run_id,
                                    conversation_id: parsed.conversation_id,
                                });
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            // Add error message
            setMessages(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'chairman',
                    content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [currentRun, settings]);

    const loadConversation = useCallback(async (conversationId: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/conversations/${conversationId}`);
            if (!response.ok) throw new Error('Failed to load conversation');
            const data = await response.json();

            // Load messages from conversation
            const loadedMessages: Message[] = data.messages?.map((msg: { id: string; role: string; content: string }) => ({
                id: msg.id,
                role: msg.role === 'user' ? 'user' : 'chairman',
                content: msg.content,
            })) || [];

            setMessages(loadedMessages);
            setCurrentRun({ id: '', conversation_id: conversationId });

            // Clear stage results since we're loading a past conversation
            setStage1Results(null);
            setStage2Results(null);
            setStage3Result(null);
            setStage4Result(null);
        } catch (error) {
            console.error('Load conversation error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearConversation = useCallback(() => {
        setMessages([]);
        setCurrentRun(null);
        setStage1Results(null);
        setStage2Results(null);
        setStage3Result(null);
        setStage4Result(null);
    }, []);

    return {
        messages,
        currentRun,
        isLoading,
        sendMessage,
        stage1Results,
        stage2Results,
        stage3Result,
        stage4Result,
        loadConversation,
        clearConversation,
    };
}
