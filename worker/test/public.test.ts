import { describe, expect, it } from "vitest";
import { app, testEnv } from "./helpers";

describe("public routes", () => {
  it("serves /api/public/health without login", async () => {
    const res = await app.request("/api/public/health", {}, testEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("allows CORS only for the public site origin, without credentials", async () => {
    const ok = await app.request(
      "/api/public/health",
      { headers: { Origin: "https://qslforge.github.io" } },
      testEnv(),
    );
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://qslforge.github.io");
    expect(ok.headers.get("Access-Control-Allow-Credentials")).toBeNull();

    const other = await app.request(
      "/api/public/health",
      { headers: { Origin: "https://evil.example.com" } },
      testEnv(),
    );
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers the preflight for the public site", async () => {
    const res = await app.request(
      "/api/public/unsubscribe/abc",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://qslforge.github.io",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      },
      testEnv(),
    );
    expect(res.status).toBe(204);
  });

  it("has placeholders for verify and unsubscribe", async () => {
    expect((await app.request("/api/public/verify/ABCDEF123456", {}, testEnv())).status).toBe(501);
    expect(
      (await app.request("/api/public/unsubscribe/tok", { method: "POST" }, testEnv())).status,
    ).toBe(501);
  });

  it("does not expose the user list or anything else under /api/public", async () => {
    const res = await app.request("/api/public/me", {}, testEnv());
    expect([401, 404]).toContain(res.status);
  });
});
