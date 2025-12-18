import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { ChatPanel } from './components/Chat/ChatPanel';
import { CouncilPanel } from './components/Council/CouncilPanel';
import { VerificationPanel } from './components/Verification/VerificationPanel';
import { SettingsModal, CouncilSettings } from './components/Settings/SettingsModal';
import { HistorySidebar } from './components/History/HistorySidebar';
import { HomePage } from './components/HomePage/HomePage';
import { TrialLimitModal } from './components/Trial/TrialLimitModal';
import { useCouncilChat } from './hooks/useCouncilChat';
import './styles/app.css';

const DEFAULT_SETTINGS: CouncilSettings = {
    council_size: 3,
    verification_mode: 'consistency',
    enable_cross_review: true,
    anonymize_reviews: true,
};

const TRIAL_LIMIT = 3;
const TRIAL_STORAGE_KEY = 'edgejury_trial_chats';

function App() {
    const [currentView, setCurrentView] = useState<'home' | 'chat'>('home');
    const [activeTab, setActiveTab] = useState<'council' | 'verification'>('council');
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [trialChatsUsed, setTrialChatsUsed] = useState(0);
    const [councilSettings, setCouncilSettings] = useState<CouncilSettings>(DEFAULT_SETTINGS);

    // Load trial count from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(TRIAL_STORAGE_KEY);
        if (stored) {
            setTrialChatsUsed(parseInt(stored, 10) || 0);
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
    } = useCouncilChat(councilSettings);

    // Wrap sendMessage to track trial usage
    const sendMessage = useCallback((content: string) => {
        // Check if trial limit reached
        if (trialChatsUsed >= TRIAL_LIMIT) {
            setShowTrialModal(true);
            return;
        }

        // Increment trial counter
        const newCount = trialChatsUsed + 1;
        setTrialChatsUsed(newCount);
        localStorage.setItem(TRIAL_STORAGE_KEY, newCount.toString());

        // Send the message (with isTrialMode=true to skip DB persistence)
        originalSendMessage(content, true);

        // Show modal after limit is reached
        if (newCount >= TRIAL_LIMIT) {
            setTimeout(() => setShowTrialModal(true), 500);
        }
    }, [trialChatsUsed, originalSendMessage]);

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

    // Show homepage
    if (currentView === 'home') {
        return <HomePage onStartChat={handleStartChat} />;
    }

    // Show chat interface
    return (
        <div className="app">
            <Header onNavClick={handleNavClick} isTrialMode={trialChatsUsed < TRIAL_LIMIT} />

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
        </div>
    );
}

export default App;
