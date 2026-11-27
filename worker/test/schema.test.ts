import { describe, expect, it } from "vitest";
import { resetDb, testEnv } from "./helpers";

const OWNED_TABLES = [
  "stations",
  "qsl_templates",
  "activations",
  "log_files",
  "qsos",
  "contacts",
  "qsl_cards",
  "photos",
  "social_posts",
  "mail_jobs",
  "mail_messages",
];

describe("D1 schema", () => {
  it("has owner_id on every user-owned table", async () => {
    const db = testEnv().DB;
    for (const table of OWNED_TABLES) {
      const cols = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      expect(
        cols.results.map((c) => c.name),
        table,
      ).toContain("owner_id");
    }
  });

  it("seeds the five v1 programs", async () => {
    const rows = await testEnv()
      .DB.prepare("SELECT code FROM programs ORDER BY code")
      .all<{ code: string }>();
    expect(rows.results.map((r) => r.code)).toEqual(["BOTA", "COTA", "POTA", "SOTA", "WWFF"]);
  });

  it("validates reference formats with the seeded regexes", async () => {
    const rows = await testEnv()
      .DB.prepare("SELECT code, ref_regex FROM programs WHERE ref_regex IS NOT NULL")
      .all<{ code: string; ref_regex: string }>();
    const re = Object.fromEntries(rows.results.map((r) => [r.code, new RegExp(r.ref_regex)]));
    expect(re.POTA?.test("BE-0001")).toBe(true);
    expect(re.WWFF?.test("ONFF-0599")).toBe(true);
    expect(re.SOTA?.test("ON/ON-001")).toBe(true);
    expect(re.WWFF?.test("ONFF-59")).toBe(false);
  });

  it("rejects a third photo position", async () => {
    const db = testEnv().DB;
    await resetDb();
    await db
      .prepare(
        "INSERT INTO users (id, call, email, role) VALUES ('u1','ON0TEST','owner@example.com','owner')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO activations (id, owner_id, start_utc) VALUES ('a1','u1','2026-11-27T09:00:00Z')",
      )
      .run();
    await expect(
      db
        .prepare(
          "INSERT INTO photos (id, owner_id, activation_id, position, r2_key) VALUES ('p3','u1','a1',3,'k')",
        )
        .run(),
    ).rejects.toThrow();
  });

  it("treats the same QSO twice as a duplicate key", async () => {
    const db = testEnv().DB;
    await resetDb();
    await db
      .prepare(
        "INSERT INTO users (id, call, email, role) VALUES ('u1','ON0TEST','owner@example.com','owner')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO activations (id, owner_id, start_utc) VALUES ('a1','u1','2026-11-27T09:00:00Z')",
      )
      .run();
    const insert = (id: string, call: string) =>
      db
        .prepare(
          "INSERT INTO qsos (id, owner_id, activation_id, call, qso_utc, band, mode) VALUES (?1,'u1','a1',?2,'2026-11-27T09:15:00Z','40m','CW')",
        )
        .bind(id, call)
        .run();
    await insert("q1", "DL0XXX");
    await expect(insert("q2", "dl0xxx")).rejects.toThrow();
  });
});
