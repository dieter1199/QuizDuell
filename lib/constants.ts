import type { RoomSettings } from "@/types/app";

export const APP_NAME = "QuizDuell Live";
export const PLAYER_PROFILE_STORAGE_KEY = "quizduell.profile";
export const ROOM_REVEAL_DURATION_SECONDS = 3;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const PLAYER_STALE_AFTER_MS = 45_000;
export const ROOM_CODE_LENGTH = 6;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  questionCount: 20,
  timerSeconds: 10,
  pointsPerQuestion: 10,
  selectedCategoryIds: [],
  randomizeQuestionOrder: true,
  randomizeAnswerOrder: true,
  showExplanations: true,
};

export const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;
