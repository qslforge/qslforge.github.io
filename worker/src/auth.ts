import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { createMiddleware } from "hono/factory";
import type { AppEnv, AuthUser, Env } from "./env";
import { audit } from "./audit";
import { apiError } from "./errors";

/** Header that Cloudflare Access adds to every request it lets through. */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export interface AuthOptions {
  /** Override the key source (tests). Defaults to the Access team JWKS. */
  getKey?: (env: Env) => JWTVerifyGetKey;
}

/**
 * Verifies the Cloudflare Access JWT and returns the authenticated e-mail address.
 * Throws when the token is missing or invalid. Never trusts the frontend.
 */
export async function verifyAccessEmail(
  request: Request,
  env: Env,
  getKey: (env: Env) => JWTVerifyGetKey,
): Promise<string> {
  if (env.DEV_AUTH_EMAIL) {
    if (env.ENVIRONMENT !== "development") {
      // Fail closed: a dev bypass must never be active in production.
      console.error("DEV_AUTH_EMAIL is set outside development; refusing all requests");
      throw new AuthError("misconfigured");
    }
    return env.DEV_AUTH_EMAIL.toLowerCase();
  }

  const token = request.headers.get(ACCESS_JWT_HEADER);
  if (!token) throw new AuthError("missing_token");

  try {
    const { payload } = await jwtVerify(token, getKey(env), {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email) throw new AuthError("no_email");
    return email.toLowerCase();
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("invalid_token");
  }
}

export class AuthError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

interface UserRow {
  id: string;
  call: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
  disabled_at: string | null;
}

/**
 * Looks up the user for a verified e-mail address. Access is the first gate,
 * the users table is the second: an address that passes Access but is not a
 * registered user gets 403. The very first login with OWNER_EMAIL creates the
 * owner account (bootstrap), but only while no owner exists.
 */
export async function resolveUser(
  env: Env,
  email: string,
  ip: string | null,
): Promise<AuthUser | null> {
  const row = await env.DB.prepare(
    "SELECT id, call, name, email, role, disabled_at FROM users WHERE lower(email) = ?1",
  )
    .bind(email)
    .first<UserRow>();

  if (row) {
    if (row.disabled_at) return null;
    return { id: row.id, call: row.call, name: row.name, email: row.email, role: row.role };
  }

  if (email !== env.OWNER_EMAIL.toLowerCase()) return null;

  const owner = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'owner' LIMIT 1").first();
  if (owner) return null;

  const id = crypto.randomUUID();
  const call = env.OWNER_CALL.toUpperCase();
  await env.DB.prepare(
    "INSERT INTO users (id, call, email, role) VALUES (?1, ?2, ?3, 'owner') ON CONFLICT DO NOTHING",
  )
    .bind(id, call, email)
    .run();

  // Re-read: a concurrent first login may have won the insert.
  const created = await env.DB.prepare(
    "SELECT id, call, name, email, role, disabled_at FROM users WHERE lower(email) = ?1",
  )
    .bind(email)
    .first<UserRow>();
  if (!created || created.role !== "owner") return null;

  if (created.id === id) {
    await audit(env, {
      userId: id,
      action: "user.bootstrap",
      objectType: "user",
      objectId: id,
      ip,
    });
  }
  return {
    id: created.id,
    call: created.call,
    name: created.name,
    email: created.email,
    role: created.role,
  };
}

export function requireAuth(options: AuthOptions = {}) {
  const getKey = options.getKey ?? ((env: Env) => remoteJwks(env.ACCESS_TEAM_DOMAIN));
  return createMiddleware<AppEnv>(async (c, next) => {
    let email: string;
    try {
      email = await verifyAccessEmail(c.req.raw, c.env, getKey);
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "invalid_token";
      return apiError(c, 401, "unauthorized", code);
    }

    const user = await resolveUser(c.env, email, c.req.header("CF-Connecting-IP") ?? null);
    if (!user) return apiError(c, 403, "forbidden", "not_registered");

    c.set("user", user);
    await next();
  });
}
