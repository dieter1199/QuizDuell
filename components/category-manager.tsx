"use client";

import { useMemo, useState } from "react";
import { CopyPlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTY_OPTIONS } from "@/lib/constants";
import { categorySchema, questionSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type {
  CategoryInput,
  CategoryWithQuestions,
  QuestionDifficulty,
  QuestionInput,
  QuestionRecord,
} from "@/types/app";

type CategoryManagerProps = {
  categories: CategoryWithQuestions[];
  editable?: boolean;
  onCreateCategory?: (input: CategoryInput) => Promise<void>;
  onUpdateCategory?: (id: string, input: CategoryInput) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onCreateQuestion?: (input: QuestionInput) => Promise<void>;
  onUpdateQuestion?: (id: string, input: QuestionInput) => Promise<void>;
  onDeleteQuestion?: (id: string) => Promise<void>;
  onDuplicateQuestion?: (id: string) => Promise<void>;
};

type CategoryDialogState =
  | { mode: "create" }
  | { mode: "edit"; category: CategoryWithQuestions }
  | null;

type QuestionDialogState =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; question: QuestionRecord }
  | null;

type QuestionForm = {
  categoryId: string;
  prompt: string;
  answers: string[];
  correctAnswerIndexes: number[];
  explanation: string;
  difficulty: QuestionDifficulty;
};

function createQuestionForm(categoryId = ""): QuestionForm {
  return {
    categoryId,
    prompt: "",
    answers: ["", "", ""],
    correctAnswerIndexes: [0],
    explanation: "",
    difficulty: "easy",
  };
}

export function CategoryManager({
  categories,
  editable = false,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
}: CategoryManagerProps) {
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>(null);
  const [questionDialog, setQuestionDialog] = useState<QuestionDialogState>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryInput>({
    name: "",
    description: "",
  });
  const [questionForm, setQuestionForm] = useState<QuestionForm>(createQuestionForm());
  const [error, setError] = useState<string | null>(null);
  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name)),
    [categories],
  );

  const openCreateCategory = () => {
    setError(null);
    setCategoryForm({ name: "", description: "" });
    setCategoryDialog({ mode: "create" });
  };

  const openEditCategory = (category: CategoryWithQuestions) => {
    setError(null);
    setCategoryForm({ name: category.name, description: category.description });
    setCategoryDialog({ mode: "edit", category });
  };

  const openCreateQuestion = (categoryId: string) => {
    setError(null);
    setQuestionForm(createQuestionForm(categoryId));
    setQuestionDialog({ mode: "create", categoryId });
  };

  const openEditQuestion = (question: QuestionRecord) => {
    setError(null);
    setQuestionForm({
      categoryId: question.category_id,
      prompt: question.prompt,
      answers: question.answers,
      correctAnswerIndexes: question.correct_answer_indexes,
      explanation: question.explanation ?? "",
      difficulty: question.difficulty,
    });
    setQuestionDialog({ mode: "edit", question });
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = categorySchema.safeParse(categoryForm);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to save this category.");
      return;
    }

    try {
      if (categoryDialog?.mode === "edit") {
        await onUpdateCategory?.(categoryDialog.category.id, parsed.data);
      } else {
        await onCreateCategory?.(parsed.data);
      }

      setCategoryDialog(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save this category.");
    }
  };

  const handleQuestionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = questionSchema.safeParse(questionForm);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Unable to save this question.");
      return;
    }

    try {
      if (questionDialog?.mode === "edit") {
        await onUpdateQuestion?.(questionDialog.question.id, parsed.data);
      } else {
        await onCreateQuestion?.(parsed.data);
      }

      setQuestionDialog(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save this question.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Question bank</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">Categories and prompts</h3>
        </div>
        {editable ? (
          <Button size="sm" onClick={openCreateCategory}>
            <Plus className="mr-2 size-4" />
            New category
          </Button>
        ) : null}
      </div>

      {sortedCategories.length === 0 ? (
        <Card className="text-center text-slate-300">
          <Sparkles className="mx-auto mb-3 size-10 text-amber-300" />
          <p className="text-lg font-medium text-white">No categories yet</p>
          <p className="mt-2 text-sm text-slate-300">
            Start by creating a category, then add questions with exactly 3 answers.
          </p>
        </Card>
      ) : null}

      <div className="space-y-4">
        {sortedCategories.map((category) => (
          <Card key={category.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xl font-semibold text-white">{category.name}</h4>
                  <Badge tone="cool">{category.questions.length} questions</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">{category.description}</p>
              </div>
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openCreateQuestion(category.id)}>
                    <Plus className="mr-2 size-4" />
                    New question
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditCategory(category)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      void onDeleteCategory?.(category.id);
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {category.questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge tone="warm" className="mb-3">
                        {question.difficulty}
                      </Badge>
                      <p className="text-base font-medium text-white">{question.prompt}</p>
                    </div>
                    {editable ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditQuestion(question)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void onDuplicateQuestion?.(question.id);
                          }}
                        >
                          <CopyPlus className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void onDeleteQuestion?.(question.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2">
                    {question.answers.map((answer, index) => (
                      <div
                        key={`${question.id}-${index}`}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-sm",
                          question.correct_answer_indexes.includes(index)
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                            : "border-white/8 bg-white/5 text-slate-300",
                        )}
                      >
                        {answer}
                      </div>
                    ))}
                  </div>

                  {question.explanation ? (
                    <p className="mt-4 text-sm text-slate-400">{question.explanation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(categoryDialog)}
        title={categoryDialog?.mode === "edit" ? "Edit category" : "Create category"}
        description="Categories organize the quiz pool that hosts can choose from before a duel starts."
        onClose={() => setCategoryDialog(null)}
      >
        <form className="space-y-4" onSubmit={handleCategorySubmit}>
          <label className="block text-sm text-slate-200">
            <span className="mb-2 block">Name</span>
            <Input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm text-slate-200">
            <span className="mb-2 block">Description</span>
            <Textarea
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCategoryDialog(null)}>
              Cancel
            </Button>
            <Button type="submit">{categoryDialog?.mode === "edit" ? "Save changes" : "Create"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(questionDialog)}
        title={questionDialog?.mode === "edit" ? "Edit question" : "Create question"}
        description="Every question needs exactly 3 answers and 1 or 2 correct choices."
        onClose={() => setQuestionDialog(null)}
      >
        <form className="space-y-4" onSubmit={handleQuestionSubmit}>
          <label className="block text-sm text-slate-200">
            <span className="mb-2 block">Category</span>
            <select
              className="h-11 w-full rounded-2xl border border-white/12 bg-slate-950/60 px-4 text-sm text-white outline-none"
              value={questionForm.categoryId}
              onChange={(event) =>
                setQuestionForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">Select a category</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-200">
            <span className="mb-2 block">Question</span>
            <Textarea
              className="min-h-24"
              value={questionForm.prompt}
              onChange={(event) =>
                setQuestionForm((current) => ({ ...current, prompt: event.target.value }))
              }
            />
          </label>

          <div className="grid gap-3">
            {questionForm.answers.map((answer, index) => (
              <label key={`answer-${index}`} className="block text-sm text-slate-200">
                <span className="mb-2 flex items-center justify-between">
                  <span>Answer {index + 1}</span>
                  <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <input
                      checked={questionForm.correctAnswerIndexes.includes(index)}
                      type="checkbox"
                      onChange={(event) => {
                        setQuestionForm((current) => {
                          const nextIndexes = event.target.checked
                            ? [...current.correctAnswerIndexes, index]
                            : current.correctAnswerIndexes.filter((item) => item !== index);

                          return {
                            ...current,
                            correctAnswerIndexes: nextIndexes,
                          };
                        });
                      }}
                    />
                    Correct
                  </span>
                </span>
                <Input
                  value={answer}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      answers: current.answers.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-200">
              <span className="mb-2 block">Difficulty</span>
              <select
                className="h-11 w-full rounded-2xl border border-white/12 bg-slate-950/60 px-4 text-sm text-white outline-none"
                value={questionForm.difficulty}
                onChange={(event) =>
                  setQuestionForm((current) => ({
                    ...current,
                    difficulty: event.target.value as QuestionDifficulty,
                  }))
                }
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-200">
              <span className="mb-2 block">Explanation</span>
              <Textarea
                className="min-h-24"
                value={questionForm.explanation}
                onChange={(event) =>
                  setQuestionForm((current) => ({ ...current, explanation: event.target.value }))
                }
              />
            </label>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setQuestionDialog(null)}>
              Cancel
            </Button>
            <Button type="submit">{questionDialog?.mode === "edit" ? "Save changes" : "Create"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
