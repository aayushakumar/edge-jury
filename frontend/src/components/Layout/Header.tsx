import './Header.css';

interface HeaderProps {
    onNavClick: (view: 'chat' | 'history' | 'settings' | 'home') => void;
    isTrialMode?: boolean;
    onSignInClick?: () => void;
    user?: { id: string; email: string } | null;
    onLogout?: () => void;
}

export function Header({ onNavClick, isTrialMode = true, onSignInClick, user, onLogout }: HeaderProps) {
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
                        <button className="btn btn-primary btn-sm" onClick={onSignInClick}>
                            Sign In
                        </button>
                    ) : (
                        <div className="user-menu">
                            <span className="user-email">{user?.email}</span>
                            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
