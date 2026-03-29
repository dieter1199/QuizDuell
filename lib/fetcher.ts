"use client";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function requestJson<T>(url: string, options: RequestOptions = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers:
      options.body !== undefined
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}
