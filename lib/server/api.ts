import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function jsonOk(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    console.warn("[api] validation failed", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });

    const playerTokenIssue = error.issues.find((issue) => issue.path.at(-1) === "playerToken");
    const message =
      playerTokenIssue?.message
        ? "Your local player session is missing. Refresh the page and set your display name again."
        : error.issues[0]?.message ?? "Invalid request.";
    return Response.json({ error: message }, { status: 400 });
  }

  console.error(error);

  return Response.json({ error: "Something went wrong on the server." }, { status: 500 });
}
