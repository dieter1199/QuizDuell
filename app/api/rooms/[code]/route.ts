import { getRoomSnapshot } from "@/lib/server/room-service";
import { handleApiError, jsonOk } from "@/lib/server/api";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const url = new URL(request.url);
    const playerToken = url.searchParams.get("playerToken") ?? undefined;
    const snapshot = await getRoomSnapshot(code, playerToken);
    return jsonOk({ snapshot });
  } catch (error) {
    return handleApiError(error);
  }
}
