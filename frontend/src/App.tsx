import { useState, useCallback } from 'react';
import { Header } from './components/Layout/Header';
import { ChatPanel } from './components/Chat/ChatPanel';
import { CouncilPanel } from './components/Council/CouncilPanel';
import { VerificationPanel } from './components/Verification/VerificationPanel';
import { SettingsModal, CouncilSettings } from './components/Settings/SettingsModal';
import { HistorySidebar } from './components/History/HistorySidebar';
import { HomePage } from './components/HomePage/HomePage';
import { useCouncilChat } from './hooks/useCouncilChat';
import './styles/app.css';

const DEFAULT_SETTINGS: CouncilSettings = {
    council_size: 3,
    verification_mode: 'consistency',
    enable_cross_review: true,
    anonymize_reviews: true,
};

function App() {
    const [currentView, setCurrentView] = useState<'home' | 'chat'>('home');
    const [activeTab, setActiveTab] = useState<'council' | 'verification'>('council');
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [councilSettings, setCouncilSettings] = useState<CouncilSettings>(DEFAULT_SETTINGS);

    const {
        messages,
        currentRun,
        isLoading,
        sendMessage,
        stage1Results,
        stage2Results,
        stage3Result,
        stage4Result,
        loadConversation,
        clearConversation,
    } = useCouncilChat(councilSettings);

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
            <Header onNavClick={handleNavClick} />

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
        </div>
    );
}

export default App;
