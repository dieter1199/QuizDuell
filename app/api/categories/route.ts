import { categorySchema } from "@/lib/validation";
import { createCategory, getCategoryBank } from "@/lib/server/content-service";
import { handleApiError, jsonOk } from "@/lib/server/api";

export async function GET() {
  try {
    const categories = await getCategoryBank();
    return jsonOk({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = categorySchema.parse(body);
    const categories = await createCategory(input);
    return jsonOk({ categories }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
