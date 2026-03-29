import type { Database } from "@/types/database";
import type { CategoryInput, CategoryWithQuestions, QuestionInput, QuestionRecord } from "@/types/app";

import { ApiError } from "@/lib/server/api";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseQuestionAnswers } from "@/lib/game";

type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];
type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];
type QuestionUpdate = Database["public"]["Tables"]["questions"]["Update"];

function assertContentError(message: string, error: { code?: string; message: string } | null) {
  if (!error) {
    return;
  }

  if (error.code === "23505") {
    throw new ApiError(409, error.message);
  }

  throw new ApiError(500, message);
}

function toQuestionRecord(row: Database["public"]["Tables"]["questions"]["Row"]): QuestionRecord {
  return {
    ...row,
    answers: parseQuestionAnswers(row.answers),
    correct_answer_indexes: row.correct_answer_indexes ?? [],
  };
}

export async function getCategoryBank() {
  const admin = getSupabaseAdminClient();
  const [categoriesResponse, questionsResponse] = await Promise.all([
    admin.from("categories").select("*").order("name", { ascending: true }),
    admin.from("questions").select("*").order("created_at", { ascending: true }),
  ]);

  assertContentError("Unable to load categories.", categoriesResponse.error);
  assertContentError("Unable to load questions.", questionsResponse.error);

  const categories = (categoriesResponse.data ?? []) as Database["public"]["Tables"]["categories"]["Row"][];
  const questions = (questionsResponse.data ?? []) as Database["public"]["Tables"]["questions"]["Row"][];
  const questionsByCategory = new Map<string, QuestionRecord[]>();

  for (const question of questions) {
    const bucket = questionsByCategory.get(question.category_id) ?? [];
    bucket.push(toQuestionRecord(question));
    questionsByCategory.set(question.category_id, bucket);
  }

  return categories.map((category) => ({
    ...category,
    questions: questionsByCategory.get(category.id) ?? [],
  })) satisfies CategoryWithQuestions[];
}

export async function createCategory(input: CategoryInput) {
  const admin = getSupabaseAdminClient();
  const insert: CategoryInsert = {
    name: input.name,
    description: input.description,
  };

  const { error } = await admin.from("categories").insert(insert as never);
  assertContentError("Unable to create the category.", error);

  return getCategoryBank();
}

export async function updateCategory(id: string, input: CategoryInput) {
  const admin = getSupabaseAdminClient();
  const update: CategoryUpdate = {
    name: input.name,
    description: input.description,
  };

  const { error } = await admin.from("categories").update(update as never).eq("id", id);
  assertContentError("Unable to update the category.", error);

  return getCategoryBank();
}

export async function deleteCategory(id: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  assertContentError("Unable to delete the category.", error);

  return getCategoryBank();
}

export async function createQuestion(input: QuestionInput) {
  const admin = getSupabaseAdminClient();
  const insert: QuestionInsert = {
    category_id: input.categoryId,
    prompt: input.prompt,
    answers: input.answers,
    correct_answer_indexes: input.correctAnswerIndexes,
    explanation: input.explanation?.trim() ? input.explanation.trim() : null,
    difficulty: input.difficulty,
  };

  const { error } = await admin.from("questions").insert(insert as never);
  assertContentError("Unable to create the question.", error);

  return getCategoryBank();
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const admin = getSupabaseAdminClient();
  const update: QuestionUpdate = {
    category_id: input.categoryId,
    prompt: input.prompt,
    answers: input.answers,
    correct_answer_indexes: input.correctAnswerIndexes,
    explanation: input.explanation?.trim() ? input.explanation.trim() : null,
    difficulty: input.difficulty,
  };

  const { error } = await admin.from("questions").update(update as never).eq("id", id);
  assertContentError("Unable to update the question.", error);

  return getCategoryBank();
}

export async function deleteQuestion(id: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("questions").delete().eq("id", id);
  assertContentError("Unable to delete the question.", error);

  return getCategoryBank();
}

export async function duplicateQuestion(id: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("questions").select("*").eq("id", id).maybeSingle();
  assertContentError("Unable to duplicate the question.", error);
  const question = data as Database["public"]["Tables"]["questions"]["Row"] | null;

  if (!question) {
    throw new ApiError(404, "Question not found.");
  }

  let prompt = `${question.prompt} (Copy)`;
  let suffix = 2;

  while (true) {
    const existing = await admin
      .from("questions")
      .select("id")
      .eq("category_id", question.category_id)
      .eq("prompt", prompt)
      .maybeSingle();

    assertContentError("Unable to duplicate the question.", existing.error);

    if (!existing.data) {
      break;
    }

    prompt = `${question.prompt} (Copy ${suffix})`;
    suffix += 1;
  }

  const { error: insertError } = await admin.from("questions").insert({
    category_id: question.category_id,
    prompt,
    answers: question.answers,
    correct_answer_indexes: question.correct_answer_indexes,
    explanation: question.explanation,
    difficulty: question.difficulty,
  } as never);

  assertContentError("Unable to duplicate the question.", insertError);

  return getCategoryBank();
}
