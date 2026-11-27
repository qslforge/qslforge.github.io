import { beforeEach, describe, expect, it } from "vitest";
import type { MeResponse } from "@qslforge/shared";
import { app, authHeaders, otherPrivateKey, resetDb, signToken, testEnv } from "./helpers";

describe("Access JWT authentication", () => {
  beforeEach(resetDb);

  it("rejects requests without a token", async () => {
    const res = await app.request("/api/me", {}, testEnv());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized", message: "missing_token" });
  });

  it("rejects a token signed with another key", async () => {
    const token = await signToken({ email: "owner@example.com" }, await otherPrivateKey());
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(401);
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await signToken({ email: "owner@example.com", aud: "other-app" });
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(401);
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await signToken({
      email: "owner@example.com",
      iss: "https://evil.cloudflareaccess.com",
    });
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ email: "owner@example.com", expSeconds: -60 });
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(401);
  });

  it("bootstraps the owner on first login and audits it", async () => {
    const token = await signToken({ email: "Owner@Example.com" });
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(200);
    const me = (await res.json()) as MeResponse;
    expect(me).toMatchObject({ call: "ON0TEST", email: "owner@example.com", role: "owner" });

    const audit = await testEnv()
      .DB.prepare("SELECT action, ip_hash FROM audit_log")
      .all<{ action: string; ip_hash: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]?.action).toBe("user.bootstrap");
    expect(audit.results[0]?.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit.results[0]?.ip_hash).not.toContain("203.0.113.7");
  });

  it("does not create a second owner", async () => {
    const t1 = await signToken({ email: "owner@example.com" });
    await app.request("/api/me", { headers: authHeaders(t1) }, testEnv());
    const res = await app.request("/api/me", { headers: authHeaders(t1) }, testEnv());
    expect(res.status).toBe(200);
    const count = await testEnv()
      .DB.prepare("SELECT count(*) AS n FROM users")
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("refuses an address that passed Access but is not registered", async () => {
    const token = await signToken({ email: "stranger@example.com" });
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(403);
  });

  it("refuses a disabled user", async () => {
    const token = await signToken({ email: "owner@example.com" });
    await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    await testEnv().DB.prepare("UPDATE users SET disabled_at = '2026-11-27T00:00:00Z'").run();
    const res = await app.request("/api/me", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(403);
  });

  it("refuses all requests when the dev bypass is set in production", async () => {
    const res = await app.request(
      "/api/me",
      {},
      testEnv({ DEV_AUTH_EMAIL: "owner@example.com", ENVIRONMENT: "production" }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ message: "misconfigured" });
  });

  it("allows the dev bypass in development", async () => {
    const res = await app.request(
      "/api/me",
      {},
      testEnv({ DEV_AUTH_EMAIL: "owner@example.com", ENVIRONMENT: "development" }),
    );
    expect(res.status).toBe(200);
  });

  it("answers /api/health with database status when logged in", async () => {
    const token = await signToken({ email: "owner@example.com" });
    const res = await app.request("/api/health", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns JSON 404 for unknown API routes after auth", async () => {
    const token = await signToken({ email: "owner@example.com" });
    const res = await app.request("/api/nope", { headers: authHeaders(token) }, testEnv());
    expect(res.status).toBe(404);
  });
});
