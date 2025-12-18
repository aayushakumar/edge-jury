import './HomePage.css';

interface HomePageProps {
    onStartChat: () => void;
}

export function HomePage({ onStartChat }: HomePageProps) {
    return (
        <div className="homepage">
            <div className="homepage-content">
                {/* Hero Section */}
                <section className="hero">
                    <div className="hero-badge">⚖️ AI Council</div>
                    <h1 className="hero-title">
                        Get <span className="gradient-text">Multiple AI Opinions</span>
                        <br />In One Answer
                    </h1>
                    <p className="hero-subtitle">
                        EdgeJury runs your question through a council of AI models,
                        each with unique perspectives. A chairman synthesizes the best
                        elements into one verified answer.
                    </p>
                    <div className="hero-actions">
                        <button className="btn btn-primary btn-lg" onClick={onStartChat}>
                            🚀 Start Chatting
                        </button>
                    </div>
                </section>

                {/* Features Section */}
                <section className="features">
                    <div className="feature-card glass-elevated">
                        <div className="feature-icon">🧠</div>
                        <h3>Multi-Model Council</h3>
                        <p>4 AI models with different roles: Direct Answerer, Edge Case Finder, Step-by-Step Explainer, and Pragmatic Implementer</p>
                    </div>

                    <div className="feature-card glass-elevated">
                        <div className="feature-icon">🔄</div>
                        <h3>Cross-Review</h3>
                        <p>Models anonymously critique each other's responses, identifying issues and ranking quality</p>
                    </div>

                    <div className="feature-card glass-elevated">
                        <div className="feature-icon">👨‍⚖️</div>
                        <h3>Chairman Synthesis</h3>
                        <p>A chairman model synthesizes the best elements, resolves disagreements, and produces a final answer</p>
                    </div>

                    <div className="feature-card glass-elevated">
                        <div className="feature-icon">✅</div>
                        <h3>Verification</h3>
                        <p>Claims are extracted and checked for consistency across all model responses</p>
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="how-it-works">
                    <h2>How It Works</h2>
                    <div className="steps">
                        <div className="step">
                            <div className="step-number">1</div>
                            <h4>Ask a Question</h4>
                            <p>Enter your question or coding problem</p>
                        </div>
                        <div className="step-arrow">→</div>
                        <div className="step">
                            <div className="step-number">2</div>
                            <h4>Council Deliberates</h4>
                            <p>Multiple AI models provide unique perspectives</p>
                        </div>
                        <div className="step-arrow">→</div>
                        <div className="step">
                            <div className="step-number">3</div>
                            <h4>Synthesis & Verify</h4>
                            <p>Chairman synthesizes and verifies the answer</p>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="homepage-footer">
                    <p>Built on Cloudflare Workers • Made with ❤️ by Aayush Kumar</p>
                </footer>
            </div>
        </div>
    );
}
