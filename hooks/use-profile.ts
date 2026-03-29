"use client";

import { useEffect, useState } from "react";

import { PLAYER_PROFILE_STORAGE_KEY } from "@/lib/constants";
import { generatePlayerToken } from "@/lib/utils";
import type { PlayerProfile } from "@/types/app";

type DraftProfile = {
  displayName: string;
  playerToken: string;
};

function createEmptyProfile(): DraftProfile {
  return {
    displayName: "",
    playerToken: generatePlayerToken(),
  };
}

function persistProfile(profile: DraftProfile) {
  window.localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function useProfile() {
  const [profile, setProfile] = useState<DraftProfile>(createEmptyProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);

      if (!stored) {
        const emptyProfile = createEmptyProfile();
        setProfile(emptyProfile);
        persistProfile(emptyProfile);
        setReady(true);
        return;
      }

      const parsed = JSON.parse(stored) as Partial<PlayerProfile>;

      if (typeof parsed.displayName === "string") {
        const nextProfile = {
          displayName: parsed.displayName,
          playerToken:
            typeof parsed.playerToken === "string" && parsed.playerToken.length > 0
              ? parsed.playerToken
              : generatePlayerToken(),
        };

        setProfile(nextProfile);
        persistProfile(nextProfile);
      } else {
        const emptyProfile = createEmptyProfile();
        setProfile(emptyProfile);
        persistProfile(emptyProfile);
      }
    } catch {
      const emptyProfile = createEmptyProfile();
      setProfile(emptyProfile);
      persistProfile(emptyProfile);
    } finally {
      setReady(true);
    }
  }, []);

  const saveProfile = (displayName: string) => {
    const nextProfile = {
      displayName,
      playerToken: profile?.playerToken ?? generatePlayerToken(),
    };

    setProfile(nextProfile);
    persistProfile(nextProfile);
  };

  return {
    profile,
    ready,
    hasDisplayName: Boolean(profile?.displayName),
    saveProfile,
  };
}
