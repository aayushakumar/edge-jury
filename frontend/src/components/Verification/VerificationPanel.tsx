import './VerificationPanel.css';

interface Claim {
    text: string;
    label: 'verified' | 'consistent' | 'uncertain' | 'contradicted';
    evidence?: string;
    note?: string;
    source?: string;
}

interface Stage4Result {
    mode: 'consistency' | 'evidence';
    claims: Claim[];
}

interface VerificationPanelProps {
    result: Stage4Result | null;
    isLoading: boolean;
}

const LABEL_CONFIG = {
    verified: { icon: '+', text: 'Verified', className: 'badge-verified' },
    consistent: { icon: '+', text: 'Consistent', className: 'badge-verified' },
    uncertain: { icon: '?', text: 'Uncertain', className: 'badge-uncertain' },
    contradicted: { icon: '×', text: 'Contradicted', className: 'badge-contradicted' },
};

export function VerificationPanel({ result, isLoading }: VerificationPanelProps) {
    if (!result && !isLoading) {
        return (
            <div className="verification-empty">
                <div className="verification-empty-icon">V</div>
                <h3>No Verification Yet</h3>
                <p>Claims from the chairman's answer will be verified here</p>
            </div>
        );
    }

    if (isLoading && !result) {
        return (
            <div className="verification-loading">
                <span className="spinner" />
                <p>Verifying claims...</p>
            </div>
        );
    }

    if (!result) return null;

    const stats = {
        verified: result.claims.filter(c => c.label === 'verified' || c.label === 'consistent').length,
        uncertain: result.claims.filter(c => c.label === 'uncertain').length,
        contradicted: result.claims.filter(c => c.label === 'contradicted').length,
    };

    return (
        <div className="verification-panel">
            <div className="verification-header">
                <h3>Verification Report</h3>
                <span className={`mode-badge badge ${result.mode === 'evidence' ? 'badge-verified' : 'badge-model'}`}>
                    Mode: {result.mode === 'evidence' ? 'Evidence-Based' : 'Consistency Check'}
                </span>
            </div>

            {/* Stats Summary */}
            <div className="verification-stats">
                <div className="stat stat-verified">
                    <span className="stat-icon">+</span>
                    <span className="stat-value">{stats.verified}</span>
                    <span className="stat-label">Verified</span>
                </div>
                <div className="stat stat-uncertain">
                    <span className="stat-icon">?</span>
                    <span className="stat-value">{stats.uncertain}</span>
                    <span className="stat-label">Uncertain</span>
                </div>
                <div className="stat stat-contradicted">
                    <span className="stat-icon">×</span>
                    <span className="stat-value">{stats.contradicted}</span>
                    <span className="stat-label">Contradicted</span>
                </div>
            </div>

            {/* Claims List */}
            <div className="claims-list">
                {result.claims.map((claim, index) => {
                    const config = LABEL_CONFIG[claim.label];
                    return (
                        <div key={index} className={`claim-card card ${claim.label}`}>
                            <div className="claim-header">
                                <span className={`badge ${config.className}`}>
                                    {config.icon} {config.text}
                                </span>
                            </div>
                            <p className="claim-text">{claim.text}</p>
                            {claim.note && (
                                <p className="claim-note">{claim.note}</p>
                            )}
                            {claim.evidence && (
                                <div className="claim-evidence">
                                    <strong>Evidence:</strong> {claim.evidence}
                                    {claim.source && <span className="evidence-source">— {claim.source}</span>}
                                </div>
                            )}
                        </div>
                    );
                })}

                {result.claims.length === 0 && (
                    <div className="no-claims">
                        <p>No factual claims extracted from this response.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
