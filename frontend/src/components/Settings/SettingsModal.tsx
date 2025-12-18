import { useState } from 'react';
import './SettingsModal.css';

export interface CouncilSettings {
    council_size: number;
    verification_mode: 'off' | 'consistency' | 'evidence';
    enable_cross_review: boolean;
    anonymize_reviews: boolean;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: CouncilSettings;
    onSave: (settings: CouncilSettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
    const [localSettings, setLocalSettings] = useState<CouncilSettings>(settings);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-elevated" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ Council Settings</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Council Size */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <span className="setting-title">Council Size</span>
                            <span className="setting-desc">Number of AI models in the council</span>
                        </label>
                        <div className="setting-control">
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={localSettings.council_size}
                                onChange={(e) => setLocalSettings({
                                    ...localSettings,
                                    council_size: parseInt(e.target.value)
                                })}
                                className="slider"
                            />
                            <span className="slider-value">{localSettings.council_size}</span>
                        </div>
                    </div>

                    {/* Verification Mode */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <span className="setting-title">Verification Mode</span>
                            <span className="setting-desc">How the final answer is verified</span>
                        </label>
                        <div className="setting-control">
                            <select
                                value={localSettings.verification_mode}
                                onChange={(e) => setLocalSettings({
                                    ...localSettings,
                                    verification_mode: e.target.value as 'off' | 'consistency' | 'evidence'
                                })}
                                className="select"
                            >
                                <option value="off">Off</option>
                                <option value="consistency">Consistency Check</option>
                                <option value="evidence">Evidence-Based</option>
                            </select>
                        </div>
                    </div>

                    {/* Cross Review Toggle */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <span className="setting-title">Cross-Review</span>
                            <span className="setting-desc">Models critique each other's answers</span>
                        </label>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={localSettings.enable_cross_review}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        enable_cross_review: e.target.checked
                                    })}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    {/* Anonymize Toggle */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <span className="setting-title">Anonymous Reviews</span>
                            <span className="setting-desc">Hide model identities during review</span>
                        </label>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={localSettings.anonymize_reviews}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        anonymize_reviews: e.target.checked
                                    })}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </div>
    );
}
