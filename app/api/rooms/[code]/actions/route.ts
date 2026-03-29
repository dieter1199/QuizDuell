import {
  kickPlayer,
  leaveRoom,
  replayRoom,
  startGame,
  updateHeartbeat,
  updateRoomSettings,
} from "@/lib/server/room-service";
import { handleApiError, jsonOk } from "@/lib/server/api";
import { roomActionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code } = await context.params;
    const body = await request.json();
    const action = roomActionSchema.parse(body);

    switch (action.action) {
      case "heartbeat": {
        const snapshot = await updateHeartbeat(code, action.playerToken);
        return jsonOk({ snapshot });
      }
      case "leave": {
        await leaveRoom(code, action.playerToken);
        return jsonOk({ ok: true });
      }
      case "kick": {
        const snapshot = await kickPlayer(code, action.actorToken, action.playerId);
        return jsonOk({ snapshot });
      }
      case "updateSettings": {
        const snapshot = await updateRoomSettings(code, action.actorToken, action.settings);
        return jsonOk({ snapshot });
      }
      case "startGame": {
        const snapshot = await startGame(code, action.actorToken);
        return jsonOk({ snapshot });
      }
      case "replay": {
        const snapshot = await replayRoom(code, action.actorToken);
        return jsonOk({ snapshot });
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}
