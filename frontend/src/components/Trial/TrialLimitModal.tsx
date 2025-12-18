import './TrialLimitModal.css';

interface TrialLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatsUsed: number;
    maxChats: number;
}

export function TrialLimitModal({ isOpen, onClose, chatsUsed, maxChats }: TrialLimitModalProps) {
    if (!isOpen) return null;

    const isLimitReached = chatsUsed >= maxChats;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="trial-modal glass-elevated" onClick={(e) => e.stopPropagation()}>
                <div className="trial-icon">
                    {isLimitReached ? '🔒' : '⚡'}
                </div>

                <h2>{isLimitReached ? 'Trial Limit Reached' : 'Free Trial'}</h2>

                <p className="trial-count">
                    {isLimitReached ? (
                        <>You've used all <strong>{maxChats}</strong> trial chats</>
                    ) : (
                        <>You've used <strong>{chatsUsed}</strong> of <strong>{maxChats}</strong> free chats</>
                    )}
                </p>

                {isLimitReached ? (
                    <p className="trial-message">
                        Sign in to save your conversations and continue chatting with the AI council.
                    </p>
                ) : (
                    <p className="trial-message">
                        Try out EdgeJury with {maxChats - chatsUsed} more free chats.
                        Sign in anytime to save your conversations.
                    </p>
                )}

                <div className="trial-actions">
                    {isLimitReached ? (
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>
                            🔐 Sign In
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-secondary" onClick={onClose}>
                                Continue Chatting
                            </button>
                        </>
                    )}
                </div>

                <p className="trial-note">
                    Trial chats are not saved. Sign in to keep your history.
                </p>
            </div>
        </div>
    );
}
