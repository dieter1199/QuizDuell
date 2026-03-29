"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LibraryBig, Plus, Users } from "lucide-react";
import { useState } from "react";

import { NameDialog } from "@/components/name-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { requestJson } from "@/lib/fetcher";
import { sanitizeRoomCode } from "@/lib/utils";

type CreateRoomResponse = {
  roomCode: string;
};

export function HomePage() {
  const router = useRouter();
  const { profile, ready, hasDisplayName, saveProfile } = useProfile();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);

  const handleHostGame = async () => {
    if (!profile?.displayName) {
      setShowNameDialog(true);
      return;
    }

    try {
      setIsWorking(true);
      setError(null);
      const payload = await requestJson<CreateRoomResponse>("/api/rooms", {
        method: "POST",
        body: {
          displayName: profile.displayName,
          playerToken: profile.playerToken,
        },
      });

      router.push(`/room/${payload.roomCode}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create a room.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleJoinGame = () => {
    const code = sanitizeRoomCode(joinCode);

    if (code.length !== 6) {
      setError("Enter a valid 6-character room code.");
      return;
    }

    if (!profile?.displayName) {
      setShowNameDialog(true);
      return;
    }

    router.push(`/room/${code}`);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1d3557_0%,#0b1120_45%,#050814_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Realtime quiz duel</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">AngelscheinDuell Live</h1>
          </div>

          <div className="flex items-center gap-3">
            {hasDisplayName ? <Badge tone="cool">Playing as {profile?.displayName}</Badge> : null}
            <Button variant="secondary" onClick={() => setShowNameDialog(true)}>
              Change name
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.14),transparent_40%)]" />
            <div className="relative">
              <Badge tone="warm">Fast rooms. Live leaderboard. Shared lobby.</Badge>
              <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight md:text-5xl">
                Der Angelschein macht sich nicht von alleine! Also zeig was du kannst.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
                Erstell einen Raum, share den code, pick Kategorien, und beweise deine Kenntnisse im ultimativen Angelschein-Duell.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Rooms</p>
                  <p className="mt-2 text-3xl font-semibold">Live</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Answers</p>
                  <p className="mt-2 text-3xl font-semibold">Realtime</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">Developed By:</p>
                  <p className="mt-2 text-1xl font-semibold">Dieter Holstein</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-200">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Host a game</h3>
                  <p className="text-sm text-slate-300">Create a room, configure the duel, and start when ready.</p>
                </div>
              </div>
              <Button className="mt-6 w-full" size="lg" disabled={!ready || isWorking} onClick={handleHostGame}>
                Host Game
              </Button>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-400/10 p-3 text-sky-200">
                  <Users className="size-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Join a room</h3>
                  <p className="text-sm text-slate-300">Paste the 6-character room code from the host.</p>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <Input
                  className="text-center text-lg tracking-[0.35em]"
                  maxLength={6}
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(event) => setJoinCode(sanitizeRoomCode(event.target.value))}
                />
                <Button size="lg" onClick={handleJoinGame}>
                  Join
                </Button>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-200">
                  <LibraryBig className="size-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Manage categories</h3>
                  <p className="text-sm text-slate-300">
                    Add your own study prompts before players arrive.
                  </p>
                </div>
              </div>
              <Link
                href="/categories"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-5 text-base font-medium text-white transition hover:bg-white/12"
              >
                Open Question Bank
              </Link>
            </Card>
          </div>
        </section>

        {error ? (
          <Card className="border-rose-400/20 bg-rose-500/10 text-rose-100">
            <p>{error}</p>
          </Card>
        ) : null}
      </div>

      <NameDialog
        open={ready && (!hasDisplayName || showNameDialog)}
        title="Choose a display name"
        description="This name is stored locally and reused when you host or join future quiz rooms."
        initialName={profile?.displayName ?? ""}
        submitLabel="Continue"
        onSave={(displayName) => {
          saveProfile(displayName);
          setShowNameDialog(false);
        }}
        onClose={hasDisplayName ? () => setShowNameDialog(false) : undefined}
      />
    </main>
  );
}
