import { questionSchema } from "@/lib/validation";
import { createQuestion } from "@/lib/server/content-service";
import { handleApiError, jsonOk } from "@/lib/server/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = questionSchema.parse(body);
    const categories = await createQuestion(input);
    return jsonOk({ categories }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
