import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../Toast/Toast';
import './ChatPanel.css';

interface Message {
    id: string;
    role: 'user' | 'chairman';
    content: string;
}

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    currentStage?: number;
    chairmanAnswer?: string;
}

const STAGE_LABELS: Record<number, string> = {
    0: 'Starting...',
    1: 'Stage 1/4: Gathering opinions',
    2: 'Stage 2/4: Cross-reviewing',
    3: 'Stage 3/4: Synthesizing answer',
    4: 'Stage 4/4: Verifying claims',
};

export function ChatPanel({ messages, onSendMessage, isLoading, currentStage = 0, chairmanAnswer }: ChatPanelProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, chairmanAnswer]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <div className="chat-panel glass-elevated">
            <div className="chat-header">
                <h2>Council Chat</h2>
                <span className="chat-subtitle">Ask anything — the council will deliberate</span>
            </div>

            <div className="messages-container">
                {messages.length === 0 && !isLoading && (
                    <div className="empty-state">
                        <div className="empty-icon">⚖️</div>
                        <h3>Welcome to EdgeJury</h3>
                        <p>Ask a question to start a council deliberation. Multiple AI models will debate, critique each other, and synthesize a verified answer.</p>
                        <div className="example-prompts">
                            <button onClick={() => setInput("What are the pros and cons of microservices vs monolith architecture?")}>
                                Architecture advice
                            </button>
                            <button onClick={() => setInput("Explain quantum computing in simple terms")}>
                                Technical explanation
                            </button>
                            <button onClick={() => setInput("Write a Python function to find the longest palindrome substring")}>
                                Coding challenge
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-avatar">
                            {msg.role === 'user' ? 'U' : 'C'}
                        </div>
                        <div className="message-content">
                            <div className="message-header">
                                <span className="message-role">
                                    {msg.role === 'user' ? 'You' : 'Council Chairman'}
                                </span>
                                {msg.role === 'chairman' && (
                                    <button
                                        className="copy-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(msg.content);
                                            showToast('Copied to clipboard');
                                        }}
                                        title="Copy to clipboard"
                                    >
                                        Copy
                                    </button>
                                )}
                            </div>
                            <div className="message-text markdown-content">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="message chairman loading">
                        <div className="message-avatar">C</div>
                        <div className="message-content">
                            <div className="message-header">
                                <span className="message-role">Council Chairman</span>
                            </div>
                            <div className="progress-indicator">
                                <div className="progress-stage">{STAGE_LABELS[currentStage]}</div>
                                <div className="thinking-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                                <div className="progress-time">Usually takes 10-15 seconds</div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSubmit}>
                <textarea
                    className="input chat-input"
                    placeholder={isLoading ? "Type your next question..." : "Ask the council a question..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    rows={1}
                />
                <button type="submit" className="btn btn-primary send-btn" disabled={isLoading || !input.trim()}>
                    {isLoading ? <span className="spinner" /> : '→'}
                </button>
            </form>
        </div>
    );
}
