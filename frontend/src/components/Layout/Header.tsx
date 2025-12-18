import './Header.css';

interface HeaderProps {
    onNavClick: (view: 'chat' | 'history' | 'settings' | 'home') => void;
    isTrialMode?: boolean;
}

export function Header({ onNavClick, isTrialMode = true }: HeaderProps) {
    return (
        <header className="header glass">
            <div className="header-content">
                <div className="logo" onClick={() => onNavClick('home')} style={{ cursor: 'pointer' }}>
                    <span className="logo-icon">⚖️</span>
                    <h1 className="logo-text">
                        Edge<span className="logo-accent">Jury</span>
                    </h1>
                </div>

                <nav className="nav">
                    <button className="nav-link active" onClick={() => onNavClick('chat')}>Chat</button>
                    {!isTrialMode && (
                        <button className="nav-link" onClick={() => onNavClick('history')}>History</button>
                    )}
                    <button className="nav-link" onClick={() => onNavClick('settings')}>Settings</button>
                </nav>

                <div className="header-right">
                    {isTrialMode ? (
                        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
                            Sign In
                        </button>
                    ) : (
                        <div className="budget-meter">
                            <span className="budget-label">Neurons</span>
                            <div className="budget-bar">
                                <div className="budget-fill" style={{ width: '15%' }}></div>
                            </div>
                            <span className="budget-value">1,500 / 10,000</span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
