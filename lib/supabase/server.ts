import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const env = getServerEnv();

    adminClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return adminClient;
}
