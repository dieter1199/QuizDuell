import { PostgrestError } from "@supabase/supabase-js";

import { PLAYER_STALE_AFTER_MS } from "@/lib/constants";
import {
  buildRoundAnswers,
  createAnswerOrder,
  getCorrectDisplayIndexes,
  nextRevealIso,
  normalizeRoomSettings,
  scoreSelection,
  shuffleArray,
} from "@/lib/game";
import { getCategoryBank } from "@/lib/server/content-service";
import { ApiError } from "@/lib/server/api";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateRoomCode, sanitizeName } from "@/lib/utils";
import type {
  GameSessionRecord,
  LeaderboardEntry,
  PlayerAnswerSnapshot,
  RoomPlayerSnapshot,
  RoomRecord,
  RoomSettings,
  RoomSnapshot,
} from "@/types/app";
import type { Database } from "@/types/database";

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type RoomInsert = Database["public"]["Tables"]["rooms"]["Insert"];
type RoomPlayerRow = Database["public"]["Tables"]["room_players"]["Row"];
type RoomPlayerInsert = Database["public"]["Tables"]["room_players"]["Insert"];
type GameSessionRow = Database["public"]["Tables"]["game_sessions"]["Row"];
type GameSessionInsert = Database["public"]["Tables"]["game_sessions"]["Insert"];
type GameRoundInsert = Database["public"]["Tables"]["game_rounds"]["Insert"];
type PlayerAnswerRow = Database["public"]["Tables"]["player_answers"]["Row"];
type PlayerAnswerInsert = Database["public"]["Tables"]["player_answers"]["Insert"];

function assertRoomError(error: PostgrestError | null, fallbackMessage: string) {
  if (!error) {
    return;
  }

  if (error.code === "23505") {
    throw new ApiError(409, error.message);
  }

  throw new ApiError(500, fallbackMessage);
}

function toRoomRecord(row: RoomRow, categoryIds: string[]): RoomRecord {
  return {
    ...row,
    settings: normalizeRoomSettings(row.settings, categoryIds),
  };
}

function toGameSessionRecord(row: GameSessionRow, categoryIds: string[]): GameSessionRecord {
  return {
    ...row,
    settings: normalizeRoomSettings(row.settings, categoryIds),
  };
}

async function getRoomByCode(roomCode: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin.from("rooms").select("*").eq("code", roomCode).maybeSingle();

  assertRoomError(response.error, "Unable to load room.");

  return response.data as RoomRow | null;
}

async function getRoomById(roomId: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin.from("rooms").select("*").eq("id", roomId).maybeSingle();

  assertRoomError(response.error, "Unable to load room.");

  return response.data as RoomRow | null;
}

async function getPlayersForRoom(roomId: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("is_host", { ascending: false })
    .order("joined_at", { ascending: true });

  assertRoomError(response.error, "Unable to load players.");

  return (response.data ?? []) as RoomPlayerRow[];
}

async function getPlayerByToken(roomId: string, playerToken: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("player_token", playerToken)
    .maybeSingle();

  assertRoomError(response.error, "Unable to load player.");

  return response.data as RoomPlayerRow | null;
}

async function getGameById(gameId: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin.from("game_sessions").select("*").eq("id", gameId).maybeSingle();

  assertRoomError(response.error, "Unable to load game.");

  return response.data as GameSessionRow | null;
}

async function getRoundsForGame(gameId: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin
    .from("game_rounds")
    .select("*")
    .eq("game_session_id", gameId)
    .order("round_number", { ascending: true });

  assertRoomError(response.error, "Unable to load game rounds.");

  return (response.data ?? []) as Database["public"]["Tables"]["game_rounds"]["Row"][];
}

async function getAnswersForRounds(roundIds: string[]) {
  if (!roundIds.length) {
    return [] as PlayerAnswerRow[];
  }

  const admin = getSupabaseAdminClient();
  const response = await admin
    .from("player_answers")
    .select("*")
    .in("round_id", roundIds)
    .order("submitted_at", { ascending: true });

  assertRoomError(response.error, "Unable to load answers.");

  return (response.data ?? []) as PlayerAnswerRow[];
}

async function closeRoom(roomId: string, reason: string) {
  const admin = getSupabaseAdminClient();
  const room = await getRoomById(roomId);

  if (!room || room.status === "closed") {
    return;
  }

  const [roomUpdate, gameUpdate] = await Promise.all([
    admin
      .from("rooms")
      .update({
        status: "closed",
        closed_reason: reason,
      } as never)
      .eq("id", roomId),
    room.current_game_id
      ? admin
          .from("game_sessions")
          .update({
            status: "cancelled",
            phase: "finished",
            ended_at: new Date().toISOString(),
          } as never)
          .eq("id", room.current_game_id)
      : Promise.resolve({ error: null }),
  ]);

  assertRoomError(roomUpdate.error, "Unable to close the room.");
  assertRoomError(gameUpdate.error, "Unable to close the room.");
}

async function makeUniqueDisplayName(roomId: string, displayName: string, excludedPlayerId?: string) {
  const admin = getSupabaseAdminClient();
  const response = await admin
    .from("room_players")
    .select("id, display_name")
    .eq("room_id", roomId)
    .eq("status", "active");

  assertRoomError(response.error, "Unable to validate player name.");
  const existingPlayers = (response.data ?? []) as Pick<RoomPlayerRow, "id" | "display_name">[];

  const existingNames = new Set(
    existingPlayers
      .filter((player) => player.id !== excludedPlayerId)
      .map((player) => player.display_name.toLowerCase()),
  );

  const base = sanitizeName(displayName);

  if (!existingNames.has(base.toLowerCase())) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base} ${suffix}`;

  while (existingNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base} ${suffix}`;
  }

  return candidate;
}

async function reconcileRoomPresence(roomId: string) {
  const admin = getSupabaseAdminClient();
  const players = await getPlayersForRoom(roomId);
  const staleBefore = Date.now() - PLAYER_STALE_AFTER_MS;
  const staleIds = players
    .filter(
      (player) =>
        player.status === "active" &&
        player.connection_status === "online" &&
        new Date(player.last_seen_at).getTime() < staleBefore,
    )
    .map((player) => player.id);

  if (staleIds.length) {
    const response = await admin
      .from("room_players")
      .update({ connection_status: "offline" } as never)
      .in("id", staleIds);

    assertRoomError(response.error, "Unable to update player presence.");
  }

  const refreshedPlayers = staleIds.length ? await getPlayersForRoom(roomId) : players;
  const host = refreshedPlayers.find((player) => player.is_host);

  if (!host || host.status !== "active" || host.connection_status === "offline") {
    await closeRoom(roomId, "host_left");
  }
}

async function maybeAdvanceGame(gameId: string) {
  const admin = getSupabaseAdminClient();
  const sessionRow = await getGameById(gameId);

  if (!sessionRow || sessionRow.status !== "active" || sessionRow.phase === "finished") {
    return sessionRow;
  }

  const [room, categories, rounds] = await Promise.all([
    getRoomById(sessionRow.room_id),
    getCategoryBank(),
    getRoundsForGame(gameId),
  ]);

  if (!room || room.status === "closed") {
    await closeRoom(sessionRow.room_id, "host_left");
    return sessionRow;
  }

  const categoryIds = categories.map((category) => category.id);
  const session = toGameSessionRecord(sessionRow, categoryIds);
  const currentRound = rounds.find((round) => round.round_number === session.current_round_number);

  if (!currentRound) {
    return sessionRow;
  }

  const question = categories
    .flatMap((category) => category.questions)
    .find((candidate) => candidate.id === currentRound.question_id);

  if (!question) {
    throw new ApiError(500, "The current question could not be found.");
  }

  const [players, answers] = await Promise.all([
    getPlayersForRoom(session.room_id),
    getAnswersForRounds([currentRound.id]),
  ]);

  const activePlayers = players.filter((player) => player.status === "active");
  const phaseEndsAt = new Date(session.phase_ends_at);
  const now = new Date();

  if (session.phase === "question") {
    if (now < phaseEndsAt && answers.length < activePlayers.length) {
      return sessionRow;
    }

    const answeredPlayerIds = new Set(answers.map((answer) => answer.player_id));
    const missingAnswers: PlayerAnswerInsert[] = activePlayers
      .filter((player) => !answeredPlayerIds.has(player.id))
      .map((player) => ({
        round_id: currentRound.id,
        player_id: player.id,
        selected_indexes: [],
        is_correct: false,
        timed_out: true,
        points_awarded: 0,
      }));

    if (missingAnswers.length) {
      const finalize = await admin
        .from("player_answers")
        .upsert(missingAnswers as never, { onConflict: "round_id,player_id" });

      assertRoomError(finalize.error, "Unable to finalize unanswered turns.");
    }

    const update = await admin
      .from("game_sessions")
      .update({
        phase: "reveal",
        phase_started_at: now.toISOString(),
        phase_ends_at: nextRevealIso(now.toISOString()),
      } as never)
      .eq("id", gameId)
      .eq("phase", "question")
      .select("*")
      .maybeSingle();

    assertRoomError(update.error, "Unable to reveal the round result.");

    return update.data ?? sessionRow;
  }

  if (now < phaseEndsAt) {
    return sessionRow;
  }

  if (session.current_round_number >= session.total_rounds) {
    const [finishGame, finishRoom] = await Promise.all([
      admin
        .from("game_sessions")
        .update({
          status: "finished",
          phase: "finished",
          ended_at: now.toISOString(),
        } as never)
        .eq("id", gameId)
        .eq("status", "active")
        .select("*")
        .maybeSingle(),
      admin
        .from("rooms")
        .update({
          status: "lobby",
        } as never)
        .eq("id", session.room_id),
    ]);

    assertRoomError(finishGame.error, "Unable to finish the duel.");
    assertRoomError(finishRoom.error, "Unable to finish the duel.");

    return finishGame.data ?? sessionRow;
  }

  const update = await admin
    .from("game_sessions")
    .update({
      current_round_number: session.current_round_number + 1,
      phase: "question",
      phase_started_at: now.toISOString(),
      phase_ends_at: new Date(now.getTime() + session.settings.timerSeconds * 1000).toISOString(),
    } as never)
    .eq("id", gameId)
    .eq("phase", "reveal")
    .select("*")
    .maybeSingle();

  assertRoomError(update.error, "Unable to start the next question.");

  return update.data ?? sessionRow;
}

async function assertHost(roomCode: string, actorToken: string) {
  const room = await getRoomByCode(roomCode);

  if (!room) {
    throw new ApiError(404, "This room no longer exists.");
  }

  const player = await getPlayerByToken(room.id, actorToken);

  if (!player || !player.is_host || player.status !== "active") {
    throw new ApiError(403, "Only the host can do that.");
  }

  return { room, player };
}

function buildPlayersWithScores(
  players: RoomPlayerRow[],
  answers: PlayerAnswerRow[],
  currentRoundId?: string,
) {
  const scoreMap = new Map<string, number>();

  for (const answer of answers) {
    scoreMap.set(answer.player_id, (scoreMap.get(answer.player_id) ?? 0) + answer.points_awarded);
  }

  const currentRoundAnswerIds = new Set(
    answers.filter((answer) => answer.round_id === currentRoundId).map((answer) => answer.player_id),
  );

  return players.map<RoomPlayerSnapshot>((player) => ({
    ...player,
    score: scoreMap.get(player.id) ?? 0,
    answeredCurrentRound: currentRoundAnswerIds.has(player.id),
  }));
}

function buildLeaderboard(players: RoomPlayerSnapshot[]): LeaderboardEntry[] {
  return players
    .filter((player) => player.status === "active" || player.score > 0)
    .map((player) => ({
      playerId: player.id,
      displayName: player.display_name,
      score: player.score,
      isHost: player.is_host,
      status: player.status,
      connectionStatus: player.connection_status,
    }))
    .sort((left, right) => right.score - left.score || Number(right.isHost) - Number(left.isHost));
}

export async function getRoomSnapshot(roomCode: string, playerToken?: string) {
  const firstRoom = await getRoomByCode(roomCode);

  if (!firstRoom) {
    throw new ApiError(404, "This room does not exist anymore.");
  }

  await reconcileRoomPresence(firstRoom.id);

  let roomRow = await getRoomByCode(roomCode);

  if (!roomRow) {
    throw new ApiError(404, "This room does not exist anymore.");
  }

  if (roomRow.current_game_id) {
    await maybeAdvanceGame(roomRow.current_game_id);
    roomRow = await getRoomByCode(roomCode);
  }

  if (!roomRow) {
    throw new ApiError(404, "This room does not exist anymore.");
  }

  const categories = await getCategoryBank();
  const categoryIds = categories.map((category) => category.id);
  const room = toRoomRecord(roomRow, categoryIds);
  const players = await getPlayersForRoom(room.id);

  if (!room.current_game_id) {
    const enrichedPlayers = players.map<RoomPlayerSnapshot>((player) => ({
      ...player,
      score: 0,
      answeredCurrentRound: false,
    }));

    return {
      room,
      me: playerToken
        ? enrichedPlayers.find((player) => player.player_token === playerToken) ?? null
        : null,
      players: enrichedPlayers,
      categories,
      game: null,
    } satisfies RoomSnapshot;
  }

  const gameRow = await getGameById(room.current_game_id);

  if (!gameRow) {
    return {
      room,
      me: null,
      players: players.map((player) => ({
        ...player,
        score: 0,
        answeredCurrentRound: false,
      })),
      categories,
      game: null,
    } satisfies RoomSnapshot;
  }

  const game = toGameSessionRecord(gameRow, categoryIds);
  const rounds = await getRoundsForGame(game.id);
  const answers = await getAnswersForRounds(rounds.map((round) => round.id));
  const currentRound =
    rounds.find((round) => round.round_number === game.current_round_number) ?? rounds.at(-1) ?? null;
  const currentQuestion = currentRound
    ? categories
        .flatMap((category) => category.questions)
        .find((question) => question.id === currentRound.question_id) ?? null
    : null;
  const playersWithScores = buildPlayersWithScores(players, answers, currentRound?.id);
  const playerLookup = new Map(playersWithScores.map((player) => [player.id, player]));
  const currentRoundAnswers = currentRound
    ? answers.filter((answer) => answer.round_id === currentRound.id)
    : [];

  return {
    room,
    me: playerToken
      ? playersWithScores.find((player) => player.player_token === playerToken) ?? null
      : null,
    players: playersWithScores,
    categories,
    game: {
      session: game,
      currentRound:
        currentRound && currentQuestion
          ? {
              round: currentRound,
              question: currentQuestion,
              answers: buildRoundAnswers(currentQuestion, currentRound.answer_order),
              correctDisplayIndexes: getCorrectDisplayIndexes(currentQuestion, currentRound.answer_order),
              submissions: currentRoundAnswers.map<PlayerAnswerSnapshot>((answer) => ({
                ...answer,
                displayName: playerLookup.get(answer.player_id)?.display_name ?? "Unknown player",
              })),
            }
          : null,
      leaderboard: buildLeaderboard(playersWithScores),
      submittedAnswerCount: currentRoundAnswers.length,
      requiredAnswerCount: playersWithScores.filter((player) => player.status === "active").length,
    },
  } satisfies RoomSnapshot;
}

export async function createRoom(displayName: string, playerToken: string) {
  const admin = getSupabaseAdminClient();
  const categories = await getCategoryBank();
  const categoryIds = categories.map((category) => category.id);

  let roomRow: RoomRow | null = null;

  for (let attempt = 0; attempt < 6 && !roomRow; attempt += 1) {
    const insert: RoomInsert = {
      code: generateRoomCode(),
      status: "lobby",
      settings: {
        questionCount: 20,
        timerSeconds: 10,
        pointsPerQuestion: 10,
        selectedCategoryIds: categoryIds,
        randomizeQuestionOrder: true,
        randomizeAnswerOrder: true,
        showExplanations: true,
      },
    };

    const response = await admin.from("rooms").insert(insert as never).select("*").maybeSingle();

    if (response.error?.code === "23505") {
      continue;
    }

    assertRoomError(response.error, "Unable to create the room.");
    roomRow = response.data as RoomRow | null;
  }

  if (!roomRow) {
    throw new ApiError(500, "We could not generate a unique room code.");
  }

  const playerInsert: RoomPlayerInsert = {
    room_id: roomRow.id,
    player_token: playerToken,
    display_name: sanitizeName(displayName),
    is_host: true,
    status: "active",
    connection_status: "online",
  };

  const playerResponse = await admin
    .from("room_players")
    .insert(playerInsert as never)
    .select("*")
    .single();

  assertRoomError(playerResponse.error, "Unable to create the host player.");
  const hostPlayer = playerResponse.data as unknown as RoomPlayerRow | null;

  if (!hostPlayer) {
    throw new ApiError(500, "Unable to create the host player.");
  }

  const roomUpdate = await admin
    .from("rooms")
    .update({
      host_player_id: hostPlayer.id,
    } as never)
    .eq("id", roomRow.id);

  assertRoomError(roomUpdate.error, "Unable to finish creating the room.");

  return {
    roomCode: roomRow.code,
  };
}

export async function joinRoom(roomCode: string, displayName: string, playerToken: string) {
  const admin = getSupabaseAdminClient();
  const room = await getRoomByCode(roomCode);

  if (!room || room.status === "closed") {
    throw new ApiError(404, "That room is no longer available.");
  }

  const existingPlayer = await getPlayerByToken(room.id, playerToken);

  if (!existingPlayer && room.status === "active") {
    throw new ApiError(409, "A duel is already running. Join again when the room returns to the lobby.");
  }

  if (existingPlayer?.status === "kicked") {
    throw new ApiError(403, "You were removed from this room.");
  }

  if (existingPlayer?.status === "left" && room.status === "active") {
    throw new ApiError(409, "You already left this duel. Wait for the next lobby.");
  }

  const uniqueDisplayName = await makeUniqueDisplayName(room.id, displayName, existingPlayer?.id);

  if (existingPlayer) {
    const update = await admin
      .from("room_players")
      .update({
        display_name: uniqueDisplayName,
        status: "active",
        connection_status: "online",
        last_seen_at: new Date().toISOString(),
        left_at: null,
      } as never)
      .eq("id", existingPlayer.id);

    assertRoomError(update.error, "Unable to rejoin the room.");
  } else {
    const insert = await admin.from("room_players").insert({
      room_id: room.id,
      player_token: playerToken,
      display_name: uniqueDisplayName,
      is_host: false,
      status: "active",
      connection_status: "online",
    } as never);

    assertRoomError(insert.error, "Unable to join the room.");
  }

  return getRoomSnapshot(roomCode, playerToken);
}

export async function updateHeartbeat(roomCode: string, playerToken: string) {
  const admin = getSupabaseAdminClient();
  const room = await getRoomByCode(roomCode);

  if (!room || room.status === "closed") {
    throw new ApiError(404, "This room has already closed.");
  }

  const player = await getPlayerByToken(room.id, playerToken);

  if (!player || player.status !== "active") {
    throw new ApiError(404, "Player not found in this room.");
  }

  const update = await admin
    .from("room_players")
    .update({
      last_seen_at: new Date().toISOString(),
      connection_status: "online",
    } as never)
    .eq("id", player.id);

  assertRoomError(update.error, "Unable to refresh your connection.");

  return getRoomSnapshot(roomCode, playerToken);
}

export async function leaveRoom(roomCode: string, playerToken: string) {
  const admin = getSupabaseAdminClient();
  const room = await getRoomByCode(roomCode);

  if (!room) {
    return;
  }

  const player = await getPlayerByToken(room.id, playerToken);

  if (!player || player.status !== "active") {
    return;
  }

  if (player.is_host) {
    await closeRoom(room.id, "host_left");
  }

  const update = await admin
    .from("room_players")
    .update({
      status: "left",
      connection_status: "offline",
      left_at: new Date().toISOString(),
    } as never)
    .eq("id", player.id);

  assertRoomError(update.error, "Unable to leave the room.");

  if (room.current_game_id && !player.is_host) {
    await maybeAdvanceGame(room.current_game_id);
  }
}

export async function kickPlayer(roomCode: string, actorToken: string, playerId: string) {
  const admin = getSupabaseAdminClient();
  const { room } = await assertHost(roomCode, actorToken);
  const response = await admin
    .from("room_players")
    .select("*")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();

  assertRoomError(response.error, "Unable to load that player.");
  const targetPlayer = response.data as RoomPlayerRow | null;

  if (!targetPlayer) {
    throw new ApiError(404, "Player not found.");
  }

  if (targetPlayer.is_host) {
    throw new ApiError(400, "The host cannot be kicked.");
  }

  const update = await admin
    .from("room_players")
    .update({
      status: "kicked",
      connection_status: "offline",
      left_at: new Date().toISOString(),
    } as never)
    .eq("id", playerId);

  assertRoomError(update.error, "Unable to kick the player.");

  if (room.current_game_id) {
    await maybeAdvanceGame(room.current_game_id);
  }

  return getRoomSnapshot(roomCode, actorToken);
}

export async function updateRoomSettings(roomCode: string, actorToken: string, settings: RoomSettings) {
  const admin = getSupabaseAdminClient();
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status !== "lobby") {
    throw new ApiError(409, "Settings can only be changed from the lobby.");
  }

  const update = await admin
    .from("rooms")
    .update({
      settings,
    } as never)
    .eq("id", room.id);

  assertRoomError(update.error, "Unable to save room settings.");

  return getRoomSnapshot(roomCode, actorToken);
}

export async function startGame(roomCode: string, actorToken: string) {
  const admin = getSupabaseAdminClient();
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status !== "lobby") {
    throw new ApiError(409, "Finish the current duel before starting another one.");
  }

  const categories = await getCategoryBank();
  const categoryIds = categories.map((category) => category.id);
  const settings = normalizeRoomSettings(room.settings, categoryIds);
  const selectedQuestions = categories
    .filter((category) => settings.selectedCategoryIds.includes(category.id))
    .flatMap((category) => category.questions);

  if (!settings.selectedCategoryIds.length) {
    throw new ApiError(400, "Select at least one category.");
  }

  if (selectedQuestions.length < settings.questionCount) {
    throw new ApiError(
      400,
      `Only ${selectedQuestions.length} questions are available for the selected categories.`,
    );
  }

  const players = await getPlayersForRoom(room.id);
  const activePlayers = players.filter((player) => player.status === "active");

  if (activePlayers.length < 2) {
    throw new ApiError(400, "At least 2 active players are required.");
  }

  const orderedQuestions = settings.randomizeQuestionOrder
    ? shuffleArray(selectedQuestions)
    : [...selectedQuestions].sort((left, right) => left.created_at.localeCompare(right.created_at));
  const gameQuestions = orderedQuestions.slice(0, settings.questionCount);
  const now = new Date();

  const gameInsert: GameSessionInsert = {
    room_id: room.id,
    status: "active",
    phase: "question",
    current_round_number: 1,
    total_rounds: gameQuestions.length,
    settings,
    phase_started_at: now.toISOString(),
    phase_ends_at: new Date(now.getTime() + settings.timerSeconds * 1000).toISOString(),
  };

  const gameResponse = await admin
    .from("game_sessions")
    .insert(gameInsert as never)
    .select("*")
    .single();

  assertRoomError(gameResponse.error, "Unable to create the duel.");
  const gameSession = gameResponse.data as unknown as GameSessionRow | null;

  if (!gameSession) {
    throw new ApiError(500, "Unable to create the duel.");
  }

  const rounds: GameRoundInsert[] = gameQuestions.map((question, index) => ({
    game_session_id: gameSession.id,
    question_id: question.id,
    round_number: index + 1,
    answer_order: createAnswerOrder(settings.randomizeAnswerOrder),
  }));

  const [roundInsert, roomUpdate] = await Promise.all([
    admin.from("game_rounds").insert(rounds as never),
    admin
      .from("rooms")
      .update({
        status: "active",
        current_game_id: gameSession.id,
        closed_reason: null,
      } as never)
      .eq("id", room.id),
  ]);

  assertRoomError(roundInsert.error, "Unable to prepare the duel.");
  assertRoomError(roomUpdate.error, "Unable to start the duel.");

  return getRoomSnapshot(roomCode, actorToken);
}

export async function submitAnswer(
  gameId: string,
  playerToken: string,
  selectedIndexes: number[],
) {
  const admin = getSupabaseAdminClient();

  await maybeAdvanceGame(gameId);

  const sessionRow = await getGameById(gameId);

  if (!sessionRow || sessionRow.status !== "active" || sessionRow.phase !== "question") {
    throw new ApiError(409, "This question is already locked.");
  }

  const [categories, room, rounds] = await Promise.all([
    getCategoryBank(),
    getRoomById(sessionRow.room_id),
    getRoundsForGame(gameId),
  ]);

  if (!room) {
    throw new ApiError(404, "This room no longer exists.");
  }

  const currentRound = rounds.find((round) => round.round_number === sessionRow.current_round_number);

  if (!currentRound) {
    throw new ApiError(500, "The current round could not be found.");
  }

  const player = await getPlayerByToken(room.id, playerToken);

  if (!player || player.status !== "active") {
    throw new ApiError(403, "You are no longer an active player in this room.");
  }

  const existingAnswers = await getAnswersForRounds([currentRound.id]);

  if (existingAnswers.some((answer) => answer.player_id === player.id)) {
    throw new ApiError(409, "Your answer is already locked in.");
  }

  const question = categories
    .flatMap((category) => category.questions)
    .find((candidate) => candidate.id === currentRound.question_id);

  if (!question) {
    throw new ApiError(500, "The current question could not be found.");
  }

  const session = toGameSessionRecord(sessionRow, categories.map((category) => category.id));
  const scoring = scoreSelection(
    selectedIndexes,
    question,
    currentRound.answer_order,
    session.settings.pointsPerQuestion,
  );

  const insert: PlayerAnswerInsert = {
    round_id: currentRound.id,
    player_id: player.id,
    selected_indexes: scoring.normalizedSelection,
    is_correct: scoring.isCorrect,
    timed_out: false,
    points_awarded: scoring.pointsAwarded,
  };

  const response = await admin.from("player_answers").insert(insert as never);
  assertRoomError(response.error, "Unable to submit the answer.");

  await maybeAdvanceGame(gameId);

  return getRoomSnapshot(room.code, playerToken);
}

export async function advanceGame(gameId: string, playerToken?: string) {
  const session = await maybeAdvanceGame(gameId);

  if (!session) {
    throw new ApiError(404, "This duel does not exist.");
  }

  const room = await getRoomById(session.room_id);

  if (!room) {
    throw new ApiError(404, "This room no longer exists.");
  }

  return getRoomSnapshot(room.code, playerToken);
}

export async function replayRoom(roomCode: string, actorToken: string) {
  const admin = getSupabaseAdminClient();
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status === "closed") {
    throw new ApiError(409, "This room has already closed.");
  }

  const update = await admin
    .from("rooms")
    .update({
      status: "lobby",
      current_game_id: null,
      closed_reason: null,
    } as never)
    .eq("id", room.id);

  assertRoomError(update.error, "Unable to reset the room.");

  return getRoomSnapshot(roomCode, actorToken);
}
