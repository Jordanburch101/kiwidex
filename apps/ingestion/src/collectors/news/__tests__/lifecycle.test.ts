import { describe, expect, it } from "bun:test";
import {
  categorizeArticle,
  computeWordSimilarity,
  findStoriesToClose,
} from "../lifecycle";

describe("findStoriesToClose", () => {
  it("marks stories as expired after 5 days silence", () => {
    const stories = [
      {
        id: "old",
        updatedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        summaryCount: 1,
      },
      { id: "recent", updatedAt: new Date().toISOString(), summaryCount: 1 },
    ];
    const toClose = findStoriesToClose(stories);
    expect(toClose).toHaveLength(1);
    expect(toClose[0]!.id).toBe("old");
    expect(toClose[0]!.reason).toBe("expired");
  });

  it("marks stories as cap_reached at 5 summaries", () => {
    const stories = [
      { id: "capped", updatedAt: new Date().toISOString(), summaryCount: 5 },
    ];
    const toClose = findStoriesToClose(stories);
    expect(toClose).toHaveLength(1);
    expect(toClose[0]!.id).toBe("capped");
    expect(toClose[0]!.reason).toBe("cap_reached");
  });

  it("does not close recent stories under cap", () => {
    const stories = [
      { id: "active", updatedAt: new Date().toISOString(), summaryCount: 2 },
    ];
    expect(findStoriesToClose(stories)).toHaveLength(0);
  });

  it("cap_reached takes priority over expired", () => {
    const stories = [
      {
        id: "both",
        updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        summaryCount: 5,
      },
    ];
    const toClose = findStoriesToClose(stories);
    expect(toClose[0]!.reason).toBe("cap_reached");
  });
});

describe("computeWordSimilarity", () => {
  it("finds shared significant words", () => {
    const score = computeWordSimilarity(
      "RBNZ holds OCR at 3.5 percent",
      "Reserve Bank keeps OCR unchanged"
    );
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 for unrelated texts", () => {
    const score = computeWordSimilarity(
      "Petrol prices drop to 6-month low",
      "Auckland housing market cools down"
    );
    expect(score).toBe(0);
  });

  it("ignores stop words", () => {
    const score = computeWordSimilarity(
      "the and is are for with",
      "the and is are for with"
    );
    expect(score).toBe(0);
  });
});

describe("categorizeArticle", () => {
  it("returns NO_CANDIDATES when no open stories", () => {
    const result = categorizeArticle(
      { title: "Test article", content: null, tags: ["fuel"] },
      []
    );
    expect(result.category).toBe("NO_CANDIDATES");
  });

  it("returns NO_CANDIDATES when no overlap", () => {
    const result = categorizeArticle(
      { title: "Banana prices surge", content: null, tags: ["groceries"] },
      [
        {
          id: "ocr-story",
          headline: "RBNZ Holds OCR Unchanged",
          tags: ["interest-rates"],
        },
      ]
    );
    expect(result.category).toBe("NO_CANDIDATES");
  });

  it("returns HIGH_CONFIDENCE when strong word overlap", () => {
    const result = categorizeArticle(
      {
        title: "RBNZ holds OCR unchanged amid global uncertainty",
        content: "Reserve Bank OCR decision holds rates steady",
        tags: ["interest-rates"],
      },
      [
        {
          id: "ocr-story",
          headline: "RBNZ Holds OCR at 3.5% Amid Global Uncertainty",
          tags: ["interest-rates"],
        },
      ]
    );
    expect(result.category).toBe("HIGH_CONFIDENCE");
    if (result.category === "HIGH_CONFIDENCE") {
      expect(result.matchedStoryId).toBe("ocr-story");
    }
  });

  it("returns AMBIGUOUS when moderate overlap with multiple candidates", () => {
    const result = categorizeArticle(
      {
        title: "Fuel prices continue to climb",
        content: "Petrol costs rising",
        tags: ["fuel"],
      },
      [
        {
          id: "fuel-crisis",
          headline: "NZ Fuel Crisis Deepens",
          tags: ["fuel"],
        },
        {
          id: "fuel-tax",
          headline: "Government Fuel Tax Review",
          tags: ["fuel", "government"],
        },
      ]
    );
    expect(result.category).toBe("AMBIGUOUS");
    if (result.category === "AMBIGUOUS") {
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    }
  });
});
