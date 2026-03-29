import { advanceGame, submitAnswer } from "@/lib/server/room-service";
import { handleApiError, jsonOk } from "@/lib/server/api";
import { gameActionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    gameId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { gameId } = await context.params;
    const body = await request.json();
    const action = gameActionSchema.parse(body);

    switch (action.action) {
      case "submitAnswer": {
        const snapshot = await submitAnswer(gameId, action.playerToken, action.selectedIndexes);
        return jsonOk({ snapshot });
      }
      case "advance": {
        const snapshot = await advanceGame(gameId, action.playerToken);
        return jsonOk({ snapshot });
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}
