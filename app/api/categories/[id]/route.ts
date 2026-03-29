import { categorySchema } from "@/lib/validation";
import { deleteCategory, updateCategory } from "@/lib/server/content-service";
import { handleApiError, jsonOk } from "@/lib/server/api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = categorySchema.parse(body);
    const categories = await updateCategory(id, input);
    return jsonOk({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const categories = await deleteCategory(id);
    return jsonOk({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}
