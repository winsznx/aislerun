import { describe, expect, it } from "vitest";
import { parseRange } from "../apps/api/src/app.js";
import { artifactOrder, attemptOf, checkComparable, fixtureRepair, stepOffsetMs, type Report } from "../apps/api/src/report.js";

const report = (id: string, version: string, createdAt: string, ready = true) =>
  ({
    inspection_id: id,
    created_at: createdAt,
    report_status: ready ? "READY" : "PENDING",
    target: { product_url: `https://aislerun-fixtures.vercel.app/v/${version}/products/cup` },
  }) as unknown as Report;

describe("parseRange", () => {
  it.each([
    [undefined, null],
    ["bytes=0-99", { start: 0, end: 99 }],
    ["bytes=100-", { start: 100, end: 999 }],
    ["bytes=-200", { start: 800, end: 999 }],
    ["bytes=0-5000", { start: 0, end: 999 }],
  ])("parses %s", (header, expected) => expect(parseRange(header, 1000)).toEqual(expected));
  it.each(["bytes=1000-", "bytes=5-2", "bytes=-", "items=0-1", "bytes=0-1,4-5"])("rejects %s", (header) => expect(parseRange(header, 1000)).toBe("invalid"));
});

describe("checkComparable", () => {
  const before = report("a", "fixture-mobile-cart-broken-v1", "2026-10-16T18:35:12Z");
  const after = report("b", "fixture-fixed-v2", "2026-10-16T18:41:01Z");
  it("accepts a later run of the same product on a repaired fixture", () => expect(checkComparable(before, after)).toEqual({ ok: true }));
  it("refuses comparing a run with itself", () => expect(checkComparable(before, before).ok).toBe(false));
  it("refuses a retest that is older than the original", () => expect(checkComparable(after, before).ok).toBe(false));
  it("refuses runs of different products", () => {
    const other = { ...after, target: { product_url: "https://aislerun-fixtures.vercel.app/v/fixture-fixed-v2/products/plate" } } as Report;
    expect(checkComparable(before, other).ok).toBe(false);
  });
  it("refuses runs without stored evidence", () => expect(checkComparable(before, report("c", "fixture-fixed-v2", "2026-10-16T19:00:00Z", false)).ok).toBe(false));
});

describe("presentation adapters", () => {
  it("reads the attempt from worker artifact labels", () => {
    expect(attemptOf("mobile #2 recording")).toBe(2);
    expect(attemptOf("mobile recording")).toBe(1);
  });
  it("orders screenshots by attempt, then journey stage", () => {
    const labels = ["mobile #2 page-loaded", "mobile #1 after-add-to-cart", "mobile #1 page-loaded", "mobile #1 before-add-to-cart"];
    expect([...labels].sort((a, b) => artifactOrder(a) - artifactOrder(b))).toEqual([
      "mobile #1 page-loaded",
      "mobile #1 before-add-to-cart",
      "mobile #1 after-add-to-cart",
      "mobile #2 page-loaded",
    ]);
  });
  it("computes step offsets only when an attempt start is known and precedes the step", () => {
    expect(stepOffsetMs("2026-10-16T18:35:24.154Z", "2026-10-16T18:35:22.059Z")).toBe(2095);
    expect(stepOffsetMs("2026-10-16T18:35:24Z", null)).toBeNull();
    expect(stepOffsetMs("2026-10-16T18:35:20Z", "2026-10-16T18:35:22Z")).toBeNull();
  });
  it("discloses the real one-line repair between the broken and fixed fixtures, and nothing for unrelated ones", () => {
    const repair = fixtureRepair("fixture-mobile-cart-broken-v1", "fixture-fixed-v2");
    expect(repair?.before).toContain("CartDrawer-mobile");
    expect(repair?.after).toBe('return document.getElementById("CartDrawer");');
    expect(fixtureRepair("fixture-healthy-v1", "fixture-fixed-v2")).toBeNull();
  });
});
