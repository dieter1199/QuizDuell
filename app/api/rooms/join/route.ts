import { joinRoom } from "@/lib/server/room-service";
import { handleApiError, jsonOk } from "@/lib/server/api";
import { joinRoomSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = joinRoomSchema.parse(body);
    const snapshot = await joinRoom(input.roomCode, input.displayName, input.playerToken);
    return jsonOk({ snapshot });
  } catch (error) {
    return handleApiError(error);
  }
}
