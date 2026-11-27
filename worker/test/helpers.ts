import { env } from "cloudflare:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { createApp } from "../src/app";
import type { Env } from "../src/env";

export const TEAM = "https://test-team.cloudflareaccess.com";
export const AUD = "test-aud";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256" };
const localJwks = createLocalJWKSet({ keys: [jwk] });

/** App wired to a local test key instead of the real Access JWKS. */
export const app = createApp({ getKey: () => localJwks });

export function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...(env as unknown as Env), ...overrides };
}

export async function signToken(
  claims: { email?: string; iss?: string; aud?: string; expSeconds?: number } = {},
  key: CryptoKey = privateKey,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(claims.email === undefined ? {} : { email: claims.email })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(claims.iss ?? TEAM)
    .setAudience(claims.aud ?? AUD)
    .setIssuedAt(now)
    .setExpirationTime(now + (claims.expSeconds ?? 300));
  return jwt.sign(key);
}

export async function otherPrivateKey(): Promise<CryptoKey> {
  return (await generateKeyPair("RS256")).privateKey;
}

export function authHeaders(token: string): HeadersInit {
  return { "Cf-Access-Jwt-Assertion": token, "CF-Connecting-IP": "203.0.113.7" };
}

/** Deletes all user data in foreign-key order; programs (config) stay. */
export async function resetDb(): Promise<void> {
  const db = testEnv().DB;
  for (const table of [
    "audit_log",
    "mail_messages",
    "mail_jobs",
    "social_posts",
    "photos",
    "qsl_cards",
    "qsos",
    "log_files",
    "activation_refs",
    "activations",
    "qsl_templates",
    "contacts",
    "suppressions",
    "stations",
    "users",
  ]) {
    await db.prepare(`DELETE FROM ${table}`).run();
  }
}
