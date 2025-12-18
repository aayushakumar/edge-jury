import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { ChatPanel } from './components/Chat/ChatPanel';
import { CouncilPanel } from './components/Council/CouncilPanel';
import { VerificationPanel } from './components/Verification/VerificationPanel';
import { SettingsModal, CouncilSettings } from './components/Settings/SettingsModal';
import { HistorySidebar } from './components/History/HistorySidebar';
import { HomePage } from './components/HomePage/HomePage';
import { TrialLimitModal } from './components/Trial/TrialLimitModal';
import { AuthModal } from './components/Auth/AuthModal';
import { useCouncilChat } from './hooks/useCouncilChat';
import './styles/app.css';

const DEFAULT_SETTINGS: CouncilSettings = {
    council_size: 3,
    verification_mode: 'consistency',
    enable_cross_review: true,
    anonymize_reviews: true,
};

const TRIAL_LIMIT = 3;
const TRIAL_STORAGE_KEY = 'edgejury_trial';

interface TrialData {
    date: string;
    count: number;
}

function App() {
    const [currentView, setCurrentView] = useState<'home' | 'chat'>('home');
    const [activeTab, setActiveTab] = useState<'council' | 'verification'>('council');
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [trialChatsUsed, setTrialChatsUsed] = useState(0);
    const [councilSettings, setCouncilSettings] = useState<CouncilSettings>(DEFAULT_SETTINGS);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);

    // Check if user is authenticated
    const isAuthenticated = !!authToken && !!user;

    // Load auth and trial state on mount
    useEffect(() => {
        // Check for existing auth
        const token = localStorage.getItem('edgejury_token');
        const storedUser = localStorage.getItem('edgejury_user');
        if (token && storedUser) {
            setAuthToken(token);
            setUser(JSON.parse(storedUser));
        }

        // Load trial data with daily reset
        const today = new Date().toISOString().split('T')[0];
        const storedTrial = localStorage.getItem(TRIAL_STORAGE_KEY);
        if (storedTrial) {
            try {
                const trialData: TrialData = JSON.parse(storedTrial);
                if (trialData.date === today) {
                    setTrialChatsUsed(trialData.count);
                } else {
                    // New day, reset trial
                    localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
                    setTrialChatsUsed(0);
                }
            } catch {
                setTrialChatsUsed(0);
            }
        }
    }, []);

    const {
        messages,
        currentRun,
        isLoading,
        sendMessage: originalSendMessage,
        stage1Results,
        stage2Results,
        stage3Result,
        stage4Result,
        loadConversation,
        clearConversation,
    } = useCouncilChat(councilSettings, authToken);

    // Wrap sendMessage to track trial usage (only for non-authenticated users)
    const sendMessage = useCallback((content: string) => {
        if (isAuthenticated) {
            // Authenticated users have unlimited chats
            originalSendMessage(content, false);
            return;
        }

        // Check if trial limit reached
        if (trialChatsUsed >= TRIAL_LIMIT) {
            setShowTrialModal(true);
            return;
        }

        // Increment trial counter
        const today = new Date().toISOString().split('T')[0];
        const newCount = trialChatsUsed + 1;
        setTrialChatsUsed(newCount);
        localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ date: today, count: newCount }));

        // Send the message (with isTrialMode=true to skip DB persistence)
        originalSendMessage(content, true);

        // Show modal after limit is reached
        if (newCount >= TRIAL_LIMIT) {
            setTimeout(() => setShowTrialModal(true), 500);
        }
    }, [isAuthenticated, trialChatsUsed, originalSendMessage]);

    const handleNavClick = useCallback((view: 'chat' | 'history' | 'settings' | 'home') => {
        if (view === 'history') {
            setShowHistory(true);
        } else if (view === 'settings') {
            setShowSettings(true);
        } else if (view === 'home') {
            setCurrentView('home');
        } else if (view === 'chat') {
            setCurrentView('chat');
        }
    }, []);

    const handleNewConversation = useCallback(() => {
        clearConversation();
        setShowHistory(false);
        setCurrentView('chat');
    }, [clearConversation]);

    const handleSelectConversation = useCallback((id: string) => {
        loadConversation(id);
        setCurrentView('chat');
    }, [loadConversation]);

    const handleStartChat = useCallback(() => {
        setCurrentView('chat');
    }, []);

    const handleSignInClick = useCallback(() => {
        setShowAuthModal(true);
    }, []);

    const handleAuthSuccess = useCallback((token: string, userData: { id: string; email: string }) => {
        setAuthToken(token);
        setUser(userData);
        setShowAuthModal(false);
        // Clear trial data on successful auth
        localStorage.removeItem(TRIAL_STORAGE_KEY);
        setTrialChatsUsed(0);
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('edgejury_token');
        localStorage.removeItem('edgejury_user');
        setAuthToken(null);
        setUser(null);
        clearConversation();
    }, [clearConversation]);

    // Show homepage
    if (currentView === 'home') {
        return <HomePage onStartChat={handleStartChat} />;
    }

    // Show chat interface
    return (
        <div className="app">
            <Header
                onNavClick={handleNavClick}
                isTrialMode={!isAuthenticated}
                onSignInClick={handleSignInClick}
                user={user}
                onLogout={handleLogout}
            />

            <main className="main-content">
                <div className="content-grid">
                    {/* Left: Chat Panel */}
                    <section className="chat-section">
                        <ChatPanel
                            messages={messages}
                            onSendMessage={sendMessage}
                            isLoading={isLoading}
                            chairmanAnswer={stage3Result?.final_answer}
                        />
                    </section>

                    {/* Right: Council/Verification Panel */}
                    <section className="panel-section">
                        <div className="panel-tabs">
                            <button
                                className={`tab ${activeTab === 'council' ? 'active' : ''}`}
                                onClick={() => setActiveTab('council')}
                            >
                                🧠 Council
                            </button>
                            <button
                                className={`tab ${activeTab === 'verification' ? 'active' : ''}`}
                                onClick={() => setActiveTab('verification')}
                            >
                                ✓ Verification
                            </button>
                        </div>

                        <div className="panel-content">
                            {activeTab === 'council' ? (
                                <CouncilPanel
                                    stage1Results={stage1Results}
                                    stage2Results={stage2Results}
                                    stage3Result={stage3Result}
                                    isLoading={isLoading}
                                />
                            ) : (
                                <VerificationPanel
                                    result={stage4Result}
                                    isLoading={isLoading}
                                />
                            )}
                        </div>
                    </section>
                </div>
            </main>

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={councilSettings}
                onSave={setCouncilSettings}
            />

            {/* History Sidebar */}
            <HistorySidebar
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                onSelectConversation={handleSelectConversation}
                currentConversationId={currentRun?.conversation_id}
                onNewConversation={handleNewConversation}
            />

            {/* Trial Limit Modal */}
            <TrialLimitModal
                isOpen={showTrialModal}
                onClose={() => setShowTrialModal(false)}
                chatsUsed={trialChatsUsed}
                maxChats={TRIAL_LIMIT}
            />

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={handleAuthSuccess}
            />
        </div>
    );
}

export default App;
