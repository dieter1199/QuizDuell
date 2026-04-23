"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  DoorOpen,
  Pause,
  Play,
  RefreshCcw,
  Settings2,
  Share2,
  TimerReset,
  Trophy,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CategoryManager } from "@/components/category-manager";
import { NameDialog } from "@/components/name-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { useQuizSounds } from "@/hooks/use-quiz-sounds";
import { useRoom } from "@/hooks/use-room";
import { requestJson } from "@/lib/fetcher";
import { cn, copyText, formatCountdown, sortNumberArray } from "@/lib/utils";
import { roomSettingsSchema } from "@/lib/validation";
import type {
  CategoryWithQuestions,
  PlayerGameReview,
  QuestionInput,
  RoomSettings,
} from "@/types/app";

type CategoryBankResponse = {
  categories: CategoryWithQuestions[];
};

type RoomPageProps = {
  code: string;
};

function formatLockStatusText(displayName: string, isCurrentPlayer: boolean) {
  return isCurrentPlayer ? "You locked in" : `${displayName} locked in`;
}

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  "8450f627-c6ea-4c99-94fb-0ac3dbf3c01c":
    "border-cyan-300/25 bg-cyan-400/12 text-cyan-100",
  "ac075087-55b4-4150-9bb4-f29c351c4a93":
    "border-emerald-300/25 bg-emerald-400/12 text-emerald-100",
  "4288414e-55e1-40e0-97a6-8b63d559329e":
    "border-orange-300/25 bg-orange-400/12 text-orange-100",
  "03a3594d-bd75-43a6-a4ae-63f79aaab321":
    "border-sky-300/25 bg-sky-400/12 text-sky-100",
  "67371317-7dd7-48ad-9ee6-29cc33ceb1f0":
    "border-violet-300/25 bg-violet-400/12 text-violet-100",
  "eb817fe6-d403-4c80-abe4-bf1d1345aefb":
    "border-rose-300/25 bg-rose-400/12 text-rose-100",
};

function getCategoryBadgeClass(categoryId?: string | null) {
  return categoryId ? (CATEGORY_BADGE_CLASSES[categoryId] ?? "border-white/10 bg-white/6 text-slate-200") : "border-white/10 bg-white/6 text-slate-200";
}

function formatCorrectRatio(correctCount: number, answeredCount: number) {
  return `${correctCount}/${answeredCount}`;
}

function AnswerChip({
  selected,
  disabled,
  correct,
  children,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  correct?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full rounded-[24px] border px-4 py-4 text-left text-base transition",
        correct
          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-50"
          : selected
            ? "border-amber-300/40 bg-amber-400/12 text-white"
            : "border-white/10 bg-slate-950/55 text-slate-100 hover:bg-white/6",
        disabled ? "cursor-not-allowed opacity-80" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SmoothQuestionTimerBar({
  phaseEndsAt,
  pausedMsRemaining,
  paused,
  roundId,
  timerSeconds,
}: {
  phaseEndsAt: string;
  pausedMsRemaining: number | null;
  paused: boolean;
  roundId: string;
  timerSeconds: number;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const barElement = barRef.current;

    if (!barElement) {
      return;
    }

    const remainingMs = paused
      ? Math.max(0, pausedMsRemaining ?? 0)
      : Math.max(0, new Date(phaseEndsAt).getTime() - Date.now());
    const nextProgress = timerSeconds > 0
      ? Math.min(1, Math.max(0, remainingMs / (timerSeconds * 1000)))
      : 0;
    let frameId: number | null = null;

    barElement.style.transitionDuration = "0ms";
    barElement.style.transform = `scaleX(${nextProgress})`;

    if (!paused && remainingMs > 0) {
      frameId = window.requestAnimationFrame(() => {
        if (!barRef.current) {
          return;
        }

        barRef.current.style.transitionDuration = `${remainingMs}ms`;
        barRef.current.style.transform = "scaleX(0)";
      });
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [paused, pausedMsRemaining, phaseEndsAt, roundId, timerSeconds]);

  return (
    <div className="h-3 overflow-hidden rounded-full bg-white/6">
      <div
        ref={barRef}
        className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#fb923c,#facc15)] transition-[transform] will-change-transform"
        style={{
          transform: "scaleX(1)",
          transitionDuration: "0ms",
          transitionTimingFunction: "linear",
        }}
      />
    </div>
  );
}

export function RoomPage({ code }: RoomPageProps) {
  const router = useRouter();
  const { profile, ready, hasDisplayName, saveProfile } = useProfile();
  const sounds = useQuizSounds();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [showWrongQuestions, setShowWrongQuestions] = useState(false);
  const [selectedReviewPlayerId, setSelectedReviewPlayerId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);
  const [isSettingsDraftDirty, setIsSettingsDraftDirty] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seenSubmissionIdsRef = useRef<Set<string>>(new Set());

  const room = useRoom(code, profile && hasDisplayName ? profile : null);
  const gameAction = room.gameAction;
  const playLockSound = sounds.playLockSound;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (room.snapshot?.room.settings) {
      if (settingsDraft && isSettingsDraftDirty) {
        return;
      }

      setSettingsDraft(room.snapshot.room.settings);
    }
  }, [isSettingsDraftDirty, room.snapshot?.room.settings, settingsDraft]);

  useEffect(() => {
    setSelectedIndexes([]);
  }, [room.snapshot?.game?.currentRound?.round.id]);

  const activePlayers = useMemo(
    () => room.snapshot?.players.filter((player) => player.status === "active") ?? [],
    [room.snapshot?.players],
  );
  const isHost = Boolean(room.snapshot?.me?.is_host);
  const game = room.snapshot?.game;
  const currentRound = game?.currentRound;
  const isGamePaused = Boolean(game?.session.is_paused);
  const isQuestionPhase = game?.session.phase === "question";
  const isRevealPhase = game?.session.phase === "reveal";
  const isLiveGame = Boolean(
    game && room.snapshot?.room.status === "active" && game.session.status === "active",
  );
  const hasSubmitted = Boolean(
    room.snapshot?.me &&
      currentRound?.submissions.some((submission) => submission.player_id === room.snapshot?.me?.id),
  );
  const myPlayerToken = room.snapshot?.me?.player_token ?? null;
  const lockedPlayers = useMemo(() => {
    if (!currentRound || game?.session.phase !== "question") {
      return [];
    }

    return currentRound.submissions.filter((submission) => !submission.timed_out);
  }, [currentRound, game?.session.phase]);
  const categoryLookup = useMemo(
    () => new Map((room.snapshot?.categories ?? []).map((category) => [category.id, category])),
    [room.snapshot?.categories],
  );
  const currentCategory = currentRound ? categoryLookup.get(currentRound.question.category_id) ?? null : null;
  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";
  const activeGameId = game?.session.id ?? null;
  const activePhase = game?.session.phase ?? null;
  const activePhaseEndsAt = game?.session.phase_ends_at ?? null;
  const currentRoundId = currentRound?.round.id ?? null;
  const phaseMsRemaining = game && isQuestionPhase
    ? game.session.is_paused
      ? game.session.paused_ms_remaining ?? 0
      : Math.max(0, new Date(game.session.phase_ends_at).getTime() - now)
    : 0;
  const phaseSecondsRemaining = formatCountdown(phaseMsRemaining);
  const selectedQuestionCount = useMemo(() => {
    if (!settingsDraft || !room.snapshot?.categories) {
      return 0;
    }

    return room.snapshot.categories
      .filter((category) => settingsDraft.selectedCategoryIds.includes(category.id))
      .reduce((count, category) => count + category.questions.length, 0);
  }, [room.snapshot?.categories, settingsDraft]);
  const plannedQuestionCount = settingsDraft?.useAllQuestions
    ? selectedQuestionCount
    : (settingsDraft?.questionCount ?? 20);
  const isLastRound = Boolean(
    game && game.session.current_round_number >= game.session.total_rounds,
  );
  const canAdvanceToNext = Boolean(game && isRevealPhase && !isGamePaused);
  const showQuickLinks = !game || game.session.status !== "active";
  const orderedReviewPlayers = useMemo(() => {
    if (!game) {
      return [];
    }

    const reviewLookup = new Map(
      game.playerReviews.map((review) => [review.playerId, review] as const),
    );
    const ordered: PlayerGameReview[] = [];

    for (const leaderboardEntry of game.leaderboard) {
      const review = reviewLookup.get(leaderboardEntry.playerId);

      if (!review) {
        continue;
      }

      ordered.push(review);
      reviewLookup.delete(leaderboardEntry.playerId);
    }

    return [...ordered, ...reviewLookup.values()];
  }, [game]);
  const reviewCategoryRows = useMemo(() => {
    const categoryLookup = new Map<string, { categoryId: string; categoryName: string }>();

    for (const review of orderedReviewPlayers) {
      for (const stat of review.categoryStats) {
        if (!categoryLookup.has(stat.categoryId)) {
          categoryLookup.set(stat.categoryId, {
            categoryId: stat.categoryId,
            categoryName: stat.categoryName,
          });
        }
      }
    }

    return [...categoryLookup.values()];
  }, [orderedReviewPlayers]);
  const reviewStatLookup = useMemo(
    () =>
      new Map(
        orderedReviewPlayers.map((review) => [
          review.playerId,
          new Map(review.categoryStats.map((stat) => [stat.categoryId, stat] as const)),
        ]),
      ),
    [orderedReviewPlayers],
  );
  const selectedReviewPlayer = useMemo(
    () =>
      orderedReviewPlayers.find((review) => review.playerId === selectedReviewPlayerId) ??
      orderedReviewPlayers[0] ??
      null,
    [orderedReviewPlayers, selectedReviewPlayerId],
  );

  useEffect(() => {
    if (!currentRound) {
      seenSubmissionIdsRef.current = new Set();
      return;
    }

    const nextSubmissionIds = new Set(currentRound.submissions.map((submission) => submission.id));

    if (seenSubmissionIdsRef.current.size > 0) {
      const hasNewRemoteLock = currentRound.submissions.some(
        (submission) =>
          !seenSubmissionIdsRef.current.has(submission.id) &&
          submission.player_id !== room.snapshot?.me?.id &&
          !submission.timed_out,
      );

      if (hasNewRemoteLock) {
        sounds.playOtherLockSound();
      }
    }

    seenSubmissionIdsRef.current = nextSubmissionIds;
  }, [currentRound, room.snapshot?.me?.id, sounds]);

  useEffect(() => {
    if (!game || game.session.status !== "finished") {
      setShowWrongQuestions(false);
      setSelectedReviewPlayerId(null);
      return;
    }

    const myPlayerId = room.snapshot?.me?.id ?? null;

    setSelectedReviewPlayerId((current) => {
      if (current && orderedReviewPlayers.some((review) => review.playerId === current)) {
        return current;
      }

      if (myPlayerId && orderedReviewPlayers.some((review) => review.playerId === myPlayerId)) {
        return myPlayerId;
      }

      return orderedReviewPlayers[0]?.playerId ?? null;
    });
  }, [game, orderedReviewPlayers, room.snapshot?.me?.id]);

  const handleToggleAnswer = (displayIndex: number) => {
    if (!game || game.session.phase !== "question" || game.session.is_paused || hasSubmitted) {
      return;
    }

    let didUpdateSelection = false;

    setSelectedIndexes((current) => {
      if (current.includes(displayIndex)) {
        didUpdateSelection = true;
        return current.filter((item) => item !== displayIndex);
      }

      if (current.length >= 2) {
        return current;
      }

      didUpdateSelection = true;
      return sortNumberArray([...current, displayIndex]);
    });

    if (didUpdateSelection) {
      sounds.playSelectSound();
    }
  };

  const updateSettingsDraftLocally = (updater: (current: RoomSettings) => RoomSettings) => {
    setIsSettingsDraftDirty(true);
    setSettingsDraft((current) => (current ? updater(current) : current));
  };

  const handleLeave = async () => {
    try {
      await room.leaveRoom();
    } finally {
      router.push("/");
    }
  };

  const handleCopyCode = async () => {
    await copyText(code);
    setStatusMessage("Room code copied.");
  };

  const handleCopyLink = async () => {
    if (!roomLink) {
      return;
    }

    await copyText(roomLink);
    setStatusMessage("Share link copied.");
  };

  const handlePauseToggle = async () => {
    if (!room.snapshot?.me || !game) {
      return;
    }

    try {
      await room.roomAction({
        action: isGamePaused ? "resumeGame" : "pauseGame",
        actorToken: room.snapshot.me.player_token,
      });
      setStatusMessage(isGamePaused ? "Duel resumed." : "Duel paused.");
    } catch (pauseError) {
      setStatusMessage(
        pauseError instanceof Error ? pauseError.message : "Unable to update the duel state.",
      );
    }
  };

  const handleAdvanceRound = async () => {
    if (!room.snapshot?.me || !game) {
      return;
    }

    try {
      await room.gameAction({
        action: "advance",
        playerToken: room.snapshot.me.player_token,
      });
      setStatusMessage(isLastRound ? "Showing final results." : "Next question loaded.");
    } catch (advanceError) {
      setStatusMessage(
        advanceError instanceof Error ? advanceError.message : "Unable to continue the duel.",
      );
    }
  };

  const handleSaveSettings = async () => {
    await persistSettingsDraft(true);
  };

  const updateCategoryBank = async (request: Promise<CategoryBankResponse>) => {
    await request;
    await room.refresh();
  };

  const persistSettingsDraft = async (showSuccessMessage: boolean) => {
    if (!room.snapshot?.me || !settingsDraft) {
      return null;
    }

    const parsed = roomSettingsSchema.safeParse({
      ...settingsDraft,
      selectedCategoryIds: settingsDraft.selectedCategoryIds.filter((categoryId) =>
        room.snapshot?.categories.some((category) => category.id === categoryId),
      ),
    });

    if (!parsed.success) {
      setStatusMessage(parsed.error.issues[0]?.message ?? "Unable to save settings.");
      return null;
    }

    if (!isSettingsDraftDirty) {
      return parsed.data;
    }

    try {
      await room.roomAction({
        action: "updateSettings",
        actorToken: room.snapshot.me.player_token,
        settings: parsed.data,
      });
      setSettingsDraft(parsed.data);
      setIsSettingsDraftDirty(false);

      if (showSuccessMessage) {
        setStatusMessage("Game settings updated.");
      }

      return parsed.data;
    } catch (saveError) {
      setStatusMessage(saveError instanceof Error ? saveError.message : "Unable to save settings.");
      return null;
    }
  };

  useEffect(() => {
    if (
      !activeGameId ||
      !currentRoundId ||
      activePhase !== "question" ||
      !activePhaseEndsAt ||
      isGamePaused ||
      hasSubmitted ||
      selectedIndexes.length === 0 ||
      !myPlayerToken
    ) {
      return;
    }

    // Submit a fraction before expiry so the selection reaches the server
    // before the round advances.
    const msUntilAutoLock = new Date(activePhaseEndsAt).getTime() - Date.now() - 80;

    const timeout = window.setTimeout(() => {
      void gameAction({
        action: "submitAnswer",
        playerToken: myPlayerToken,
        selectedIndexes: [...selectedIndexes],
      })
        .then(() => {
          playLockSound();
          setStatusMessage("Answer auto-locked.");
        })
        .catch(() => {});
    }, Math.max(0, msUntilAutoLock));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeGameId,
    activePhase,
    activePhaseEndsAt,
    currentRoundId,
    gameAction,
    hasSubmitted,
    isGamePaused,
    myPlayerToken,
    playLockSound,
    selectedIndexes,
  ]);

  if (!ready || room.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#13223d_0%,#09111d_55%,#03060b_100%)] text-white">
        <Card>Loading room...</Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#10233d_0%,#09111d_52%,#04070d_100%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-4",
            isLiveGame && "hidden md:flex",
          )}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Room {code}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Quiz room</h1>
            <p className="mt-2 text-sm text-slate-300">
              {room.snapshot?.room.status === "active"
                ? "The duel is live. Answers and rankings sync in realtime."
                : "Configure the duel, manage the question bank, and start when everyone is ready."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {room.snapshot?.me ? <Badge tone="cool">You: {room.snapshot.me.display_name}</Badge> : null}
            <Button variant="secondary" onClick={() => setShowNameDialog(true)}>
              Change name
            </Button>
            <Button variant="ghost" onClick={handleLeave}>
              <DoorOpen className="mr-2 size-4" />
              Leave
            </Button>
          </div>
        </header>

        {room.error ? <Card className="border-rose-400/20 bg-rose-500/10">{room.error}</Card> : null}
        {statusMessage ? (
          <Card className="border-sky-400/20 bg-sky-500/10 text-sky-50">{statusMessage}</Card>
        ) : null}

        {room.snapshot?.me?.status === "kicked" ? (
          <Card className="space-y-4 text-center">
            <XCircle className="mx-auto size-10 text-rose-300" />
            <div>
              <h2 className="text-2xl font-semibold">You were removed from this room</h2>
              <p className="mt-2 text-slate-300">The host kicked this player slot from the lobby or duel.</p>
            </div>
            <Button onClick={() => router.push("/")}>Return home</Button>
          </Card>
        ) : null}

        {room.snapshot?.room.status === "closed" ? (
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <XCircle className="size-8 text-rose-300" />
              <div>
                <h2 className="text-2xl font-semibold">Room closed</h2>
                <p className="text-slate-300">The host left or disconnected, so the room has been ended.</p>
              </div>
            </div>
            <Button onClick={() => router.push("/")}>Back home</Button>
          </Card>
        ) : null}

        {room.snapshot?.me?.status === "active" && room.snapshot?.room.status !== "closed" ? (
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-6">
              <Card
                className={cn(
                  "p-4 md:p-5",
                  isLiveGame && "hidden md:block",
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Room code</p>
                      <p className="mt-1 text-xl font-semibold tracking-[0.24em] md:text-2xl">{code}</p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Players</p>
                      <p className="mt-1 text-xl font-semibold md:text-2xl">{activePlayers.length}</p>
                    </div>
                    <div className="min-w-0 flex-1 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 lg:min-w-[17rem]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Shareable link</p>
                      <p className="mt-1 truncate text-sm text-slate-200">{roomLink}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:ml-auto">
                    <Button size="sm" variant="secondary" onClick={handleCopyCode}>
                      <Copy className="mr-2 size-4" />
                      Copy code
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                      <Share2 className="mr-2 size-4" />
                      Copy link
                    </Button>
                  </div>
                </div>
              </Card>

              {game && isLiveGame ? (
                <Card className="space-y-4 md:space-y-5">
                  <div className="flex items-center justify-between gap-3 md:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="cool">Room {code}</Badge>
                      <Badge tone="muted">{activePlayers.length} players</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleLeave}>
                      Leave
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={isQuestionPhase ? "warm" : "cool"}>
                          {isQuestionPhase ? "Question live" : "Reveal"}
                        </Badge>
                        {isGamePaused ? <Badge tone="danger">Paused</Badge> : null}
                        <Badge tone="muted">
                          Round {game.session.current_round_number} / {game.session.total_rounds}
                        </Badge>
                        {currentCategory ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
                              getCategoryBadgeClass(currentCategory.id),
                            )}
                          >
                            {currentCategory.name}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
                        {currentRound?.question.prompt}
                      </h2>
                    </div>
                    <div className="grid gap-3 md:justify-self-end">
                      <div className="w-full max-w-[9rem] rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-left md:min-w-32 md:text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {isQuestionPhase ? "Timer" : "Continue"}
                        </p>
                        <p className="mt-1 text-3xl font-semibold md:text-4xl">
                          {isGamePaused
                            ? "Paused"
                            : isQuestionPhase
                              ? phaseSecondsRemaining
                              : isLastRound
                                ? "Finish"
                                : "Ready"}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-300/80">
                          {isGamePaused
                            ? "Frozen"
                            : isQuestionPhase
                              ? "Live"
                              : "Any player"}
                        </p>
                      </div>
                      {isHost ? (
                        <Button size="sm" variant={isGamePaused ? "secondary" : "ghost"} onClick={handlePauseToggle}>
                          {isGamePaused ? (
                            <Play className="mr-2 size-4" />
                          ) : (
                            <Pause className="mr-2 size-4" />
                          )}
                          {isGamePaused ? "Resume duel" : "Pause duel"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {isQuestionPhase && currentRound ? (
                    <SmoothQuestionTimerBar
                      paused={isGamePaused}
                      pausedMsRemaining={game.session.paused_ms_remaining}
                      phaseEndsAt={game.session.phase_ends_at}
                      roundId={currentRound.round.id}
                      timerSeconds={game.session.settings.timerSeconds}
                    />
                  ) : null}

                  {isGamePaused ? (
                    <div className="rounded-[24px] border border-rose-300/20 bg-rose-500/10 p-4 text-rose-50">
                      <p className="text-xs uppercase tracking-[0.2em] text-rose-200/75">Paused</p>
                      <p className="mt-2 text-sm">
                        The host paused this {game.session.phase === "question" ? "question" : "reveal"}.
                        {game.session.phase === "question"
                          ? " Your current selection will stay ready until the duel resumes."
                          : " The reveal will continue from the same remaining time after resume."}
                      </p>
                    </div>
                  ) : null}

                  {isQuestionPhase ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Locked in</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-300/80">
                          {lockedPlayers.length} / {game.requiredAnswerCount}
                        </p>
                      </div>
                      <div className="mt-3 min-h-[2.75rem]">
                        {lockedPlayers.length ? (
                          <div className="flex flex-wrap gap-2">
                            {lockedPlayers.map((submission) => (
                              <div
                                key={submission.id}
                                className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-50"
                              >
                                <span className="size-2 rounded-full bg-sky-200" />
                                <span className="truncate">
                                  {formatLockStatusText(
                                    submission.displayName,
                                    submission.player_id === room.snapshot?.me?.id,
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="flex min-h-[2.75rem] items-center text-sm text-slate-400">
                            Waiting for the first player to lock in.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    {currentRound?.answers.map((answer) => {
                      const selected = selectedIndexes.includes(answer.displayIndex);
                      const revealed = game.session.phase !== "question";
                      return (
                        <AnswerChip
                          key={`${currentRound.round.id}-${answer.displayIndex}`}
                          selected={selected}
                          disabled={revealed || hasSubmitted || isGamePaused}
                          correct={revealed ? answer.isCorrect : false}
                          onClick={() => handleToggleAnswer(answer.displayIndex)}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span>{answer.text}</span>
                            {game.session.phase !== "question" && answer.isCorrect ? (
                              <CheckCircle2 className="size-5 text-emerald-200" />
                            ) : null}
                          </div>
                        </AnswerChip>
                      );
                    })}
                  </div>

                  {game.session.phase === "question" ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm text-slate-300">
                        {isGamePaused
                          ? "The host paused the duel. Your current selection is preserved, but answers stay locked until resume."
                          : "Choose 1 or 2 answers. Exact matches count as correct, and selected answers auto-lock at 0."}
                      </div>
                      <Button
                        disabled={isGamePaused || selectedIndexes.length === 0 || hasSubmitted}
                        onClick={async () => {
                          if (!room.snapshot?.me) {
                            return;
                          }

                          try {
                            await room.gameAction({
                              action: "submitAnswer",
                              playerToken: room.snapshot.me.player_token,
                              selectedIndexes,
                            });
                            sounds.playLockSound();
                            setStatusMessage("Answer locked in.");
                          } catch (submitError) {
                            setStatusMessage(
                              submitError instanceof Error
                                ? submitError.message
                                : "Unable to submit the answer.",
                            );
                          }
                        }}
                      >
                        <Play className="mr-2 size-4" />
                        {isGamePaused ? "Paused" : hasSubmitted ? "Waiting..." : "Lock answer"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {currentRound?.question.explanation && game.session.settings.showExplanations ? (
                        <div className="rounded-[24px] border border-sky-300/20 bg-sky-500/10 p-4 text-sky-50">
                          <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Explanation</p>
                          <p className="mt-2">{currentRound.question.explanation}</p>
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-2">
                        {currentRound?.submissions.map((submission) => (
                          <div
                            key={submission.id}
                            className={`rounded-[22px] border p-4 ${
                              submission.is_correct
                                ? "border-emerald-400/30 bg-emerald-500/10"
                                : "border-white/10 bg-white/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{submission.displayName}</span>
                              <Badge tone={submission.is_correct ? "warm" : submission.timed_out ? "danger" : "muted"}>
                                {submission.timed_out ? "Timed out" : submission.is_correct ? "Correct" : "Wrong"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">
                              {submission.timed_out
                                ? "No answer was locked in before time ran out."
                                : submission.is_correct
                                  ? "This answer matched the correct choices."
                                  : "This answer missed the correct choices."}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-sm text-slate-300">
                          {isGamePaused
                            ? "The host paused the reveal. The next question stays locked until the duel resumes."
                            : isLastRound
                              ? "Any player can open the final results."
                              : "Any player can continue to the next question."}
                        </p>
                        <Button disabled={!canAdvanceToNext} onClick={handleAdvanceRound}>
                          <Play className="mr-2 size-4" />
                          {isLastRound ? "Show results" : "Next question"}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ) : null}

              {room.snapshot?.room.status === "lobby" && (!game || game.session.status !== "finished") ? (
                <>
                  <Card className="space-y-5">
                    <div className="flex items-center gap-3">
                      <Settings2 className="size-6 text-amber-200" />
                      <div>
                        <h2 className="text-2xl font-semibold">Lobby</h2>
                        <p className="text-sm text-slate-300">
                          {isHost
                            ? "Tune the duel settings, manage the question bank, and start when ready."
                            : "Waiting for the host to configure the room and start the duel."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-300">Questions</p>
                        <p className="mt-2 text-3xl font-semibold">{plannedQuestionCount}</p>
                        {settingsDraft?.useAllQuestions ? (
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">All selected</p>
                        ) : null}
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-300">Timer</p>
                        <p className="mt-2 text-3xl font-semibold">{settingsDraft?.timerSeconds ?? 10}s</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-300">Question source</p>
                        <p className="mt-2 text-3xl font-semibold">
                          {settingsDraft?.useAllQuestions ? "All" : "Manual"}
                        </p>
                      </div>
                    </div>

                    {isHost && settingsDraft ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block text-sm text-slate-200">
                          <span className="mb-2 flex items-center justify-between gap-3">
                            <span>Number of questions</span>
                            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                              <input
                                checked={settingsDraft.useAllQuestions}
                                type="checkbox"
                                onChange={(event) =>
                                  updateSettingsDraftLocally((current) => ({
                                    ...current,
                                    useAllQuestions: event.target.checked,
                                  }))
                                }
                              />
                              All selected
                            </span>
                          </span>
                          <Input
                            disabled={settingsDraft.useAllQuestions}
                            min={1}
                            max={30}
                            type="number"
                            value={settingsDraft.questionCount}
                            onChange={(event) =>
                              updateSettingsDraftLocally((current) => ({
                                ...current,
                                questionCount: Number(event.target.value || 20),
                              }))
                            }
                          />
                        </label>
                        <label className="block text-sm text-slate-200">
                          <span className="mb-2 block">Timer in seconds</span>
                          <Input
                            min={5}
                            max={30}
                            type="number"
                            value={settingsDraft.timerSeconds}
                            onChange={(event) =>
                              updateSettingsDraftLocally((current) => ({
                                ...current,
                                timerSeconds: Number(event.target.value || 10),
                              }))
                            }
                          />
                        </label>

                        <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-200">
                          <p className="mb-3 font-medium text-white">Options</p>
                          <label className="flex items-center justify-between gap-3 py-2">
                            <span>Randomize question order</span>
                            <input
                              checked={settingsDraft.randomizeQuestionOrder}
                              type="checkbox"
                              onChange={(event) =>
                                updateSettingsDraftLocally((current) => ({
                                  ...current,
                                  randomizeQuestionOrder: event.target.checked,
                                }))
                              }
                            />
                          </label>
                          <label className="flex items-center justify-between gap-3 py-2">
                            <span>Randomize answer order</span>
                            <input
                              checked={settingsDraft.randomizeAnswerOrder}
                              type="checkbox"
                              onChange={(event) =>
                                updateSettingsDraftLocally((current) => ({
                                  ...current,
                                  randomizeAnswerOrder: event.target.checked,
                                }))
                              }
                            />
                          </label>
                          <label className="flex items-center justify-between gap-3 py-2">
                            <span>Show explanations after reveal</span>
                            <input
                              checked={settingsDraft.showExplanations}
                              type="checkbox"
                              onChange={(event) =>
                                updateSettingsDraftLocally((current) => ({
                                  ...current,
                                  showExplanations: event.target.checked,
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {isHost && settingsDraft ? (
                      <>
                        <div>
                          <p className="mb-3 text-sm text-slate-300">Selected categories</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            {room.snapshot?.categories.map((category) => (
                              <label
                                key={category.id}
                                className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm"
                              >
                                <span>{category.name}</span>
                                <input
                                  checked={settingsDraft.selectedCategoryIds.includes(category.id)}
                                  type="checkbox"
                                  onChange={(event) =>
                                    updateSettingsDraftLocally((current) => ({
                                      ...current,
                                      selectedCategoryIds: event.target.checked
                                        ? Array.from(new Set([...current.selectedCategoryIds, category.id]))
                                        : current.selectedCategoryIds.filter((value) => value !== category.id),
                                    }))
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button variant="secondary" onClick={handleSaveSettings}>
                            Save settings
                          </Button>
                          <Button
                            disabled={activePlayers.length < 2}
                            onClick={async () => {
                              if (!room.snapshot?.me) {
                                return;
                              }

                              try {
                                const syncedSettings = await persistSettingsDraft(false);

                                if (settingsDraft && !syncedSettings) {
                                  return;
                                }

                                await room.roomAction({
                                  action: "startGame",
                                  actorToken: room.snapshot.me.player_token,
                                });
                              } catch (startError) {
                                setStatusMessage(
                                  startError instanceof Error
                                    ? startError.message
                                    : "Unable to start the duel.",
                                );
                              }
                            }}
                          >
                            <Play className="mr-2 size-4" />
                            Start duel
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </Card>

                  {isHost ? (
                    <CategoryManager
                      categories={room.snapshot?.categories ?? []}
                      editable
                      onCreateCategory={(input) =>
                        updateCategoryBank(
                          requestJson("/api/categories", { method: "POST", body: input }),
                        )
                      }
                      onUpdateCategory={(id, input) =>
                        updateCategoryBank(
                          requestJson(`/api/categories/${id}`, { method: "PATCH", body: input }),
                        )
                      }
                      onDeleteCategory={(id) =>
                        updateCategoryBank(requestJson(`/api/categories/${id}`, { method: "DELETE" }))
                      }
                      onCreateQuestion={(input: QuestionInput) =>
                        updateCategoryBank(
                          requestJson("/api/questions", { method: "POST", body: input }),
                        )
                      }
                      onUpdateQuestion={(id, input) =>
                        updateCategoryBank(
                          requestJson(`/api/questions/${id}`, { method: "PATCH", body: input }),
                        )
                      }
                      onDeleteQuestion={(id) =>
                        updateCategoryBank(requestJson(`/api/questions/${id}`, { method: "DELETE" }))
                      }
                      onDuplicateQuestion={(id) =>
                        updateCategoryBank(
                          requestJson(`/api/questions/${id}/duplicate`, { method: "POST" }),
                        )
                      }
                    />
                  ) : null}
                </>
              ) : null}

              {game?.session.status === "finished" && room.snapshot?.room.status === "lobby" ? (
                <>
                  <Card className="space-y-5">
                    <div className="flex items-center gap-3">
                      <Trophy className="size-8 text-amber-200" />
                      <div>
                        <h2 className="text-3xl font-semibold">Duel finished</h2>
                        <p className="text-slate-300">The final leaderboard is locked in.</p>
                      </div>
                    </div>
                    {game.leaderboard[0] ? (
                      <div className="rounded-[24px] border border-amber-300/25 bg-amber-400/12 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">Winner</p>
                        <p className="mt-2 text-3xl font-semibold">{game.leaderboard[0].displayName}</p>
                        <p className="mt-2 text-sm text-amber-50">
                          {formatCorrectRatio(
                            game.leaderboard[0].correctCount,
                            game.leaderboard[0].answeredCount,
                          )}{" "}
                          correct
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      {orderedReviewPlayers.length ? (
                        <Button
                          variant="secondary"
                          onClick={() => setShowWrongQuestions((current) => !current)}
                        >
                          {showWrongQuestions ? "Hide wrong questions" : "View wrong questions"}
                        </Button>
                      ) : null}
                      {isHost ? (
                        <Button
                          onClick={async () => {
                            if (!room.snapshot?.me) {
                              return;
                            }

                            try {
                              await room.roomAction({
                                action: "replay",
                                actorToken: room.snapshot.me.player_token,
                              });
                            } catch (replayError) {
                              setStatusMessage(
                                replayError instanceof Error
                                  ? replayError.message
                                  : "Unable to reset the lobby.",
                              );
                            }
                          }}
                        >
                          <RefreshCcw className="mr-2 size-4" />
                          Replay
                        </Button>
                      ) : (
                        <Badge tone="muted">Waiting for the host to replay or start another duel.</Badge>
                      )}
                      <Button variant="ghost" onClick={handleLeave}>
                        Leave room
                      </Button>
                    </div>
                  </Card>

                  {showWrongQuestions && selectedReviewPlayer ? (
                    <Card className="space-y-5">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <h3 className="text-2xl font-semibold">Wrong question review</h3>
                          <p className="text-slate-300">
                            Switch between players to revisit misses, timeouts, and category results.
                          </p>
                        </div>
                        <Badge tone={selectedReviewPlayer.wrongQuestions.length ? "danger" : "cool"}>
                          {selectedReviewPlayer.wrongQuestions.length
                            ? `${selectedReviewPlayer.wrongQuestions.length} to review`
                            : "Perfect game"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {orderedReviewPlayers.map((review) => (
                          <Button
                            key={review.playerId}
                            size="sm"
                            variant={review.playerId === selectedReviewPlayer.playerId ? "secondary" : "ghost"}
                            onClick={() => setSelectedReviewPlayerId(review.playerId)}
                          >
                            {review.displayName}
                          </Button>
                        ))}
                      </div>

                      {reviewCategoryRows.length ? (
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-lg font-semibold">Category stats</h4>
                            <p className="text-sm text-slate-300">
                              Correct answers by category for every player in this duel.
                            </p>
                          </div>
                          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-white/5">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/10 text-left text-slate-300">
                                  <th className="px-4 py-3 font-medium">Category</th>
                                  {orderedReviewPlayers.map((review) => (
                                    <th key={review.playerId} className="px-4 py-3 font-medium">
                                      {review.displayName}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {reviewCategoryRows.map((categoryRow) => (
                                  <tr key={categoryRow.categoryId} className="border-b border-white/5 last:border-b-0">
                                    <td className="px-4 py-3 font-medium text-white">
                                      {categoryRow.categoryName}
                                    </td>
                                    {orderedReviewPlayers.map((review) => {
                                      const stat = reviewStatLookup
                                        .get(review.playerId)
                                        ?.get(categoryRow.categoryId);

                                      return (
                                        <td key={review.playerId} className="px-4 py-3 text-slate-200">
                                          {stat
                                            ? formatCorrectRatio(stat.correctCount, stat.totalCount)
                                            : "0/0"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-lg font-semibold">
                            {selectedReviewPlayer.displayName}&apos;s review
                          </h4>
                          <p className="text-sm text-slate-300">
                            Every question this player missed or timed out on.
                          </p>
                        </div>

                        {selectedReviewPlayer.wrongQuestions.length ? (
                          <div className="space-y-4">
                            {selectedReviewPlayer.wrongQuestions.map((review) => (
                              <div
                                key={review.answerId}
                                className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={review.timedOut ? "danger" : "muted"}>
                                    Round {review.roundNumber}
                                  </Badge>
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
                                      getCategoryBadgeClass(review.categoryId),
                                    )}
                                  >
                                    {review.categoryName}
                                  </span>
                                  <Badge tone={review.timedOut ? "danger" : "muted"}>
                                    {review.timedOut ? "Timed out" : "Answered wrong"}
                                  </Badge>
                                </div>
                                <h5 className="mt-3 text-lg font-semibold">{review.prompt}</h5>
                                <div className="mt-4 grid gap-2">
                                  {review.answers.map((answer) => (
                                    <div
                                      key={`${review.answerId}-${answer.displayIndex}`}
                                      className={cn(
                                        "rounded-[18px] border px-3 py-3 text-sm",
                                        answer.isCorrect
                                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
                                          : answer.isSelected
                                            ? "border-rose-300/25 bg-rose-500/10 text-rose-50"
                                            : "border-white/10 bg-slate-950/45 text-slate-200",
                                      )}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span>{answer.text}</span>
                                        <div className="flex flex-wrap gap-2">
                                          {answer.isSelected ? (
                                            <Badge tone={answer.isCorrect ? "warm" : "danger"}>
                                              {answer.isCorrect ? "Your correct pick" : "Your pick"}
                                            </Badge>
                                          ) : null}
                                          {!answer.isSelected && answer.isCorrect ? (
                                            <Badge tone="cool">Correct answer</Badge>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {review.explanation ? (
                                  <div className="mt-4 rounded-[18px] border border-sky-300/20 bg-sky-500/10 p-3 text-sm text-sky-50">
                                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/75">
                                      Explanation
                                    </p>
                                    <p className="mt-2">{review.explanation}</p>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-50">
                            <p className="font-medium">{selectedReviewPlayer.displayName} got every question right.</p>
                            <p className="mt-1 text-sm text-emerald-100/85">
                              There are no wrong questions to review for this player.
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ) : null}
                </>
              ) : null}
            </div>

            <div
              className={cn(
                "space-y-6",
                isLiveGame && "hidden md:block",
              )}
            >
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-sky-200" />
                  <h2 className="text-xl font-semibold">Players</h2>
                </div>
                <div className="space-y-3">
                  {activePlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{player.display_name}</p>
                          {player.is_host ? <Crown className="size-4 text-amber-200" /> : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge tone={player.connection_status === "online" ? "cool" : "danger"}>
                            {player.connection_status}
                          </Badge>
                          {game ? (
                            <Badge tone="muted">
                              {formatCorrectRatio(player.correctCount, player.answeredCount)} correct
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {isHost && !player.is_host ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!room.snapshot?.me) {
                              return;
                            }

                            try {
                              await room.roomAction({
                                action: "kick",
                                actorToken: room.snapshot.me.player_token,
                                playerId: player.id,
                              });
                            } catch (kickError) {
                              setStatusMessage(
                                kickError instanceof Error ? kickError.message : "Unable to kick player.",
                              );
                            }
                          }}
                        >
                          <UserMinus className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-amber-200" />
                  <h2 className="text-xl font-semibold">Leaderboard</h2>
                </div>
                <div className="space-y-3">
                  {(game?.leaderboard ??
                    activePlayers.map((player) => ({
                      playerId: player.id,
                      displayName: player.display_name,
                      correctCount: 0,
                      answeredCount: 0,
                      isHost: player.is_host,
                      status: player.status,
                      connectionStatus: player.connection_status,
                    }))).map((entry, index) => (
                    <div
                      key={entry.playerId}
                      className={`rounded-[22px] border px-4 py-3 ${
                        index === 0 ? "border-amber-300/25 bg-amber-400/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{entry.displayName}</p>
                            <p className="text-sm text-slate-400">
                              {entry.isHost ? "Host" : "Player"} · {entry.connectionStatus}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">
                          {formatCorrectRatio(entry.correctCount, entry.answeredCount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {game ? (
                <Card className="space-y-3">
                  <div className="flex items-center gap-3">
                    {game.session.phase === "question" ? (
                      <Clock3 className="size-5 text-amber-200" />
                    ) : (
                      <TimerReset className="size-5 text-sky-200" />
                    )}
                    <h2 className="text-xl font-semibold">Round status</h2>
                    {isGamePaused ? <Badge tone="danger">Paused</Badge> : null}
                  </div>
                  {isGamePaused ? (
                    <p className="text-sm text-slate-300">
                      {isQuestionPhase
                        ? `The host paused this question with ${phaseSecondsRemaining}s remaining.`
                        : "The host paused the reveal before the next question could start."}
                    </p>
                  ) : null}
                  <p className="text-sm text-slate-300">
                    {isQuestionPhase
                      ? `${game.submittedAnswerCount} / ${game.requiredAnswerCount} active players have submitted.`
                      : isLastRound
                        ? "The final answers are in. Any player can open the results."
                        : "The answers are revealed. Any player can continue to the next question."}
                  </p>
                </Card>
              ) : null}

              {showQuickLinks ? (
                <Card className="space-y-3">
                  <h2 className="text-xl font-semibold">Quick links</h2>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={handleCopyCode}>
                      Copy code
                    </Button>
                    <Button variant="secondary" onClick={handleCopyLink}>
                      Copy link
                    </Button>
                    <Link
                      href="/categories"
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-medium text-white transition hover:bg-white/12"
                    >
                      Question bank
                    </Link>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}

        <NameDialog
          open={ready && (!hasDisplayName || showNameDialog)}
          title="Choose a display name"
          description="Your name is stored locally and reused whenever you join a room from this browser."
          initialName={profile?.displayName ?? ""}
          submitLabel="Save name"
          onSave={(displayName) => {
            saveProfile(displayName);
            setShowNameDialog(false);
            setStatusMessage("Display name updated.");
          }}
          onClose={hasDisplayName ? () => setShowNameDialog(false) : undefined}
        />
      </div>
    </main>
  );
}
