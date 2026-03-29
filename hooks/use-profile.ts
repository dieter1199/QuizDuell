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

export function useProfile() {
  const [profile, setProfile] = useState<DraftProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);

      if (!stored) {
        setProfile(createEmptyProfile());
        setReady(true);
        return;
      }

      const parsed = JSON.parse(stored) as Partial<PlayerProfile>;

      if (typeof parsed.displayName === "string" && typeof parsed.playerToken === "string") {
        setProfile({
          displayName: parsed.displayName,
          playerToken: parsed.playerToken,
        });
      } else {
        setProfile(createEmptyProfile());
      }
    } catch {
      setProfile(createEmptyProfile());
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
    window.localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
  };

  return {
    profile,
    ready,
    hasDisplayName: Boolean(profile?.displayName),
    saveProfile,
  };
}
