import { duplicateQuestion } from "@/lib/server/content-service";
import { handleApiError, jsonOk } from "@/lib/server/api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const categories = await duplicateQuestion(id);
    return jsonOk({ categories }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
