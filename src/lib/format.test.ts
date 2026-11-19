import { describe, expect, it } from "vitest";
import { generatePassword, PASSWORD_RULE, PHONE_RULE, toDate } from "./format";

describe("toDate", () => {
  it("reads Jackson's ISO string and array forms alike", () => {
    expect(toDate("2026-10-31T15:52:07.150")?.getFullYear()).toBe(2026);
    expect(toDate([2026, 10, 31, 15, 52, 7])?.getMonth()).toBe(9);
    expect(toDate(null)).toBeNull();
    expect(toDate("not a date")).toBeNull();
  });
});

describe("generatePassword", () => {
  it("always satisfies the backend password rule", () => {
    for (let i = 0; i < 200; i++) expect(generatePassword()).toMatch(PASSWORD_RULE);
  });
});

describe("PHONE_RULE", () => {
  it("matches the backend's @ValidPhoneNumber", () => {
    expect(PHONE_RULE.test("")).toBe(true);
    expect(PHONE_RULE.test("+256701234567")).toBe(true);
    expect(PHONE_RULE.test("0701234567")).toBe(false);
    expect(PHONE_RULE.test("+256 70 123")).toBe(false);
  });
});
