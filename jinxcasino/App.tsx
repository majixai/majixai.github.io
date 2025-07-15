import React from 'react';
import { useProfiles } from './hooks/useProfiles';
import ProfileManager from './components/ProfileManager';
import { XP_TO_LEVEL } from './constants';
import { View } from './types';

const App: React.FC = () => {
    const { currentProfile, logout, createProfile, selectProfile, profiles } = useProfiles();
    const [view, setView] = React.useState<View>('profile-manager');

    React.useEffect(() => {
        if (currentProfile) {
            setView('main-menu');
        } else {
            setView('profile-manager');
        }
    }, [currentProfile]);

    const handleLogout = () => {
        logout();
        setView('profile-manager');
    }

    const renderView = () => {
        const viewProps = { setView };
        switch(view) {
            case 'profile-manager':
                return (
                    <div id="profile-manager-view" className="view active">
                        <ProfileManager
                            profiles={profiles}
                            selectProfile={selectProfile}
                            createProfile={createProfile}
                        />
                    </div>
                );
            case 'main-menu':
                return (
                    <div id="main-menu-view" className="view active">
                         <div className="w3-center">
                            <h1 className="w3-jumbo" style={{color: 'var(--accent-gold)', textShadow: '2px 2px 4px #000'}}>Jinx Vegas</h1>
                            <p className="w3-text-light-grey w3-xlarge">Choose your game</p>
                            <div className="w3-bar w3-margin-top">
                                <button onClick={() => setView('slots')} className="w3-bar-item w3-button w3-xlarge w3-round-large w3-ripple" style={{backgroundColor: 'var(--primary-blue)', marginLeft: '1rem'}}>Play Slot Clash</button>
                            </div>
                        </div>
                    </div>
                );
             case 'slots':
                 return <div className="view active w3-center"><h1 className="w3-xxxlarge">Slots Game Coming Soon!</h1></div>
            default:
                return (
                    <div id="profile-manager-view" className="view active">
                        <ProfileManager
                            profiles={profiles}
                            selectProfile={selectProfile}
                            createProfile={createProfile}
                        />
                    </div>
                );
        }
    }

    const xpProgress = currentProfile ? Math.min((currentProfile.xp / XP_TO_LEVEL(currentProfile.level)) * 100, 100) : 0;


    return (
        <div id="app-container">
            <header className="w3-bar w3-card" style={{backgroundColor: '#071321', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px'}}>
                <h3 className="w3-bar-item" style={{color: 'var(--accent-gold)', margin: 0}}>Jinx Vegas</h3>
                {currentProfile && (
                    <div id="header-profile-info" className="w3-bar-item" style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                        <div style={{textAlign: 'right'}}>
                          <span id="welcome-message" style={{fontWeight: 'bold'}}>
                            {currentProfile.name} <span style={{color: 'var(--accent-gold)'}}>(Lvl {currentProfile.level})</span>
                          </span>
                          <div id="xp-bar-container">
                              <div id="xp-bar-fill" style={{width: `${xpProgress}%`}}></div>
                          </div>
                        </div>
                        {view !== 'main-menu' && (
                            <button id="main-menu-button" onClick={() => setView('main-menu')} className="w3-button w3-round" style={{backgroundColor: 'var(--primary-blue)'}}>Menu</button>
                        )}
                        <button id="logout-button" onClick={handleLogout} className="w3-button w3-round" style={{backgroundColor: '#b91c1c'}}>Logout</button>
                    </div>
                )}
            </header>
            <main style={{flexGrow: 1, overflowY: 'auto', position: 'relative'}}>
                {renderView()}
            </main>
        </div>
    );
};

export default App;