import "server-only";

import type { getCache } from "@vercel/functions";

import type { GameRoundRow, GameSessionRecord, PlayerAnswerRow, RoomPlayerRow, RoomRecord } from "@/types/app";

export type StoredGameSession = GameSessionRecord & {
  rounds: GameRoundRow[];
  answers: PlayerAnswerRow[];
};

export type StoredRoom = RoomRecord & {
  players: RoomPlayerRow[];
  game: StoredGameSession | null;
};

type GlobalStore = {
  roomsByCode: Map<string, StoredRoom>;
  gameIdToRoomCode: Map<string, string>;
};

const globalStore = globalThis as typeof globalThis & {
  __quizduellStore?: GlobalStore;
  __quizduellStoreLocks?: Map<string, Promise<void>>;
};

function createStore(): GlobalStore {
  return {
    roomsByCode: new Map<string, StoredRoom>(),
    gameIdToRoomCode: new Map<string, string>(),
  };
}

const ROOM_TTL_SECONDS = 60 * 60 * 12;
const ROOM_KEY_PREFIX = "quizduell:room";
const GAME_KEY_PREFIX = "quizduell:game";

type RuntimeCache = ReturnType<typeof getCache>;

let runtimeCachePromise: Promise<RuntimeCache | null> | null = null;

function cloneRoom(room: StoredRoom) {
  return structuredClone(room);
}

function roomKey(roomCode: string) {
  return `${ROOM_KEY_PREFIX}:${roomCode}`;
}

function gameKey(gameId: string) {
  return `${GAME_KEY_PREFIX}:${gameId}`;
}

export function getRoomStore() {
  if (!globalStore.__quizduellStore) {
    globalStore.__quizduellStore = createStore();
  }

  return globalStore.__quizduellStore;
}

function getStoreLocks() {
  if (!globalStore.__quizduellStoreLocks) {
    globalStore.__quizduellStoreLocks = new Map<string, Promise<void>>();
  }

  return globalStore.__quizduellStoreLocks;
}

export async function withStoreLock<T>(key: string, operation: () => Promise<T>) {
  const locks = getStoreLocks();
  const previousLock = locks.get(key) ?? Promise.resolve();
  let releaseLock: () => void = () => {};
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const lockTail = previousLock.then(() => currentLock, () => currentLock);

  locks.set(key, lockTail);
  await previousLock.catch(() => {});

  try {
    return await operation();
  } finally {
    releaseLock();

    if (locks.get(key) === lockTail) {
      locks.delete(key);
    }
  }
}

async function getRuntimeCache() {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  if (!runtimeCachePromise) {
    runtimeCachePromise = import("@vercel/functions")
      .then((module) => module.getCache())
      .catch(() => null);
  }

  return runtimeCachePromise;
}

export async function getRoomFromStore(roomCode: string) {
  const cache = await getRuntimeCache();

  if (!cache) {
    const room = getRoomStore().roomsByCode.get(roomCode);
    return room ? cloneRoom(room) : null;
  }

  const room = (await cache.get(roomKey(roomCode))) as StoredRoom | undefined;
  return room ? cloneRoom(room) : null;
}

export async function setRoomInStore(room: StoredRoom) {
  const roomCopy = cloneRoom(room);
  const activeGameId = roomCopy.game?.id ?? roomCopy.current_game_id ?? null;
  const cache = await getRuntimeCache();

  if (!cache) {
    const store = getRoomStore();
    store.roomsByCode.set(roomCopy.code, roomCopy);

    if (activeGameId) {
      store.gameIdToRoomCode.set(activeGameId, roomCopy.code);
    }

    return;
  }

  await cache.set(roomKey(roomCopy.code), roomCopy, {
    ttl: ROOM_TTL_SECONDS,
    tags: ["quizduell", `room:${roomCopy.code}`],
  });

  if (activeGameId) {
    await cache.set(gameKey(activeGameId), roomCopy.code, {
      ttl: ROOM_TTL_SECONDS,
      tags: ["quizduell", `game:${activeGameId}`],
    });
  }
}

export async function findRoomByGameId(gameId: string) {
  const cache = await getRuntimeCache();

  if (!cache) {
    const roomCode = getRoomStore().gameIdToRoomCode.get(gameId);

    if (!roomCode) {
      return null;
    }

    const room = getRoomStore().roomsByCode.get(roomCode);

    if (!room || room.game?.id !== gameId) {
      getRoomStore().gameIdToRoomCode.delete(gameId);
      return null;
    }

    return cloneRoom(room);
  }

  const roomCode = (await cache.get(gameKey(gameId))) as string | undefined;

  if (!roomCode) {
    return null;
  }

  const room = await getRoomFromStore(roomCode);

  if (!room || room.game?.id !== gameId) {
    await cache.delete(gameKey(gameId));
    return null;
  }

  return room;
}
