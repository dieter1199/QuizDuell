import { DEFAULT_ROOM_SETTINGS } from "@/lib/constants";
import { arraysEqual, sortNumberArray } from "@/lib/utils";
import type { QuestionRecord, RoomSettings, RoundAnswerOption } from "@/types/app";

export function normalizeRoomSettings(
  value: Partial<RoomSettings> | unknown,
  fallbackCategoryIds: string[] = [],
): RoomSettings {
  const base: RoomSettings = {
    ...DEFAULT_ROOM_SETTINGS,
    selectedCategoryIds: fallbackCategoryIds.length ? fallbackCategoryIds : [],
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }

  const candidate = value as Partial<RoomSettings>;

  return {
    questionCount:
      typeof candidate.questionCount === "number" ? candidate.questionCount : base.questionCount,
    useAllQuestions:
      typeof candidate.useAllQuestions === "boolean"
        ? candidate.useAllQuestions
        : base.useAllQuestions,
    timerEnabled:
      typeof candidate.timerEnabled === "boolean"
        ? candidate.timerEnabled
        : base.timerEnabled,
    timerSeconds:
      typeof candidate.timerSeconds === "number" ? candidate.timerSeconds : base.timerSeconds,
    selectedCategoryIds:
      Array.isArray(candidate.selectedCategoryIds) && candidate.selectedCategoryIds.length
        ? candidate.selectedCategoryIds.filter((entry): entry is string => typeof entry === "string")
        : base.selectedCategoryIds,
    randomizeQuestionOrder:
      typeof candidate.randomizeQuestionOrder === "boolean"
        ? candidate.randomizeQuestionOrder
        : base.randomizeQuestionOrder,
    randomizeAnswerOrder:
      typeof candidate.randomizeAnswerOrder === "boolean"
        ? candidate.randomizeAnswerOrder
        : base.randomizeAnswerOrder,
    showExplanations:
      typeof candidate.showExplanations === "boolean"
        ? candidate.showExplanations
        : base.showExplanations,
  };
}

export function shuffleArray<T>(items: T[]) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }

  return clone;
}

export function createAnswerOrder(randomizeAnswerOrder: boolean) {
  const base = [0, 1, 2];
  return randomizeAnswerOrder ? shuffleArray(base) : base;
}

export function getCorrectDisplayIndexes(question: QuestionRecord, answerOrder: number[]) {
  return sortNumberArray(
    answerOrder
      .map((sourceIndex, displayIndex) =>
        question.correct_answer_indexes.includes(sourceIndex) ? displayIndex : null,
      )
      .filter((value): value is number => value !== null),
  );
}

export function evaluateSelection(
  selectedIndexes: number[],
  question: QuestionRecord,
  answerOrder: number[],
) {
  const normalizedSelection = sortNumberArray(selectedIndexes);
  const correctDisplayIndexes = getCorrectDisplayIndexes(question, answerOrder);
  const isCorrect = arraysEqual(normalizedSelection, correctDisplayIndexes);

  return {
    normalizedSelection,
    correctDisplayIndexes,
    isCorrect,
  };
}

export function buildRoundAnswers(question: QuestionRecord, answerOrder: number[]): RoundAnswerOption[] {
  return answerOrder.map((sourceIndex, displayIndex) => ({
    displayIndex,
    sourceIndex,
    text: question.answers[sourceIndex],
    isCorrect: question.correct_answer_indexes.includes(sourceIndex),
  }));
}
