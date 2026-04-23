export type QuestionDifficulty = "easy" | "medium" | "hard";
export type RoomStatus = "lobby" | "active" | "closed";
export type PlayerStatus = "active" | "left" | "kicked";
export type PlayerConnectionStatus = "online" | "offline";
export type GamePhase = "question" | "reveal" | "finished";
export type GameStatus = "active" | "finished" | "cancelled";

export type RoomSettings = {
  questionCount: number;
  useAllQuestions: boolean;
  timerSeconds: number;
  selectedCategoryIds: string[];
  randomizeQuestionOrder: boolean;
  randomizeAnswerOrder: boolean;
  showExplanations: boolean;
};

export type CategoryRecord = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type QuestionRecord = {
  id: string;
  category_id: string;
  prompt: string;
  answers: string[];
  correct_answer_indexes: number[];
  explanation: string | null;
  difficulty: QuestionDifficulty;
  created_at: string;
  updated_at: string;
};

export type RoomRecord = {
  id: string;
  code: string;
  status: RoomStatus;
  version: number;
  settings: RoomSettings;
  host_player_id: string | null;
  current_game_id: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomPlayerRow = {
  id: string;
  room_id: string;
  player_token: string;
  display_name: string;
  is_host: boolean;
  status: PlayerStatus;
  connection_status: PlayerConnectionStatus;
  joined_at: string;
  last_seen_at: string;
  left_at: string | null;
};

export type GameSessionRecord = {
  id: string;
  room_id: string;
  status: GameStatus;
  phase: GamePhase;
  is_paused: boolean;
  paused_ms_remaining: number | null;
  current_round_number: number;
  total_rounds: number;
  settings: RoomSettings;
  phase_started_at: string;
  phase_ends_at: string;
  started_at: string;
  ended_at: string | null;
};

export type GameRoundRow = {
  id: string;
  game_session_id: string;
  question_id: string;
  round_number: number;
  answer_order: number[];
  created_at: string;
};

export type PlayerAnswerRow = {
  id: string;
  round_id: string;
  player_id: string;
  selected_indexes: number[];
  is_correct: boolean;
  timed_out: boolean;
  submitted_at: string;
};

export type CategoryWithQuestions = CategoryRecord & {
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

export type ReviewedAnswerOption = {
  displayIndex: number;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
};

export type WrongQuestionReview = {
  answerId: string;
  roundId: string;
  roundNumber: number;
  questionId: string;
  categoryId: string;
  categoryName: string;
  prompt: string;
  explanation: string | null;
  timedOut: boolean;
  answers: ReviewedAnswerOption[];
};

export type PlayerCategoryStat = {
  categoryId: string;
  categoryName: string;
  correctCount: number;
  totalCount: number;
};

export type PlayerGameReview = {
  playerId: string;
  displayName: string;
  categoryStats: PlayerCategoryStat[];
  wrongQuestions: WrongQuestionReview[];
};

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  correctCount: number;
  answeredCount: number;
  isHost: boolean;
  status: PlayerStatus;
  connectionStatus: PlayerConnectionStatus;
};

export type RoomPlayerSnapshot = RoomPlayerRow & {
  correctCount: number;
  answeredCount: number;
  answeredCurrentRound: boolean;
};

export type GameSnapshot = {
  session: GameSessionRecord;
  currentRound: RoundSnapshot | null;
  leaderboard: LeaderboardEntry[];
  playerReviews: PlayerGameReview[];
  submittedAnswerCount: number;
  requiredAnswerCount: number;
};

export type RoomSnapshot = {
  server_time: string;
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
