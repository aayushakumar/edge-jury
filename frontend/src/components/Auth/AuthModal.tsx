import { useState } from 'react';
import './AuthModal.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: (token: string, user: { id: string; email: string }) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const apiBase = import.meta.env.VITE_API_URL || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
            const response = await fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            // Store token in localStorage
            localStorage.setItem('edgejury_token', data.token);
            localStorage.setItem('edgejury_user', JSON.stringify(data.user));

            // Clear trial counter on successful auth
            localStorage.removeItem('edgejury_trial_chats');

            onAuthSuccess(data.token, data.user);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="auth-modal glass-elevated" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                <div className="auth-header">
                    <span className="auth-icon">⚖️</span>
                    <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                    <p>{mode === 'login' ? 'Sign in to access your history' : 'Get unlimited chats with saved history'}</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={isLoading}>
                        {isLoading ? 'Loading...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-toggle">
                    {mode === 'login' ? (
                        <p>Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></p>
                    ) : (
                        <p>Already have an account? <button onClick={() => setMode('login')}>Sign in</button></p>
                    )}
                </div>
            </div>
        </div>
    );
}
