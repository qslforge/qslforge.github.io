import { Hono } from "hono";
import type { HealthResponse, MeResponse } from "@qslforge/shared";
import type { AppEnv } from "../env";
import { requireAuth, type AuthOptions } from "../auth";

export function apiRoutes(authOptions: AuthOptions = {}) {
  const api = new Hono<AppEnv>();
  const auth = requireAuth(authOptions);
  api.use("*", async (c, next) => {
    // /api/public/* is handled by publicRoutes and must stay reachable without login.
    if (c.req.path.startsWith("/api/public/")) return next();
    return auth(c, next);
  });

  api.get("/health", async (c) => {
    let db: HealthResponse["db"] = "ok";
    try {
      await c.env.DB.prepare("SELECT 1").first();
    } catch {
      db = "error";
    }
    const body: HealthResponse = { status: "ok", version: c.env.APP_VERSION, db };
    return c.json(body);
  });

  api.get("/me", (c) => {
    const u = c.get("user");
    const body: MeResponse = { id: u.id, call: u.call, name: u.name, email: u.email, role: u.role };
    return c.json(body);
  });

  return api;
}
