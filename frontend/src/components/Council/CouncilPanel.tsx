import { useState } from 'react';
import './CouncilPanel.css';

interface Stage1Result {
    model_id: string;
    role: string;
    response: string;
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
    disagreements: { topic: string; positions: { model: string; stance: string }[]; resolution: string }[];
}

interface CouncilPanelProps {
    stage1Results: Stage1Result[] | null;
    stage2Results: Stage2Result[] | null;
    stage3Result: Stage3Result | null;
    isLoading: boolean;
}

const MODEL_NAMES: Record<string, string> = {
    '@cf/meta/llama-3.1-8b-instruct-fast': 'Llama 3.1 Fast',
    '@cf/meta/llama-3.1-8b-instruct': 'Llama 3.1',
    '@cf/meta/llama-3.2-3b-instruct': 'Llama 3.2',
    '@cf/mistral/mistral-7b-instruct-v0.2': 'Mistral 7B',
};

const ROLE_ICONS: Record<string, string> = {
    direct_answerer: '🎯',
    edge_case_finder: '🔍',
    step_by_step_explainer: '📝',
    pragmatic_implementer: '🛠️',
};

export function CouncilPanel({ stage1Results, stage2Results, stage3Result, isLoading }: CouncilPanelProps) {
    const [activeModelIndex, setActiveModelIndex] = useState(0);

    if (!stage1Results && !isLoading) {
        return (
            <div className="council-empty">
                <div className="council-empty-icon">🧠</div>
                <h3>Council Idle</h3>
                <p>Send a message to start the deliberation process</p>
            </div>
        );
    }

    return (
        <div className="council-panel">
            {/* Stage 1: Model Responses */}
            <section className="stage-section">
                <div className="stage-header">
                    <h3>
                        <span className="stage-number">1</span>
                        First Opinions
                    </h3>
                    {isLoading && !stage1Results && <span className="spinner" />}
                </div>

                {stage1Results && (
                    <>
                        <div className="model-tabs tabs">
                            {stage1Results.map((result, index) => (
                                <button
                                    key={result.model_id}
                                    className={`tab ${index === activeModelIndex ? 'active' : ''}`}
                                    onClick={() => setActiveModelIndex(index)}
                                >
                                    {ROLE_ICONS[result.role] || '🤖'} Model {String.fromCharCode(65 + index)}
                                </button>
                            ))}
                        </div>

                        <div className="model-response card">
                            <div className="model-info">
                                <span className="badge badge-model">
                                    {MODEL_NAMES[stage1Results[activeModelIndex].model_id] || 'Unknown'}
                                </span>
                                <span className="model-latency">
                                    {stage1Results[activeModelIndex].latency_ms}ms
                                </span>
                            </div>
                            <div className="model-response-text">
                                {stage1Results[activeModelIndex].response}
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* Stage 2: Cross-Review Summary */}
            {(stage2Results || (isLoading && stage1Results)) && (
                <section className="stage-section">
                    <div className="stage-header">
                        <h3>
                            <span className="stage-number">2</span>
                            Cross-Review
                        </h3>
                        {isLoading && !stage2Results && <span className="spinner" />}
                    </div>

                    {stage2Results && (
                        <div className="reviews-grid">
                            {/* Issues Found */}
                            <div className="review-card card">
                                <h4>⚠️ Issues Identified</h4>
                                <ul className="issues-list">
                                    {stage2Results.flatMap(r => r.issues).slice(0, 5).map((issue, i) => (
                                        <li key={i} className="issue-item">
                                            <span className="issue-candidate">Model {issue.candidate}</span>
                                            <span className="issue-type">{issue.type.replace(/_/g, ' ')}</span>
                                            <p className="issue-detail">{issue.detail}</p>
                                        </li>
                                    ))}
                                    {stage2Results.flatMap(r => r.issues).length === 0 && (
                                        <li className="no-issues">No significant issues found</li>
                                    )}
                                </ul>
                            </div>

                            {/* Best Elements */}
                            <div className="review-card card">
                                <h4>✨ Best Elements</h4>
                                <ul className="best-bits-list">
                                    {stage2Results.flatMap(r => r.best_bits).slice(0, 3).map((bit, i) => (
                                        <li key={i} className="best-bit">
                                            <span className="bit-candidate">From Model {bit.candidate}</span>
                                            <p className="bit-extract">"{bit.extract}"</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Stage 3: Chairman Rationale */}
            {(stage3Result || (isLoading && stage2Results)) && (
                <section className="stage-section">
                    <div className="stage-header">
                        <h3>
                            <span className="stage-number">3</span>
                            Chairman Synthesis
                        </h3>
                        {isLoading && !stage3Result && <span className="spinner" />}
                    </div>

                    {stage3Result && (
                        <div className="chairman-details card">
                            {/* Rationale */}
                            {stage3Result.rationale.length > 0 && (
                                <div className="rationale-section">
                                    <h4>📋 Rationale</h4>
                                    <ul className="rationale-list">
                                        {stage3Result.rationale.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Disagreements */}
                            {stage3Result.disagreements.length > 0 && (
                                <div className="disagreements-section">
                                    <h4>⚔️ Disagreements Resolved</h4>
                                    {stage3Result.disagreements.map((d, i) => (
                                        <div key={i} className="disagreement-item">
                                            <strong>{d.topic}</strong>
                                            <div className="positions">
                                                {d.positions.map((p, j) => (
                                                    <span key={j} className="position">
                                                        {p.model}: {p.stance}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="resolution">Resolution: {d.resolution}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
