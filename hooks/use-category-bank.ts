"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { requestJson } from "@/lib/fetcher";
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
