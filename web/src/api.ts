import type { ApiError, MeResponse } from "@qslforge/shared";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

async function getJson<T>(path: string): Promise<T> {
  // Same origin as the app: the Access cookie is sent automatically.
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, body);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => getJson<MeResponse>("/api/me"),
};

/** Cloudflare Access logout endpoint on the same hostname. */
export const LOGOUT_URL = "/cdn-cgi/access/logout";
