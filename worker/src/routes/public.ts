import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "../env";
import { apiError } from "../errors";

/**
 * Public routes, reachable without login. In Cloudflare Access these paths get a
 * separate application with a Bypass policy (see docs/setup-cloudflare.md).
 * They are called from the public site on GitHub Pages, so CORS is allowed for
 * that one origin only, without credentials.
 */
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.use("*", async (c, next) => {
  const middleware = cors({
    origin: c.env.PUBLIC_SITE_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: false,
    maxAge: 86400,
  });
  return middleware(c, next);
});

publicRoutes.get("/health", (c) => c.json({ status: "ok", version: c.env.APP_VERSION }));

// Phase 3: verification of a QSL card by its HMAC code.
publicRoutes.get("/verify/:code", (c) =>
  apiError(c, 501, "not_implemented", "Verification is available from phase 3"),
);

// Phase 6: unsubscribe from QSL mail.
publicRoutes.post("/unsubscribe/:token", (c) =>
  apiError(c, 501, "not_implemented", "Unsubscribe is available from phase 6"),
);
