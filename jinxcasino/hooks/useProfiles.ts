import { useState, useEffect, useCallback } from 'react';
import { Profile, Profiles } from '../types';

const PROFILES_KEY = 'jinx_vegas_profiles';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<Profiles>({});
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const storedProfiles = localStorage.getItem(PROFILES_KEY);
      if (storedProfiles) {
        setProfiles(JSON.parse(storedProfiles));
      }
    } catch (e) {
      console.error("Failed to load profiles:", e);
      setProfiles({});
    }
  }, []);

  const saveProfiles = useCallback((updatedProfiles: Profiles) => {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(updatedProfiles));
    } catch (e) {
      console.error("Failed to save profiles:", e);
    }
  }, []);

  const selectProfile = useCallback((name: string) => {
    const profileData = profiles[name] || { level: 1, xp: 0 };
    const newProfile = { name, ...profileData };
    setCurrentProfile(newProfile);
  }, [profiles]);

  const createProfile = useCallback((name: string): {success: boolean, error?: string} => {
    if (profiles[name]) {
      return { success: false, error: 'Profile name already exists.' };
    }
    const newProfileData = { level: 1, xp: 0 };
    const updatedProfiles = { ...profiles, [name]: newProfileData };
    setProfiles(updatedProfiles);
    saveProfiles(updatedProfiles);
    selectProfile(name);
    return { success: true };
  }, [profiles, saveProfiles, selectProfile]);

  const logout = useCallback(() => {
    if (currentProfile) {
        // Save final progress on logout
        const { name, ...data } = currentProfile;
        const updatedProfiles = { ...profiles, [name]: data };
        setProfiles(updatedProfiles);
        saveProfiles(updatedProfiles);
    }
    setCurrentProfile(null);
  }, [currentProfile, profiles, saveProfiles]);

  return {
    profiles,
    currentProfile,
    selectProfile,
    createProfile,
    logout,
  };
};
