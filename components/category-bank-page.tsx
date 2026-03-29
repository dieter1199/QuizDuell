"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CategoryManager } from "@/components/category-manager";
import { Card } from "@/components/ui/card";
import { useCategoryBank } from "@/hooks/use-category-bank";
import { requestJson } from "@/lib/fetcher";
import type { CategoryWithQuestions, QuestionInput } from "@/types/app";

type CategoryBankResponse = {
  categories: CategoryWithQuestions[];
};

export function CategoryBankPage() {
  const { categories, loading, error, setCategories } = useCategoryBank();

  const updateCategories = async (request: Promise<CategoryBankResponse>) => {
    const payload = await request;
    setCategories(payload.categories);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#10213a_0%,#09111f_50%,#04070f_100%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Question bank</p>
            <h1 className="mt-2 text-4xl font-semibold">Manage categories</h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-medium text-white transition hover:bg-white/12"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back home
          </Link>
        </div>

        {loading ? <Card>Loading categories...</Card> : null}
        {error ? <Card className="border-rose-400/20 bg-rose-500/10">{error}</Card> : null}

        {!loading ? (
          <CategoryManager
            categories={categories}
            editable
            onCreateCategory={(input) =>
              updateCategories(
                requestJson("/api/categories", {
                  method: "POST",
                  body: input,
                }),
              )
            }
            onUpdateCategory={(id, input) =>
              updateCategories(
                requestJson(`/api/categories/${id}`, {
                  method: "PATCH",
                  body: input,
                }),
              )
            }
            onDeleteCategory={(id) =>
              updateCategories(
                requestJson(`/api/categories/${id}`, {
                  method: "DELETE",
                }),
              )
            }
            onCreateQuestion={(input: QuestionInput) =>
              updateCategories(
                requestJson("/api/questions", {
                  method: "POST",
                  body: input,
                }),
              )
            }
            onUpdateQuestion={(id, input) =>
              updateCategories(
                requestJson(`/api/questions/${id}`, {
                  method: "PATCH",
                  body: input,
                }),
              )
            }
            onDeleteQuestion={(id) =>
              updateCategories(
                requestJson(`/api/questions/${id}`, {
                  method: "DELETE",
                }),
              )
            }
            onDuplicateQuestion={(id) =>
              updateCategories(
                requestJson(`/api/questions/${id}/duplicate`, {
                  method: "POST",
                }),
              )
            }
          />
        ) : null}
      </div>
    </main>
  );
}
