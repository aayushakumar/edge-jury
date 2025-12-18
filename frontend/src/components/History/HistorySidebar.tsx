import { useEffect, useState } from 'react';
import './HistorySidebar.css';

interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectConversation: (id: string) => void;
    currentConversationId?: string;
    onNewConversation: () => void;
}

export function HistorySidebar({
    isOpen,
    onClose,
    onSelectConversation,
    currentConversationId,
    onNewConversation,
}: HistorySidebarProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchConversations();
        }
    }, [isOpen]);

    const fetchConversations = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/conversations');
            if (!response.ok) throw new Error('Failed to load conversations');
            const data = await response.json();
            setConversations(data.conversations || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;

        try {
            await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
            setConversations((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div className="sidebar-overlay" onClick={onClose}>
            <aside className="history-sidebar glass-elevated" onClick={(e) => e.stopPropagation()}>
                <div className="sidebar-header">
                    <h2>📜 History</h2>
                    <button className="sidebar-close" onClick={onClose}>×</button>
                </div>

                <div className="sidebar-actions">
                    <button className="btn btn-primary new-chat-btn" onClick={onNewConversation}>
                        + New Conversation
                    </button>
                </div>

                <div className="conversations-list">
                    {isLoading && (
                        <div className="sidebar-loading">
                            <div className="spinner"></div>
                            <span>Loading conversations...</span>
                        </div>
                    )}

                    {error && (
                        <div className="sidebar-error">
                            <span>⚠️ {error}</span>
                            <button onClick={fetchConversations}>Retry</button>
                        </div>
                    )}

                    {!isLoading && !error && conversations.length === 0 && (
                        <div className="sidebar-empty">
                            <span className="empty-icon">💬</span>
                            <p>No conversations yet</p>
                            <p className="empty-hint">Start chatting to create one!</p>
                        </div>
                    )}

                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                            onClick={() => {
                                onSelectConversation(conv.id);
                                onClose();
                            }}
                        >
                            <div className="conversation-info">
                                <span className="conversation-title">{conv.title}</span>
                                <span className="conversation-date">{formatDate(conv.updated_at)}</span>
                            </div>
                            <button
                                className="delete-btn"
                                onClick={(e) => handleDelete(conv.id, e)}
                                title="Delete conversation"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}
