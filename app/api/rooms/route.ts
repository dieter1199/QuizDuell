import { createRoom } from "@/lib/server/room-service";
import { handleApiError, jsonOk } from "@/lib/server/api";
import { createRoomSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createRoomSchema.parse(body);
    const room = await createRoom(input.displayName, input.playerToken);
    return jsonOk(room, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
