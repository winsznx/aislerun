import { describe, expect, it } from "vitest";
import { InspectionStatus } from "../packages/contracts/src/index.js";
import * as ui from "../apps/site/lib/status.js";

describe("UI status mapping", () => {
  it("gives every backend status a known, non-empty view", () => {
    // #given every status the API can return
    const kinds = InspectionStatus.options.map((s) => ui.statusInfo(s).kind);
    // #then none falls through to the unknown branch
    expect(InspectionStatus.options.filter((s) => ui.statusInfo(s).title === "Unknown state")).toEqual([]);
    expect(new Set(kinds)).toEqual(new Set(["live", "report", "stopped"]));
  });

  it("treats exactly the backend's terminal statuses as terminal", () => {
    expect(InspectionStatus.options.filter((s) => ui.isTerminal(s)).sort()).toEqual(["CANCELLED", "COMPLETED", "FAILED_INTERNAL", "INCONCLUSIVE", "PAYMENT_DENIED"]);
  });

  it("never describes a service failure as a store problem", () => {
    expect(ui.statusInfo("FAILED_INTERNAL").now).toMatch(/not a problem with the store/);
    expect(ui.statusInfo("CANCELLED").now).toMatch(/No store verdict/);
  });

  it("describes a passing viewport as checkout entry, not a completed purchase", () => {
    expect(ui.viewportSummary({ verdict: "PASS", blocker: null })).toBe("Reached checkout entry");
    expect(ui.viewportSummary({ verdict: "FAIL", blocker: "ADD_TO_CART_NO_EFFECT" })).toBe("Add to cart had no effect");
    expect(ui.viewportSummary({ verdict: "INCONCLUSIVE", blocker: "BROWSER_BLOCKED" })).toBe("Stopped by a bot check");
  });

});
