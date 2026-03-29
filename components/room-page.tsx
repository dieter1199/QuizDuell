"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  DoorOpen,
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
import { cn, copyText, formatCountdown } from "@/lib/utils";
import { roomSettingsSchema } from "@/lib/validation";
import type { CategoryWithQuestions, QuestionInput, RoomSettings } from "@/types/app";

type CategoryBankResponse = {
  categories: CategoryWithQuestions[];
};

type RoomPageProps = {
  code: string;
};

function formatLockedByText(displayNames: string[]) {
  if (displayNames.length === 1) {
    return `${displayNames[0]} locked in`;
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]} + ${displayNames[1]}`;
  }

  return `${displayNames[0]}, ${displayNames[1]} +${displayNames.length - 2}`;
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

export function RoomPage({ code }: RoomPageProps) {
  const router = useRouter();
  const { profile, ready, hasDisplayName, saveProfile } = useProfile();
  const sounds = useQuizSounds();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);
  const [isSettingsDraftDirty, setIsSettingsDraftDirty] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seenSubmissionIdsRef = useRef<Set<string>>(new Set());

  const room = useRoom(code, profile && hasDisplayName ? profile : null);

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
  const isLiveGame = Boolean(
    game && room.snapshot?.room.status === "active" && game.session.status === "active",
  );
  const hasSubmitted = Boolean(
    room.snapshot?.me &&
      currentRound?.submissions.some((submission) => submission.player_id === room.snapshot?.me?.id),
  );
  const answerLocks = useMemo(() => {
    const locks = new Map<number, string[]>();

    if (!currentRound || game?.session.phase !== "question") {
      return locks;
    }

    for (const submission of currentRound.submissions) {
      if (submission.timed_out) {
        continue;
      }

      for (const selectedIndex of submission.selected_indexes) {
        const currentLocks = locks.get(selectedIndex) ?? [];
        currentLocks.push(submission.displayName);
        locks.set(selectedIndex, currentLocks);
      }
    }

    return locks;
  }, [currentRound, game?.session.phase]);
  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";
  const phaseMsRemaining = game ? Math.max(0, new Date(game.session.phase_ends_at).getTime() - now) : 0;
  const phaseSecondsRemaining = formatCountdown(phaseMsRemaining);
  const phaseProgress = game
    ? Math.max(
        0,
        Math.min(
          100,
          (phaseMsRemaining /
            (game.session.phase === "reveal" ? 3000 : game.session.settings.timerSeconds * 1000)) *
            100,
        ),
      )
    : 0;
  const showQuickLinks = !game || game.session.status !== "active";

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

  const handleToggleAnswer = (displayIndex: number) => {
    if (!game || game.session.phase !== "question" || hasSubmitted) {
      return;
    }

    if (selectedIndexes.includes(displayIndex)) {
      setSelectedIndexes(selectedIndexes.filter((item) => item !== displayIndex));
      sounds.playSelectSound();
      return;
    }

    if (selectedIndexes.length >= 2) {
      return;
    }

    setSelectedIndexes([...selectedIndexes, displayIndex]);
    sounds.playSelectSound();
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

  const handleSaveSettings = async () => {
    if (!room.snapshot?.me || !settingsDraft) {
      return;
    }

    const parsed = roomSettingsSchema.safeParse({
      ...settingsDraft,
      selectedCategoryIds: settingsDraft.selectedCategoryIds.filter((categoryId) =>
        room.snapshot?.categories.some((category) => category.id === categoryId),
      ),
    });

    if (!parsed.success) {
      setStatusMessage(parsed.error.issues[0]?.message ?? "Unable to save settings.");
      return;
    }

    try {
      await room.roomAction({
        action: "updateSettings",
        actorToken: room.snapshot.me.player_token,
        settings: parsed.data,
      });
      setSettingsDraft(parsed.data);
      setIsSettingsDraftDirty(false);
      setStatusMessage("Game settings updated.");
    } catch (saveError) {
      setStatusMessage(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    }
  };

  const updateCategoryBank = async (request: Promise<CategoryBankResponse>) => {
    await request;
    await room.refresh();
  };

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
                ? "The duel is live. Answers and scores sync in realtime."
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
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={game.session.phase === "question" ? "warm" : "cool"}>
                          {game.session.phase === "question" ? "Question live" : "Reveal"}
                        </Badge>
                        <Badge tone="muted">
                          Round {game.session.current_round_number} / {game.session.total_rounds}
                        </Badge>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
                        {currentRound?.question.prompt}
                      </h2>
                    </div>
                    <div className="min-w-24 text-right md:min-w-40">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Timer</p>
                      <p className="mt-2 text-3xl font-semibold md:text-4xl">{phaseSecondsRemaining}</p>
                    </div>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c,#facc15)] transition-all"
                      style={{ width: `${phaseProgress}%` }}
                    />
                  </div>

                  <div className="grid gap-3">
                    {currentRound?.answers.map((answer) => {
                      const selected = selectedIndexes.includes(answer.displayIndex);
                      const revealed = game.session.phase !== "question";
                      const lockedBy = answerLocks.get(answer.displayIndex) ?? [];
                      return (
                        <AnswerChip
                          key={`${currentRound.round.id}-${answer.displayIndex}`}
                          selected={selected}
                          disabled={revealed || hasSubmitted}
                          correct={revealed ? answer.isCorrect : false}
                          onClick={() => handleToggleAnswer(answer.displayIndex)}
                        >
                          <div className="space-y-3">
                            {lockedBy.length ? (
                              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/12 px-3 py-1 text-xs font-medium text-amber-50">
                                <span className="size-2 rounded-full bg-amber-200" />
                                <span className="truncate">{formatLockedByText(lockedBy)}</span>
                              </div>
                            ) : null}
                            <div className="flex items-center justify-between gap-4">
                              <span>{answer.text}</span>
                              {game.session.phase !== "question" && answer.isCorrect ? (
                                <CheckCircle2 className="size-5 text-emerald-200" />
                              ) : null}
                            </div>
                          </div>
                        </AnswerChip>
                      );
                    })}
                  </div>

                  {game.session.phase === "question" ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm text-slate-300">
                        Choose 1 or 2 answers. Full matches only score points.
                      </div>
                      <Button
                        disabled={selectedIndexes.length === 0 || hasSubmitted}
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
                        {hasSubmitted ? "Waiting..." : "Lock answer"}
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
                              <Badge tone={submission.is_correct ? "warm" : "muted"}>
                                {submission.is_correct ? `+${submission.points_awarded}` : "0"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">
                              {submission.timed_out ? "Timed out" : submission.is_correct ? "Full match" : "Missed"}
                            </p>
                          </div>
                        ))}
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
                        <p className="mt-2 text-3xl font-semibold">{settingsDraft?.questionCount ?? 20}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-300">Timer</p>
                        <p className="mt-2 text-3xl font-semibold">{settingsDraft?.timerSeconds ?? 10}s</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-300">Points</p>
                        <p className="mt-2 text-3xl font-semibold">{settingsDraft?.pointsPerQuestion ?? 10}</p>
                      </div>
                    </div>

                    {isHost && settingsDraft ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block text-sm text-slate-200">
                          <span className="mb-2 block">Number of questions</span>
                          <Input
                            min={5}
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
                        <label className="block text-sm text-slate-200">
                          <span className="mb-2 block">Points per question</span>
                          <Input
                            min={5}
                            max={50}
                            type="number"
                            value={settingsDraft.pointsPerQuestion}
                            onChange={(event) =>
                              updateSettingsDraftLocally((current) => ({
                                ...current,
                                pointsPerQuestion: Number(event.target.value || 10),
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
                      <p className="mt-2 text-sm text-amber-50">{game.leaderboard[0].score} points</p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
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
                          {game ? <Badge tone="muted">{player.score} pts</Badge> : null}
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
                      score: 0,
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
                        <p className="text-lg font-semibold">{entry.score}</p>
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
                  </div>
                  <p className="text-sm text-slate-300">
                    {game.submittedAnswerCount} / {game.requiredAnswerCount} active players have submitted.
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
