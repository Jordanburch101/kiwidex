import { describe, expect, it } from "bun:test";
import { slugifyHeadline } from "../slugify";

describe("slugifyHeadline", () => {
  it("converts headline to slug with month-year", () => {
    const result = slugifyHeadline(
      "RBNZ Holds OCR at 3.5%",
      new Date("2026-04-02")
    );
    expect(result).toBe("rbnz-holds-ocr-at-35-apr-2026");
  });

  it("strips special characters", () => {
    const result = slugifyHeadline(
      "What's Next? A $500M Question",
      new Date("2026-04-02")
    );
    expect(result).toBe("whats-next-a-500m-question-apr-2026");
  });

  it("collapses multiple hyphens", () => {
    const result = slugifyHeadline(
      "Petrol --- Prices --- Drop!",
      new Date("2026-04-02")
    );
    expect(result).toBe("petrol-prices-drop-apr-2026");
  });

  it("truncates long headlines", () => {
    const longHeadline =
      "This Is A Very Long Headline That Goes On And On And On And Should Be Truncated At Some Point";
    const result = slugifyHeadline(longHeadline, new Date("2026-04-02"));
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toEndWith("-apr-2026");
  });
});
