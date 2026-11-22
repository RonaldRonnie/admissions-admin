import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { errorsFor, isUpperCode, isWholeNumber, type FieldSpec } from "../components/FormModal";
import { csvCell, toCsv } from "./csv";
import { deleteOrExplain } from "./useAction";

describe("csv", () => {
  it("quotes cells holding commas, quotes or line breaks", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", then')).toBe('"say ""hi"", then"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("defuses cells a spreadsheet would run as formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+256700000000")).toBe("'+256700000000");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("writes a header row and one line per row", () => {
    const text = toCsv([{ a: 1, b: "x,y" }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(text).toBe('A,B\r\n1,"x,y"\r\n');
  });
});

describe("form validation", () => {
  const fields: FieldSpec[] = [
    { name: "code", label: "Code", required: true, validate: isUpperCode },
    { name: "years", label: "Years", type: "number", validate: isWholeNumber(1, 8) },
    { name: "locked", label: "Locked", required: true, disabled: true },
    { name: "active", label: "Active", type: "checkbox" },
  ];

  it("reports required, pattern and range errors, skipping disabled fields and checkboxes", () => {
    expect(errorsFor(fields, { code: "", years: "", locked: "", active: false })).toEqual({ code: "Required." });
    expect(errorsFor(fields, { code: "sos", years: "9", locked: "", active: true })).toEqual({
      code: "Uppercase letters and digits only, e.g. SOS.",
      years: "A whole number from 1 to 8.",
    });
    expect(errorsFor(fields, { code: "SOS1", years: "4" })).toEqual({});
  });
});

describe("deleteOrExplain", () => {
  it("turns the backend's 409 'Duplicate entry' for a referenced row into an in-use message", async () => {
    await expect(deleteOrExplain(() => Promise.reject(new ApiError(409, "Duplicate entry")), "Computing")).rejects.toThrow(
      "Computing is still in use",
    );
  });

  it("passes other errors and successes through", async () => {
    await expect(deleteOrExplain(() => Promise.reject(new ApiError(403, "Nope")), "X")).rejects.toThrow("Nope");
    await expect(deleteOrExplain(() => Promise.resolve(7), "X")).resolves.toBe(7);
  });
});
