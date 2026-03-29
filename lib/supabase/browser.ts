"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = getPublicEnv();

    browserClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return browserClient;
}
