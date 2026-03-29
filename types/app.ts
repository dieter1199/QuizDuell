import type { Database } from "@/types/database";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
export type RoomPlayerRow = Database["public"]["Tables"]["room_players"]["Row"];
export type GameSessionRow = Database["public"]["Tables"]["game_sessions"]["Row"];
export type GameRoundRow = Database["public"]["Tables"]["game_rounds"]["Row"];
export type PlayerAnswerRow = Database["public"]["Tables"]["player_answers"]["Row"];

export type QuestionDifficulty = QuestionRow["difficulty"];
export type RoomStatus = RoomRow["status"];
export type PlayerStatus = RoomPlayerRow["status"];
export type PlayerConnectionStatus = RoomPlayerRow["connection_status"];
export type GamePhase = GameSessionRow["phase"];
export type GameStatus = GameSessionRow["status"];

export type RoomSettings = {
  questionCount: number;
  timerSeconds: number;
  pointsPerQuestion: number;
  selectedCategoryIds: string[];
  randomizeQuestionOrder: boolean;
  randomizeAnswerOrder: boolean;
  showExplanations: boolean;
};

export type QuestionRecord = Omit<QuestionRow, "answers" | "correct_answer_indexes"> & {
  answers: string[];
  correct_answer_indexes: number[];
};

export type RoomRecord = Omit<RoomRow, "settings"> & {
  settings: RoomSettings;
};

export type GameSessionRecord = Omit<GameSessionRow, "settings"> & {
  settings: RoomSettings;
};

export type CategoryWithQuestions = CategoryRow & {
  questions: QuestionRecord[];
};

export type RoundAnswerOption = {
  displayIndex: number;
  sourceIndex: number;
  text: string;
  isCorrect: boolean;
};

export type PlayerAnswerSnapshot = PlayerAnswerRow & {
  displayName: string;
};

export type RoundSnapshot = {
  round: GameRoundRow;
  question: QuestionRecord;
  answers: RoundAnswerOption[];
  correctDisplayIndexes: number[];
  submissions: PlayerAnswerSnapshot[];
};

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  score: number;
  isHost: boolean;
  status: PlayerStatus;
  connectionStatus: PlayerConnectionStatus;
};

export type RoomPlayerSnapshot = RoomPlayerRow & {
  score: number;
  answeredCurrentRound: boolean;
};

export type GameSnapshot = {
  session: GameSessionRecord;
  currentRound: RoundSnapshot | null;
  leaderboard: LeaderboardEntry[];
  submittedAnswerCount: number;
  requiredAnswerCount: number;
};

export type RoomSnapshot = {
  room: RoomRecord;
  me: RoomPlayerSnapshot | null;
  players: RoomPlayerSnapshot[];
  categories: CategoryWithQuestions[];
  game: GameSnapshot | null;
};

export type PlayerProfile = {
  displayName: string;
  playerToken: string;
};

export type CategoryInput = {
  name: string;
  description: string;
};

export type QuestionInput = {
  categoryId: string;
  prompt: string;
  answers: string[];
  correctAnswerIndexes: number[];
  explanation?: string;
  difficulty: QuestionDifficulty;
};
