import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { DEFAULT_ROOM_SETTINGS, ROOM_CODE_LENGTH } from "@/lib/constants";
import type { RoomSettings } from "@/types/app";

const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(length = ROOM_CODE_LENGTH) {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length);
    return ROOM_CODE_CHARACTERS[index];
  }).join("");
}

export function generatePlayerToken() {
  return crypto.randomUUID();
}

export function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sanitizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function sortNumberArray(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

export function arraysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function formatCountdown(msRemaining: number) {
  return Math.max(0, Math.ceil(msRemaining / 1000));
}

export function mergeRoomSettings(
  input: Partial<RoomSettings> | null | undefined,
  fallbackCategoryIds: string[] = [],
): RoomSettings {
  const base = {
    ...DEFAULT_ROOM_SETTINGS,
    selectedCategoryIds: fallbackCategoryIds.length
      ? fallbackCategoryIds
      : DEFAULT_ROOM_SETTINGS.selectedCategoryIds,
  };

  if (!input) {
    return base;
  }

  return {
    ...base,
    ...input,
    selectedCategoryIds:
      input.selectedCategoryIds && input.selectedCategoryIds.length
        ? input.selectedCategoryIds
        : base.selectedCategoryIds,
  };
}

export function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}
