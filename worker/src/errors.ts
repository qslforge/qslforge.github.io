import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError } from "@qslforge/shared";

export function apiError(c: Context, status: ContentfulStatusCode, error: string, message: string) {
  const body: ApiError = { error, message };
  return c.json(body, status);
}
