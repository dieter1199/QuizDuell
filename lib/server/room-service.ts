import "server-only";

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
import { ApiError } from "@/lib/server/api";
import { getCategoryBank } from "@/lib/server/content-service";
import { findRoomByGameId, getRoomFromStore, setRoomInStore, type StoredRoom } from "@/lib/server/room-store";
import { generateRoomCode, sanitizeName } from "@/lib/utils";
import type {
  LeaderboardEntry,
  PlayerAnswerRow,
  PlayerAnswerSnapshot,
  RoomPlayerRow,
  RoomPlayerSnapshot,
  RoomRecord,
  RoomSettings,
  RoomSnapshot,
} from "@/types/app";

function nowIso() {
  return new Date().toISOString();
}

function cloneRoomRecord(room: StoredRoom): RoomRecord {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    settings: structuredClone(room.settings),
    host_player_id: room.host_player_id,
    current_game_id: room.current_game_id,
    closed_reason: room.closed_reason,
    created_at: room.created_at,
    updated_at: room.updated_at,
  };
}

function touchRoom(room: StoredRoom) {
  room.updated_at = nowIso();
}

function getPlayersForRoom(room: StoredRoom) {
  return [...room.players].sort(
    (left, right) =>
      Number(right.is_host) - Number(left.is_host) ||
      left.joined_at.localeCompare(right.joined_at),
  );
}

function getPlayerByToken(room: StoredRoom, playerToken: string) {
  return room.players.find((player) => player.player_token === playerToken) ?? null;
}

function getUniqueDisplayName(room: StoredRoom, requestedName: string, excludedPlayerId?: string) {
  const existingNames = new Set(
    room.players
      .filter((player) => player.status === "active" && player.id !== excludedPlayerId)
      .map((player) => player.display_name.toLowerCase()),
  );

  const base = sanitizeName(requestedName);

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

function closeRoom(room: StoredRoom, reason: string) {
  room.status = "closed";
  room.closed_reason = reason;
  touchRoom(room);

  if (room.game && room.game.status === "active") {
    room.game.status = "cancelled";
    room.game.phase = "finished";
    room.game.ended_at = nowIso();
  }
}

function reconcileRoomPresence(room: StoredRoom) {
  const staleBefore = Date.now() - PLAYER_STALE_AFTER_MS;

  for (const player of room.players) {
    if (
      player.status === "active" &&
      player.connection_status === "online" &&
      new Date(player.last_seen_at).getTime() < staleBefore
    ) {
      player.connection_status = "offline";
    }
  }

  const host = room.players.find((player) => player.is_host);

  if (!host || host.status !== "active" || host.connection_status === "offline") {
    closeRoom(room, "host_left");
  }
}

async function maybeAdvanceGame(room: StoredRoom) {
  if (!room.game || room.game.status !== "active" || room.game.phase === "finished") {
    return room.game ?? null;
  }

  const game = room.game;
  const categories = await getCategoryBank();
  const currentRound =
    game.rounds.find((round) => round.round_number === game.current_round_number) ?? null;

  if (!currentRound) {
    return game;
  }

  const question = categories
    .flatMap((category) => category.questions)
    .find((entry) => entry.id === currentRound.question_id);

  if (!question) {
    throw new ApiError(500, "The current question could not be found.");
  }

  const now = new Date();
  const phaseEndsAt = new Date(game.phase_ends_at);
  const activePlayers = room.players.filter((player) => player.status === "active");
  const roundAnswers = game.answers.filter((answer) => answer.round_id === currentRound.id);

  if (game.phase === "question") {
    if (now < phaseEndsAt && roundAnswers.length < activePlayers.length) {
      return game;
    }

    const answeredPlayerIds = new Set(roundAnswers.map((answer) => answer.player_id));

    for (const player of activePlayers) {
      if (answeredPlayerIds.has(player.id)) {
        continue;
      }

      game.answers.push({
        id: crypto.randomUUID(),
        round_id: currentRound.id,
        player_id: player.id,
        selected_indexes: [],
        is_correct: false,
        timed_out: true,
        points_awarded: 0,
        submitted_at: nowIso(),
      });
    }

    game.phase = "reveal";
    game.phase_started_at = now.toISOString();
    game.phase_ends_at = nextRevealIso(now.toISOString());
    touchRoom(room);
    return game;
  }

  if (now < phaseEndsAt) {
    return game;
  }

  if (game.current_round_number >= game.total_rounds) {
    game.status = "finished";
    game.phase = "finished";
    game.ended_at = now.toISOString();
    room.status = "lobby";
    touchRoom(room);
    return game;
  }

  game.current_round_number += 1;
  game.phase = "question";
  game.phase_started_at = now.toISOString();
  game.phase_ends_at = new Date(
    now.getTime() + game.settings.timerSeconds * 1000,
  ).toISOString();
  touchRoom(room);

  return game;
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

  const answeredCurrentRoundIds = new Set(
    answers.filter((answer) => answer.round_id === currentRoundId).map((answer) => answer.player_id),
  );

  return players.map<RoomPlayerSnapshot>((player) => ({
    ...player,
    score: scoreMap.get(player.id) ?? 0,
    answeredCurrentRound: answeredCurrentRoundIds.has(player.id),
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

async function buildSnapshot(room: StoredRoom, playerToken?: string) {
  reconcileRoomPresence(room);

  if (room.game) {
    await maybeAdvanceGame(room);
  }

  await setRoomInStore(room);

  const categories = await getCategoryBank();
  const players = getPlayersForRoom(room);
  const roomRecord = cloneRoomRecord(room);

  if (!room.game) {
    const lobbyPlayers = players.map<RoomPlayerSnapshot>((player) => ({
      ...player,
      score: 0,
      answeredCurrentRound: false,
    }));

    return {
      room: roomRecord,
      me: playerToken ? lobbyPlayers.find((player) => player.player_token === playerToken) ?? null : null,
      players: lobbyPlayers,
      categories,
      game: null,
    } satisfies RoomSnapshot;
  }

  const game = room.game;
  const currentRound =
    game.rounds.find((round) => round.round_number === game.current_round_number) ?? game.rounds.at(-1) ?? null;
  const currentQuestion = currentRound
    ? categories.flatMap((category) => category.questions).find((question) => question.id === currentRound.question_id) ?? null
    : null;
  const playersWithScores = buildPlayersWithScores(players, game.answers, currentRound?.id);
  const submissions = currentRound
    ? game.answers.filter((answer) => answer.round_id === currentRound.id)
    : [];
  const playerLookup = new Map(playersWithScores.map((player) => [player.id, player]));

  return {
    room: roomRecord,
    me: playerToken
      ? playersWithScores.find((player) => player.player_token === playerToken) ?? null
      : null,
    players: playersWithScores,
    categories,
    game: {
      session: {
        id: game.id,
        room_id: game.room_id,
        status: game.status,
        phase: game.phase,
        current_round_number: game.current_round_number,
        total_rounds: game.total_rounds,
        settings: structuredClone(game.settings),
        phase_started_at: game.phase_started_at,
        phase_ends_at: game.phase_ends_at,
        started_at: game.started_at,
        ended_at: game.ended_at,
      },
      currentRound:
        currentRound && currentQuestion
          ? {
              round: currentRound,
              question: currentQuestion,
              answers: buildRoundAnswers(currentQuestion, currentRound.answer_order),
              correctDisplayIndexes: getCorrectDisplayIndexes(currentQuestion, currentRound.answer_order),
              submissions: submissions.map<PlayerAnswerSnapshot>((answer) => ({
                ...answer,
                displayName: playerLookup.get(answer.player_id)?.display_name ?? "Unknown player",
              })),
            }
          : null,
      leaderboard: buildLeaderboard(playersWithScores),
      submittedAnswerCount: submissions.length,
      requiredAnswerCount: playersWithScores.filter((player) => player.status === "active").length,
    },
  } satisfies RoomSnapshot;
}

async function assertHost(roomCode: string, actorToken: string) {
  const room = await getRoomFromStore(roomCode);

  if (!room) {
    throw new ApiError(404, "This room no longer exists.");
  }

  const player = getPlayerByToken(room, actorToken);

  if (!player || !player.is_host || player.status !== "active") {
    throw new ApiError(403, "Only the host can do that.");
  }

  return { room, player };
}

export async function getRoomSnapshot(roomCode: string, playerToken?: string) {
  const room = await getRoomFromStore(roomCode);

  if (!room) {
    throw new ApiError(404, "This room does not exist anymore.");
  }

  return buildSnapshot(room, playerToken);
}

export async function createRoom(displayName: string, playerToken: string) {
  const categories = await getCategoryBank();
  const now = nowIso();
  let roomCode = "";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateRoomCode();

    if (!(await getRoomFromStore(candidate))) {
      roomCode = candidate;
      break;
    }
  }

  if (!roomCode) {
    throw new ApiError(500, "We could not generate a unique room code.");
  }

  const roomId = crypto.randomUUID();
  const hostId = crypto.randomUUID();
  const room: StoredRoom = {
    id: roomId,
    code: roomCode,
    status: "lobby",
    settings: normalizeRoomSettings(undefined, categories.map((category) => category.id)),
    host_player_id: hostId,
    current_game_id: null,
    closed_reason: null,
    created_at: now,
    updated_at: now,
    players: [
      {
        id: hostId,
        room_id: roomId,
        player_token: playerToken,
        display_name: sanitizeName(displayName),
        is_host: true,
        status: "active",
        connection_status: "online",
        joined_at: now,
        last_seen_at: now,
        left_at: null,
      },
    ],
    game: null,
  };

  await setRoomInStore(room);

  return { roomCode };
}

export async function joinRoom(roomCode: string, displayName: string, playerToken: string) {
  const room = await getRoomFromStore(roomCode);

  if (!room || room.status === "closed") {
    throw new ApiError(404, "That room is no longer available.");
  }

  const existingPlayer = getPlayerByToken(room, playerToken);

  if (!existingPlayer && room.status === "active") {
    throw new ApiError(409, "A duel is already running. Join again when the room returns to the lobby.");
  }

  if (existingPlayer?.status === "kicked") {
    throw new ApiError(403, "You were removed from this room.");
  }

  if (existingPlayer?.status === "left" && room.status === "active") {
    throw new ApiError(409, "You already left this duel. Wait for the next lobby.");
  }

  if (existingPlayer) {
    existingPlayer.display_name = getUniqueDisplayName(room, displayName, existingPlayer.id);
    existingPlayer.status = "active";
    existingPlayer.connection_status = "online";
    existingPlayer.last_seen_at = nowIso();
    existingPlayer.left_at = null;
  } else {
    const timestamp = nowIso();

    room.players.push({
      id: crypto.randomUUID(),
      room_id: room.id,
      player_token: playerToken,
      display_name: getUniqueDisplayName(room, displayName),
      is_host: false,
      status: "active",
      connection_status: "online",
      joined_at: timestamp,
      last_seen_at: timestamp,
      left_at: null,
    });
  }

  touchRoom(room);
  return buildSnapshot(room, playerToken);
}

export async function updateHeartbeat(roomCode: string, playerToken: string) {
  const room = await getRoomFromStore(roomCode);

  if (!room || room.status === "closed") {
    throw new ApiError(404, "This room has already closed.");
  }

  const player = getPlayerByToken(room, playerToken);

  if (!player || player.status !== "active") {
    throw new ApiError(404, "Player not found in this room.");
  }

  player.last_seen_at = nowIso();
  player.connection_status = "online";
  touchRoom(room);

  return buildSnapshot(room, playerToken);
}

export async function leaveRoom(roomCode: string, playerToken: string) {
  const room = await getRoomFromStore(roomCode);

  if (!room) {
    return;
  }

  const player = getPlayerByToken(room, playerToken);

  if (!player || player.status !== "active") {
    return;
  }

  if (player.is_host) {
    closeRoom(room, "host_left");
  }

  player.status = "left";
  player.connection_status = "offline";
  player.left_at = nowIso();
  touchRoom(room);

  if (room.game && !player.is_host) {
    await maybeAdvanceGame(room);
  }

  await setRoomInStore(room);
}

export async function kickPlayer(roomCode: string, actorToken: string, playerId: string) {
  const { room } = await assertHost(roomCode, actorToken);
  const targetPlayer = room.players.find((player) => player.id === playerId) ?? null;

  if (!targetPlayer) {
    throw new ApiError(404, "Player not found.");
  }

  if (targetPlayer.is_host) {
    throw new ApiError(400, "The host cannot be kicked.");
  }

  targetPlayer.status = "kicked";
  targetPlayer.connection_status = "offline";
  targetPlayer.left_at = nowIso();
  touchRoom(room);

  if (room.game) {
    await maybeAdvanceGame(room);
  }

  return buildSnapshot(room, actorToken);
}

export async function updateRoomSettings(roomCode: string, actorToken: string, settings: RoomSettings) {
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status !== "lobby") {
    throw new ApiError(409, "Settings can only be changed from the lobby.");
  }

  room.settings = structuredClone(settings);
  touchRoom(room);

  return buildSnapshot(room, actorToken);
}

export async function startGame(roomCode: string, actorToken: string) {
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status !== "lobby") {
    throw new ApiError(409, "Finish the current duel before starting another one.");
  }

  const categories = await getCategoryBank();
  const settings = normalizeRoomSettings(room.settings, categories.map((category) => category.id));
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

  const activePlayers = room.players.filter((player) => player.status === "active");

  if (activePlayers.length < 2) {
    throw new ApiError(400, "At least 2 active players are required.");
  }

  const orderedQuestions = settings.randomizeQuestionOrder
    ? shuffleArray(selectedQuestions)
    : [...selectedQuestions].sort((left, right) => left.created_at.localeCompare(right.created_at));
  const questionsForGame = orderedQuestions.slice(0, settings.questionCount);
  const timestamp = nowIso();
  const gameId = crypto.randomUUID();

  room.game = {
    id: gameId,
    room_id: room.id,
    status: "active",
    phase: "question",
    current_round_number: 1,
    total_rounds: questionsForGame.length,
    settings: structuredClone(settings),
    phase_started_at: timestamp,
    phase_ends_at: new Date(Date.now() + settings.timerSeconds * 1000).toISOString(),
    started_at: timestamp,
    ended_at: null,
    rounds: questionsForGame.map((question, index) => ({
      id: crypto.randomUUID(),
      game_session_id: gameId,
      question_id: question.id,
      round_number: index + 1,
      answer_order: createAnswerOrder(settings.randomizeAnswerOrder),
      created_at: timestamp,
    })),
    answers: [],
  };
  room.status = "active";
  room.current_game_id = gameId;
  room.closed_reason = null;
  touchRoom(room);

  return buildSnapshot(room, actorToken);
}

export async function submitAnswer(gameId: string, playerToken: string, selectedIndexes: number[]) {
  const room = await findRoomByGameId(gameId);

  if (!room || !room.game) {
    throw new ApiError(404, "This duel does not exist.");
  }

  await maybeAdvanceGame(room);

  const game = room.game;

  if (game.status !== "active" || game.phase !== "question") {
    throw new ApiError(409, "This question is already locked.");
  }

  const currentRound = game.rounds.find((round) => round.round_number === game.current_round_number) ?? null;

  if (!currentRound) {
    throw new ApiError(500, "The current round could not be found.");
  }

  const player = getPlayerByToken(room, playerToken);

  if (!player || player.status !== "active") {
    throw new ApiError(403, "You are no longer an active player in this room.");
  }

  if (game.answers.some((answer) => answer.round_id === currentRound.id && answer.player_id === player.id)) {
    throw new ApiError(409, "Your answer is already locked in.");
  }

  const categories = await getCategoryBank();
  const question = categories
    .flatMap((category) => category.questions)
    .find((entry) => entry.id === currentRound.question_id);

  if (!question) {
    throw new ApiError(500, "The current question could not be found.");
  }

  const scoring = scoreSelection(
    selectedIndexes,
    question,
    currentRound.answer_order,
    game.settings.pointsPerQuestion,
  );

  game.answers.push({
    id: crypto.randomUUID(),
    round_id: currentRound.id,
    player_id: player.id,
    selected_indexes: scoring.normalizedSelection,
    is_correct: scoring.isCorrect,
    timed_out: false,
    points_awarded: scoring.pointsAwarded,
    submitted_at: nowIso(),
  });
  touchRoom(room);

  await maybeAdvanceGame(room);

  return buildSnapshot(room, playerToken);
}

export async function advanceGame(gameId: string, playerToken?: string) {
  const room = await findRoomByGameId(gameId);

  if (!room) {
    throw new ApiError(404, "This room no longer exists.");
  }

  const game = await maybeAdvanceGame(room);

  if (!game) {
    throw new ApiError(404, "This duel does not exist.");
  }

  return buildSnapshot(room, playerToken);
}

export async function replayRoom(roomCode: string, actorToken: string) {
  const { room } = await assertHost(roomCode, actorToken);

  if (room.status === "closed") {
    throw new ApiError(409, "This room has already closed.");
  }

  room.status = "lobby";
  room.current_game_id = null;
  room.closed_reason = null;
  room.game = null;
  touchRoom(room);

  return buildSnapshot(room, actorToken);
}
