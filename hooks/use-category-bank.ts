"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { requestJson } from "@/lib/fetcher";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CategoryWithQuestions } from "@/types/app";

type CategoryBankResponse = {
  categories: CategoryWithQuestions[];
};

export function useCategoryBank() {
  const [categories, setCategories] = useState<CategoryWithQuestions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadCategories = useCallback(async () => {
    try {
      setError(null);
      const payload = await requestJson<CategoryBankResponse>("/api/categories");
      startTransition(() => {
        setCategories(payload.categories);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }, [startTransition]);

  useEffect(() => {
    void loadCategories();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("category-bank")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        void loadCategories();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => {
        void loadCategories();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCategories]);

  return {
    categories,
    loading,
    refreshing: isPending,
    error,
    refresh: loadCategories,
    setCategories,
  };
}
