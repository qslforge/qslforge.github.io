import { Hono } from "hono";
import type { AppEnv } from "./env";
import type { AuthOptions } from "./auth";
import { apiRoutes } from "./routes/api";
import { publicRoutes } from "./routes/public";
import { apiError } from "./errors";

export function createApp(authOptions: AuthOptions = {}) {
  const app = new Hono<AppEnv>();

  // Security headers on every API response.
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
  });

  // Public routes first: they must never pass through requireAuth.
  app.route("/api/public", publicRoutes);
  app.route("/api", apiRoutes(authOptions));

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return apiError(c, 404, "not_found", c.req.path);
    // Non-API paths are served from static assets.
    return c.env.ASSETS.fetch(c.req.raw);
  });

  app.onError((err, c) => {
    console.error(err);
    return apiError(c, 500, "internal_error", "Unexpected error");
  });

  return app;
}
