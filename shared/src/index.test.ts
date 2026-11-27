import { describe, expect, it } from "vitest";
import { PROGRAM_CODES } from "./index";

describe("shared constants", () => {
  it("contains the v1 programs", () => {
    expect(PROGRAM_CODES).toEqual(["POTA", "WWFF", "SOTA", "BOTA", "COTA"]);
  });
});
