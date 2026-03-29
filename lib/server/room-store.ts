import "server-only";

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
};

const globalStore = globalThis as typeof globalThis & {
  __quizduellStore?: GlobalStore;
};

function createStore(): GlobalStore {
  return {
    roomsByCode: new Map<string, StoredRoom>(),
  };
}

export function getRoomStore() {
  if (!globalStore.__quizduellStore) {
    globalStore.__quizduellStore = createStore();
  }

  return globalStore.__quizduellStore;
}

export function getRoomFromStore(roomCode: string) {
  return getRoomStore().roomsByCode.get(roomCode) ?? null;
}

export function setRoomInStore(room: StoredRoom) {
  getRoomStore().roomsByCode.set(room.code, room);
}

export function findRoomByGameId(gameId: string) {
  for (const room of getRoomStore().roomsByCode.values()) {
    if (room.game?.id === gameId) {
      return room;
    }
  }

  return null;
}
