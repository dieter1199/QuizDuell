"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { HEARTBEAT_INTERVAL_MS, ROOM_SYNC_INTERVAL_MS } from "@/lib/constants";
import { requestJson } from "@/lib/fetcher";
import type { PlayerProfile, RoomSnapshot } from "@/types/app";

type SnapshotResponse = {
  snapshot: RoomSnapshot;
};

type RoomCodeResponse = {
  roomCode: string;
};

export function useRoom(code: string, profile: PlayerProfile | null) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasJoinedRef = useRef(false);

  const roomPath = useMemo(() => `/api/rooms/${code}`, [code]);

  const applySnapshot = useCallback((nextSnapshot: RoomSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
    });
  }, [startTransition]);

  const refreshSnapshot = useCallback(async () => {
    if (!profile?.playerToken) {
      return;
    }

    try {
      const payload = await requestJson<SnapshotResponse>(
        `${roomPath}?playerToken=${encodeURIComponent(profile.playerToken)}`,
      );
      setError(null);
      applySnapshot(payload.snapshot);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh the room.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, profile?.playerToken, roomPath]);

  const joinRoom = useCallback(async () => {
    if (!profile) {
      return;
    }

    try {
      const payload = await requestJson<SnapshotResponse>("/api/rooms/join", {
        method: "POST",
        body: {
          roomCode: code,
          displayName: profile.displayName,
          playerToken: profile.playerToken,
        },
      });
      hasJoinedRef.current = true;
      setError(null);
      applySnapshot(payload.snapshot);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join the room.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, code, profile]);

  useEffect(() => {
    if (!profile?.displayName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    hasJoinedRef.current = false;
    void joinRoom();
  }, [code, profile?.displayName, profile?.playerToken, joinRoom]);

  useEffect(() => {
    if (!hasJoinedRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, ROOM_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshSnapshot, snapshot?.room.id]);

  useEffect(() => {
    if (!snapshot?.me || snapshot.me.status !== "active") {
      return;
    }

    const heartbeat = window.setInterval(() => {
      void requestJson<SnapshotResponse>(`${roomPath}/actions`, {
        method: "POST",
        body: {
          action: "heartbeat",
          playerToken: snapshot.me!.player_token,
        },
      })
        .then((payload) => {
          applySnapshot(payload.snapshot);
        })
        .catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [applySnapshot, roomPath, snapshot?.me]);

  useEffect(() => {
    if (
      !snapshot?.game ||
      snapshot.game.session.phase === "finished" ||
      snapshot.game.session.phase !== "question" ||
      snapshot.game.session.is_paused
    ) {
      return;
    }

    const msUntilAdvance =
      new Date(snapshot.game.session.phase_ends_at).getTime() - Date.now() + 150;

    const timeout = window.setTimeout(() => {
      void requestJson<SnapshotResponse>(`/api/games/${snapshot.game!.session.id}/actions`, {
        method: "POST",
        body: {
          action: "advance",
          playerToken: profile?.playerToken,
        },
      })
        .then((payload) => {
          applySnapshot(payload.snapshot);
        })
        .catch(() => {});
    }, Math.max(250, msUntilAdvance));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [applySnapshot, profile?.playerToken, snapshot?.game]);

  const createRoom = useCallback(async () => {
    if (!profile) {
      throw new Error("Profile missing.");
    }

    return requestJson<RoomCodeResponse>("/api/rooms", {
      method: "POST",
      body: {
        displayName: profile.displayName,
        playerToken: profile.playerToken,
      },
    });
  }, [profile]);

  const leaveRoom = useCallback(async () => {
    if (!snapshot?.me) {
      return;
    }

    await requestJson<{ ok: boolean }>(`${roomPath}/actions`, {
      method: "POST",
      body: {
        action: "leave",
        playerToken: snapshot.me.player_token,
      },
    });
  }, [roomPath, snapshot?.me]);

  const roomAction = useCallback(
    async (body: Record<string, unknown>) => {
      const payload = await requestJson<SnapshotResponse>(`${roomPath}/actions`, {
        method: "POST",
        body,
      });

      if (payload.snapshot) {
        applySnapshot(payload.snapshot);
      }

      return payload.snapshot;
    },
    [applySnapshot, roomPath],
  );

  const gameAction = useCallback(
    async (body: Record<string, unknown>) => {
      if (!snapshot?.game) {
        throw new Error("No active game.");
      }

      const payload = await requestJson<SnapshotResponse>(
        `/api/games/${snapshot.game.session.id}/actions`,
        {
          method: "POST",
          body,
        },
      );

      if (payload.snapshot) {
        applySnapshot(payload.snapshot);
      }

      return payload.snapshot;
    },
    [applySnapshot, snapshot?.game],
  );

  return useMemo(
    () => ({
      snapshot,
      loading,
      busy: isPending,
      error,
      refresh: refreshSnapshot,
      updateSnapshot: applySnapshot,
      createRoom,
      leaveRoom,
      roomAction,
      gameAction,
    }),
    [
      applySnapshot,
      createRoom,
      error,
      gameAction,
      isPending,
      leaveRoom,
      loading,
      refreshSnapshot,
      roomAction,
      snapshot,
    ],
  );
}
