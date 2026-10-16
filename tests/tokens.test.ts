import { describe, expect, it } from "vitest";
import { deriveReadToken, hashToken, signAssetUrl, tokenMatches, verifyAssetSignature } from "../packages/shared/src/tokens.js";
import { overallVerdict } from "../apps/worker/src/worker.js";
import { priceToAtomic } from "../apps/api/src/app.js";

const secret = "s".repeat(64);

describe("read tokens", () => {
  it("are stable per inspection and only match their own hash", () => {
    const a = deriveReadToken(secret, "a");
    expect(deriveReadToken(secret, "a")).toBe(a);
    expect(tokenMatches(a, hashToken(a))).toBe(true);
    expect(tokenMatches(deriveReadToken(secret, "b"), hashToken(a))).toBe(false);
    expect(tokenMatches(undefined, hashToken(a))).toBe(false);
  });
});

describe("asset signatures", () => {
  const now = 1_800_000_000;
  const sig = signAssetUrl(secret, "ins", "asset", now + 60);
  it("verify before expiry for the same inspection and asset", () => {
    expect(verifyAssetSignature(secret, "ins", "asset", now + 60, sig, now)).toBe(true);
  });
  it("fail closed when expired, moved to another run, or tampered", () => {
    expect(verifyAssetSignature(secret, "ins", "asset", now + 60, sig, now + 61)).toBe(false);
    expect(verifyAssetSignature(secret, "other", "asset", now + 60, sig, now)).toBe(false);
    expect(verifyAssetSignature(secret, "ins", "asset2", now + 60, sig, now)).toBe(false);
    expect(verifyAssetSignature(secret, "ins", "asset", now + 60, `${sig}x`, now)).toBe(false);
  });
});

describe("overallVerdict", () => {
  it("is FAIL if any viewport failed, INCONCLUSIVE if any could not be judged, else PASS", () => {
    expect(overallVerdict(["FAIL", "PASS"])).toBe("FAIL");
    expect(overallVerdict(["FAIL", "INCONCLUSIVE"])).toBe("FAIL");
    expect(overallVerdict(["PASS", "INCONCLUSIVE"])).toBe("INCONCLUSIVE");
    expect(overallVerdict([])).toBe("INCONCLUSIVE");
    expect(overallVerdict(["PASS", "PASS"])).toBe("PASS");
  });
});

describe("priceToAtomic", () => {
  it("converts USD strings to 6-decimal USDC units exactly", () => {
    expect(priceToAtomic("0.05")).toBe(50_000n);
    expect(priceToAtomic("1")).toBe(1_000_000n);
    expect(priceToAtomic("0.000001")).toBe(1n);
  });
});
