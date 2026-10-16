import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Read tokens are derived, not stored: an agent that retries a paid request with the same
// quote and idempotency key gets the same token back without AisleRun keeping it in plaintext.
export function deriveReadToken(secret: string, inspectionId: string): string {
  return `rt_${createHmac("sha256", secret).update(`read:${inspectionId}`).digest("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(presented: string | undefined, storedHash: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(hashToken(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signAssetUrl(secret: string, inspectionId: string, assetId: string, expiresAtSec: number): string {
  return createHmac("sha256", secret).update(`asset:${inspectionId}:${assetId}:${expiresAtSec}`).digest("base64url");
}

export function verifyAssetSignature(secret: string, inspectionId: string, assetId: string, expiresAtSec: number, sig: string, nowSec: number): boolean {
  if (!Number.isInteger(expiresAtSec) || expiresAtSec < nowSec) return false;
  const expected = Buffer.from(signAssetUrl(secret, inspectionId, assetId, expiresAtSec));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
