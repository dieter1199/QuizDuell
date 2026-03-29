import { z } from "zod";

import { sanitizeName, sanitizeRoomCode } from "@/lib/utils";

export const displayNameSchema = z
  .string()
  .transform((value) => sanitizeName(value))
  .pipe(z.string().min(2, "Please enter at least 2 characters.").max(24, "Use 24 characters or fewer."));

export const roomCodeSchema = z
  .string()
  .transform((value) => sanitizeRoomCode(value))
  .pipe(z.string().length(6, "Room codes are 6 characters."));

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(40, "Use 40 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(4, "Description is required.")
    .max(160, "Use 160 characters or fewer."),
});

export const questionSchema = z.object({
  categoryId: z.string().uuid("Pick a category."),
  prompt: z.string().trim().min(8, "Question text is required.").max(220, "Use 220 characters or fewer."),
  answers: z
    .array(z.string().trim().min(1, "Answer text is required.").max(120, "Use 120 characters or fewer."))
    .length(3, "Each question must have exactly 3 answers."),
  correctAnswerIndexes: z
    .array(z.number().int().min(0).max(2))
    .min(1, "Pick at least 1 correct answer.")
    .max(2, "Pick at most 2 correct answers.")
    .refine((values) => new Set(values).size === values.length, "Duplicate correct answers are not allowed."),
  explanation: z.string().trim().max(280, "Use 280 characters or fewer.").optional().or(z.literal("")),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const roomSettingsSchema = z.object({
  questionCount: z.number().int().min(5).max(30),
  timerSeconds: z.number().int().min(5).max(30),
  pointsPerQuestion: z.number().int().min(5).max(50),
  selectedCategoryIds: z.array(z.string().uuid()).min(1, "Select at least one category."),
  randomizeQuestionOrder: z.boolean(),
  randomizeAnswerOrder: z.boolean(),
  showExplanations: z.boolean(),
});

export const createRoomSchema = z.object({
  displayName: displayNameSchema,
  playerToken: z.string().uuid(),
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  displayName: displayNameSchema,
  playerToken: z.string().uuid(),
});

export const roomActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("heartbeat"),
    playerToken: z.string().uuid(),
  }),
  z.object({
    action: z.literal("leave"),
    playerToken: z.string().uuid(),
  }),
  z.object({
    action: z.literal("kick"),
    actorToken: z.string().uuid(),
    playerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("updateSettings"),
    actorToken: z.string().uuid(),
    settings: roomSettingsSchema,
  }),
  z.object({
    action: z.literal("startGame"),
    actorToken: z.string().uuid(),
  }),
  z.object({
    action: z.literal("replay"),
    actorToken: z.string().uuid(),
  }),
]);

export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submitAnswer"),
    playerToken: z.string().uuid(),
    selectedIndexes: z
      .array(z.number().int().min(0).max(2))
      .min(1, "Select at least one answer.")
      .max(2, "Select at most two answers.")
      .refine((values) => new Set(values).size === values.length, "Duplicate answers are not allowed."),
  }),
  z.object({
    action: z.literal("advance"),
    playerToken: z.string().uuid().optional(),
  }),
]);
