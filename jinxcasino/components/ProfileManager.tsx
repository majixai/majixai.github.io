import React, { useState } from 'react';
import { Profile, Profiles } from '../types';

interface ProfileManagerProps {
    profiles: Profiles;
    selectProfile: (name: string) => void;
    createProfile: (name: string) => { success: boolean; error?: string };
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ profiles, selectProfile, createProfile }) => {
    const [newProfileName, setNewProfileName] = useState('');
    const [error, setError] = useState('');

    const handleCreateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        if (newProfileName.trim().length < 3) {
            setError('Profile name must be at least 3 characters.');
            return;
        }
        const result = createProfile(newProfileName.trim());
        if (!result.success) {
            setError(result.error || 'Failed to create profile.');
        } else {
            setNewProfileName('');
            setError('');
        }
    };

    const existingProfileNames = Object.keys(profiles);

    return (
        <div id="profile-manager-view" className="view active">
            <div className="w3-center w3-card-4 w3-padding-large w3-round-large" style={{ backgroundColor: 'rgba(10, 25, 41, 0.9)', minWidth: '350px', maxWidth: '90vw' }}>
                <h1 className="w3-xxxlarge" style={{ color: 'var(--accent-gold)' }}>Player Profiles</h1>
                <p className="w3-text-light-grey">Select a profile or create a new one to begin.</p>

                {existingProfileNames.length > 0 && (
                    <div id="existing-profiles-container" className="w3-section">
                        <h3 className="w3-text-white">Existing Profiles</h3>
                        <div id="profile-list" style={{ maxHeight: '20vh', overflowY: 'auto', padding: '10px' }}>
                            {existingProfileNames.map(name => (
                                <button
                                    key={name}
                                    className="w3-button w3-round-large w3-margin-bottom w3-block w3-hover-amber"
                                    style={{ backgroundColor: '#2d3748' }}
                                    onClick={() => selectProfile(name)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="w3-section">
                    <h3 className="w3-text-white">Create New Profile</h3>
                    <form id="create-profile-form" onSubmit={handleCreateProfile}>
                        <input
                            id="new-profile-name"
                            className="w3-input w3-border w3-round-large w3-margin-bottom"
                            type="text"
                            placeholder="Enter Profile Name"
                            style={{ backgroundColor: '#1a202c', color: 'white' }}
                            required
                            minLength={3}
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                        />
                        <button type="submit" className="w3-button w3-round-large w3-ripple" style={{ backgroundColor: 'var(--primary-blue)' }}>Create & Play</button>
                    </form>
                    {error && <p id="profile-error" className="w3-text-red w3-margin-top">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default ProfileManager;
