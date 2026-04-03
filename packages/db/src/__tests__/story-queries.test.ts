import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  closeStory,
  deleteOldArticles,
  deleteOrphanedStories,
  getArticlesByStoryId,
  getChildStory,
  getOpenStories,
  getStories,
  getStorySummaries,
  getStorySummaryCount,
  getStoryBySlug,
  insertArticles,
  insertStorySummary,
  updateStoryEnrichment,
  upsertStory,
} from "../queries";
import * as schema from "../schema";

// Use a temp file DB (same pattern as existing tests) — libSQL in-memory mode
// creates separate connections per operation, breaking transactions.
const tmpDir = mkdtempSync(join(tmpdir(), "nz-ecom-story-test-"));
const dbPath = join(tmpDir, "test.db");

function createTestDb() {
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

describe("story query helpers", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeAll(async () => {
    testDb = createTestDb();

    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        headline TEXT NOT NULL,
        summary TEXT,
        tags TEXT NOT NULL,
        angles TEXT,
        related_metrics TEXT,
        source_count INTEGER NOT NULL,
        image_url TEXT,
        first_reported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        parent_story_id TEXT,
        closed_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS articles (
        url TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        image_url TEXT,
        source TEXT NOT NULL,
        published_at TEXT NOT NULL,
        tags TEXT,
        story_id TEXT,
        content TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS story_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        sources TEXT NOT NULL,
        article_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  });

  beforeEach(async () => {
    await testDb.run(sql`DELETE FROM story_summaries`);
    await testDb.run(sql`DELETE FROM articles`);
    await testDb.run(sql`DELETE FROM stories`);
  });

  afterAll(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // Cleanup is best-effort
    }
  });

  // Helper to build a minimal valid story
  function makeStory(
    overrides: Partial<schema.stories.$inferInsert> = {}
  ): schema.stories.$inferInsert {
    return {
      id: "test-story-slug",
      headline: "Test Story Headline",
      tags: JSON.stringify(["economy", "inflation"]),
      sourceCount: 3,
      firstReportedAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T12:00:00.000Z",
      ...overrides,
    };
  }

  // Helper to build a minimal valid article
  function makeArticle(
    overrides: Partial<schema.articles.$inferInsert> = {}
  ): schema.articles.$inferInsert {
    return {
      url: "https://rnz.co.nz/news/test-article",
      title: "Test Article",
      excerpt: "Test excerpt.",
      source: "rnz",
      publishedAt: "2026-04-01T10:00:00.000Z",
      ...overrides,
    };
  }

  describe("upsertStory", () => {
    test("creates a new story", async () => {
      await upsertStory(testDb, makeStory());
      const rows = await testDb.select().from(schema.stories);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe("test-story-slug");
      expect(rows[0]?.headline).toBe("Test Story Headline");
      expect(rows[0]?.sourceCount).toBe(3);
    });

    test("updates an existing story on conflict", async () => {
      await upsertStory(testDb, makeStory());
      await upsertStory(
        testDb,
        makeStory({
          headline: "Updated Headline",
          sourceCount: 7,
          updatedAt: "2026-04-02T08:00:00.000Z",
        })
      );
      const rows = await testDb.select().from(schema.stories);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.headline).toBe("Updated Headline");
      expect(rows[0]?.sourceCount).toBe(7);
    });

    test("preserves summary and angles through upsert (not overwritten)", async () => {
      await upsertStory(testDb, makeStory());
      // Set enrichment fields manually
      await testDb
        .update(schema.stories)
        .set({ summary: "Rich summary", angles: "Angle A" })
        .where(sql`id = 'test-story-slug'`);

      // Upsert again without enrichment fields — they should survive
      await upsertStory(testDb, makeStory({ headline: "Second update" }));
      const rows = await testDb.select().from(schema.stories);
      expect(rows[0]?.summary).toBe("Rich summary");
      expect(rows[0]?.angles).toBe("Angle A");
    });
  });

  describe("getStories", () => {
    test("returns stories ordered by updatedAt desc", async () => {
      await upsertStory(
        testDb,
        makeStory({ id: "older", updatedAt: "2026-03-20T00:00:00.000Z" })
      );
      await upsertStory(
        testDb,
        makeStory({ id: "newer", updatedAt: "2026-04-01T00:00:00.000Z" })
      );
      const rows = await getStories(testDb, { days: 90 });
      expect(rows[0]?.id).toBe("newer");
      expect(rows[1]?.id).toBe("older");
    });

    test("filters out stories older than days cutoff", async () => {
      await upsertStory(
        testDb,
        makeStory({ id: "recent", updatedAt: "2026-04-01T00:00:00.000Z" })
      );
      await upsertStory(
        testDb,
        makeStory({ id: "ancient", updatedAt: "2020-01-01T00:00:00.000Z" })
      );
      const rows = await getStories(testDb, { days: 7 });
      expect(rows.some((r) => r.id === "ancient")).toBe(false);
    });

    test("filters by tag", async () => {
      await upsertStory(
        testDb,
        makeStory({
          id: "tagged",
          tags: JSON.stringify(["housing", "rents"]),
          updatedAt: "2026-04-01T00:00:00.000Z",
        })
      );
      await upsertStory(
        testDb,
        makeStory({
          id: "untagged",
          tags: JSON.stringify(["economy"]),
          updatedAt: "2026-04-01T00:00:00.000Z",
        })
      );
      const rows = await getStories(testDb, { days: 90, tag: "housing" });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe("tagged");
    });

    test("respects limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await upsertStory(
          testDb,
          makeStory({
            id: `story-${i}`,
            updatedAt: `2026-04-0${i + 1}T00:00:00.000Z`,
          })
        );
      }
      const page1 = await getStories(testDb, { days: 90, limit: 2, offset: 0 });
      const page2 = await getStories(testDb, { days: 90, limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });
  });

  describe("getStoryBySlug", () => {
    test("returns the story for a known slug", async () => {
      await upsertStory(testDb, makeStory({ id: "my-slug" }));
      const result = await getStoryBySlug(testDb, "my-slug");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("my-slug");
    });

    test("returns null for an unknown slug", async () => {
      const result = await getStoryBySlug(testDb, "does-not-exist");
      expect(result).toBeNull();
    });
  });

  describe("getArticlesByStoryId", () => {
    test("returns articles linked to a story, ordered by publishedAt desc", async () => {
      await upsertStory(testDb, makeStory({ id: "story-abc" }));
      await insertArticles(testDb, [
        makeArticle({
          url: "https://rnz.co.nz/1",
          storyId: "story-abc",
          publishedAt: "2026-04-01T09:00:00.000Z",
        }),
        makeArticle({
          url: "https://rnz.co.nz/2",
          storyId: "story-abc",
          publishedAt: "2026-04-01T11:00:00.000Z",
        }),
      ]);
      const rows = await getArticlesByStoryId(testDb, "story-abc");
      expect(rows).toHaveLength(2);
      expect(rows[0]?.url).toBe("https://rnz.co.nz/2");
    });

    test("excludes articles from other stories", async () => {
      await upsertStory(testDb, makeStory({ id: "story-a" }));
      await upsertStory(testDb, makeStory({ id: "story-b" }));
      await insertArticles(testDb, [
        makeArticle({ url: "https://rnz.co.nz/a", storyId: "story-a" }),
        makeArticle({ url: "https://rnz.co.nz/b", storyId: "story-b" }),
      ]);
      const rows = await getArticlesByStoryId(testDb, "story-a");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.url).toBe("https://rnz.co.nz/a");
    });
  });

  describe("updateStoryEnrichment", () => {
    test("sets summary, angles, and relatedMetrics", async () => {
      await upsertStory(testDb, makeStory());
      await updateStoryEnrichment(testDb, "test-story-slug", {
        summary: "A rich summary.",
        angles: JSON.stringify(["consumer impact", "RBNZ response"]),
        relatedMetrics: JSON.stringify(["cpi", "ocr"]),
      });
      const result = await getStoryBySlug(testDb, "test-story-slug");
      expect(result?.summary).toBe("A rich summary.");
      expect(result?.angles).toBe(
        JSON.stringify(["consumer impact", "RBNZ response"])
      );
      expect(result?.relatedMetrics).toBe(JSON.stringify(["cpi", "ocr"]));
    });
  });

  describe("closeStory", () => {
    test("closes a story with reason", async () => {
      await upsertStory(testDb, {
        id: "test-story",
        headline: "Test",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      await closeStory(testDb, "test-story", "expired");
      const story = await getStoryBySlug(testDb, "test-story");
      expect(story!.status).toBe("closed");
      expect(story!.closedReason).toBe("expired");
    });
  });

  describe("getOpenStories", () => {
    test("excludes closed stories", async () => {
      await upsertStory(testDb, {
        id: "open-story",
        headline: "Open",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      await upsertStory(testDb, {
        id: "closed-story",
        headline: "Closed",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      await closeStory(testDb, "closed-story", "expired");
      const open = await getOpenStories(testDb);
      expect(open).toHaveLength(1);
      expect(open[0]!.id).toBe("open-story");
    });
  });

  describe("insertStorySummary + getStorySummaries + getStorySummaryCount", () => {
    test("inserts and retrieves story summaries newest first", async () => {
      await upsertStory(testDb, {
        id: "test-story",
        headline: "Test",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      await insertStorySummary(testDb, {
        storyId: "test-story",
        summary: "First",
        sources: JSON.stringify(["rnz"]),
        articleCount: 1,
      });
      // Small delay to ensure different createdAt
      await new Promise((r) => setTimeout(r, 10));
      await insertStorySummary(testDb, {
        storyId: "test-story",
        summary: "Second",
        sources: JSON.stringify(["rnz", "stuff"]),
        articleCount: 3,
      });
      const result = await getStorySummaries(testDb, "test-story");
      expect(result).toHaveLength(2);
      expect(result[0]!.summary).toBe("Second");
    });

    test("counts story summaries", async () => {
      await upsertStory(testDb, {
        id: "test-story",
        headline: "Test",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      await insertStorySummary(testDb, {
        storyId: "test-story",
        summary: "s1",
        sources: "[]",
        articleCount: 1,
      });
      await insertStorySummary(testDb, {
        storyId: "test-story",
        summary: "s2",
        sources: "[]",
        articleCount: 2,
      });
      const count = await getStorySummaryCount(testDb, "test-story");
      expect(count).toBe(2);
    });
  });

  describe("getChildStory", () => {
    test("finds child story by parentStoryId", async () => {
      await upsertStory(testDb, {
        id: "parent",
        headline: "Parent",
        tags: "[]",
        sourceCount: 1,
        firstReportedAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      // Insert child with parentStoryId — use raw SQL since upsertStory doesn't include parentStoryId in conflict set
      await testDb.run(sql`INSERT INTO stories (id, headline, tags, source_count, first_reported_at, updated_at, created_at, status, parent_story_id)
        VALUES ('child', 'Child', '[]', 1, '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z', datetime('now'), 'open', 'parent')`);
      const child = await getChildStory(testDb, "parent");
      expect(child).not.toBeNull();
      expect(child!.id).toBe("child");
    });
  });

  describe("deleteOldArticles + deleteOrphanedStories", () => {
    test("deleteOldArticles removes articles before the given date", async () => {
      await insertArticles(testDb, [
        makeArticle({
          url: "https://rnz.co.nz/old",
          publishedAt: "2026-01-01T00:00:00.000Z",
        }),
        makeArticle({
          url: "https://rnz.co.nz/new",
          publishedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]);
      await deleteOldArticles(testDb, "2026-02-01T00:00:00.000Z");
      const rows = await testDb.select().from(schema.articles);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.url).toBe("https://rnz.co.nz/new");
    });

    test("deleteOrphanedStories removes stories with no linked articles", async () => {
      await upsertStory(testDb, makeStory({ id: "has-articles" }));
      await upsertStory(testDb, makeStory({ id: "no-articles" }));
      await insertArticles(testDb, [
        makeArticle({ url: "https://rnz.co.nz/x", storyId: "has-articles" }),
      ]);
      await deleteOrphanedStories(testDb);
      const rows = await testDb.select().from(schema.stories);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe("has-articles");
    });

    test("deleteOldArticles then deleteOrphanedStories cleans up fully", async () => {
      await upsertStory(testDb, makeStory({ id: "orphan-after-prune" }));
      await insertArticles(testDb, [
        makeArticle({
          url: "https://rnz.co.nz/prune",
          storyId: "orphan-after-prune",
          publishedAt: "2026-01-15T00:00:00.000Z",
        }),
      ]);
      // Delete the only article
      await deleteOldArticles(testDb, "2026-02-01T00:00:00.000Z");
      // Story should now be orphaned
      await deleteOrphanedStories(testDb);
      const storyRows = await testDb.select().from(schema.stories);
      expect(storyRows).toHaveLength(0);
    });
  });
});
