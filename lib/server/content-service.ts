import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { ApiError } from "@/lib/server/api";
import type { CategoryInput, CategoryWithQuestions, QuestionInput, QuestionRecord } from "@/types/app";

const QUESTION_BANK_PATH = path.join(process.cwd(), "data", "question-bank.json");

let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

async function readQuestionBankFile() {
  const raw = await fs.readFile(QUESTION_BANK_PATH, "utf8");
  return JSON.parse(raw) as CategoryWithQuestions[];
}

async function writeQuestionBankFile(categories: CategoryWithQuestions[]) {
  writeQueue = writeQueue.then(async () => {
    await fs.writeFile(QUESTION_BANK_PATH, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
  });

  await writeQueue;
}

function cloneCategoryBank(categories: CategoryWithQuestions[]) {
  return structuredClone(categories);
}

function ensureUniqueCategoryName(
  categories: CategoryWithQuestions[],
  name: string,
  excludedCategoryId?: string,
) {
  const normalized = name.toLowerCase();
  const exists = categories.some(
    (category) => category.id !== excludedCategoryId && category.name.toLowerCase() === normalized,
  );

  if (exists) {
    throw new ApiError(409, "A category with that name already exists.");
  }
}

function ensureUniqueQuestionPrompt(
  category: CategoryWithQuestions,
  prompt: string,
  excludedQuestionId?: string,
) {
  const normalized = prompt.toLowerCase();
  const exists = category.questions.some(
    (question) => question.id !== excludedQuestionId && question.prompt.toLowerCase() === normalized,
  );

  if (exists) {
    throw new ApiError(409, "A question with that prompt already exists in this category.");
  }
}

function createQuestionRecord(input: QuestionInput): QuestionRecord {
  const timestamp = nowIso();

  return {
    id: crypto.randomUUID(),
    category_id: input.categoryId,
    prompt: input.prompt,
    answers: input.answers,
    correct_answer_indexes: input.correctAnswerIndexes,
    explanation: input.explanation?.trim() ? input.explanation.trim() : null,
    difficulty: input.difficulty,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function getCategoryBank() {
  const categories = await readQuestionBankFile();
  return cloneCategoryBank(categories);
}

export async function createCategory(input: CategoryInput) {
  const categories = await readQuestionBankFile();
  ensureUniqueCategoryName(categories, input.name);

  const timestamp = nowIso();

  categories.push({
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    created_at: timestamp,
    updated_at: timestamp,
    questions: [],
  });

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}

export async function updateCategory(id: string, input: CategoryInput) {
  const categories = await readQuestionBankFile();
  const category = categories.find((entry) => entry.id === id);

  if (!category) {
    throw new ApiError(404, "Category not found.");
  }

  ensureUniqueCategoryName(categories, input.name, id);

  category.name = input.name;
  category.description = input.description;
  category.updated_at = nowIso();

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}

export async function deleteCategory(id: string) {
  const categories = await readQuestionBankFile();
  const nextCategories = categories.filter((category) => category.id !== id);

  if (nextCategories.length === categories.length) {
    throw new ApiError(404, "Category not found.");
  }

  await writeQuestionBankFile(nextCategories);
  return cloneCategoryBank(nextCategories);
}

export async function createQuestion(input: QuestionInput) {
  const categories = await readQuestionBankFile();
  const category = categories.find((entry) => entry.id === input.categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found.");
  }

  ensureUniqueQuestionPrompt(category, input.prompt);
  category.questions.push(createQuestionRecord(input));
  category.updated_at = nowIso();

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const categories = await readQuestionBankFile();
  const currentCategory = categories.find((category) =>
    category.questions.some((question) => question.id === id),
  );
  const targetCategory = categories.find((category) => category.id === input.categoryId);

  if (!currentCategory || !targetCategory) {
    throw new ApiError(404, "Question or category not found.");
  }

  const questionIndex = currentCategory.questions.findIndex((question) => question.id === id);
  const existingQuestion = currentCategory.questions[questionIndex];

  ensureUniqueQuestionPrompt(targetCategory, input.prompt, id);

  const updatedQuestion: QuestionRecord = {
    ...existingQuestion,
    category_id: input.categoryId,
    prompt: input.prompt,
    answers: input.answers,
    correct_answer_indexes: input.correctAnswerIndexes,
    explanation: input.explanation?.trim() ? input.explanation.trim() : null,
    difficulty: input.difficulty,
    updated_at: nowIso(),
  };

  currentCategory.questions.splice(questionIndex, 1);

  if (currentCategory.id === targetCategory.id) {
    currentCategory.questions.push(updatedQuestion);
    currentCategory.updated_at = nowIso();
  } else {
    currentCategory.updated_at = nowIso();
    targetCategory.questions.push(updatedQuestion);
    targetCategory.updated_at = nowIso();
  }

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}

export async function deleteQuestion(id: string) {
  const categories = await readQuestionBankFile();
  let removed = false;

  for (const category of categories) {
    const nextQuestions = category.questions.filter((question) => question.id !== id);

    if (nextQuestions.length !== category.questions.length) {
      category.questions = nextQuestions;
      category.updated_at = nowIso();
      removed = true;
      break;
    }
  }

  if (!removed) {
    throw new ApiError(404, "Question not found.");
  }

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}

export async function duplicateQuestion(id: string) {
  const categories = await readQuestionBankFile();
  const category = categories.find((entry) => entry.questions.some((question) => question.id === id));

  if (!category) {
    throw new ApiError(404, "Question not found.");
  }

  const original = category.questions.find((question) => question.id === id);

  if (!original) {
    throw new ApiError(404, "Question not found.");
  }

  let prompt = `${original.prompt} (Copy)`;
  let suffix = 2;

  while (category.questions.some((question) => question.prompt.toLowerCase() === prompt.toLowerCase())) {
    prompt = `${original.prompt} (Copy ${suffix})`;
    suffix += 1;
  }

  const timestamp = nowIso();

  category.questions.push({
    ...structuredClone(original),
    id: crypto.randomUUID(),
    prompt,
    created_at: timestamp,
    updated_at: timestamp,
  });
  category.updated_at = timestamp;

  await writeQuestionBankFile(categories);
  return cloneCategoryBank(categories);
}
