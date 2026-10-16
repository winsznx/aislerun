import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface AllowedTarget {
  id: string;
  origin: string;
  productPathPrefix: string;
  label: string;
  fixtureVersion: string | null;
}

export type TargetCheck =
  | { ok: true; target: AllowedTarget; normalizedUrl: string }
  | { ok: false; reason: string };

const SAFE_PORTS = new Set(["", "443"]);

// Normalizes a requested product URL and checks it against one authorized target.
// String checks are the first fence. resolvesToPublicAddress and the browser's per-request
// route filter are the second and third.
export function checkProductUrl(raw: string, target: AllowedTarget | undefined): TargetCheck {
  if (!target) return { ok: false, reason: "unknown authorized_target_id" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "product_url is not a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "only https URLs are accepted" };
  if (url.username || url.password) return { ok: false, reason: "URLs with credentials are rejected" };
  if (!SAFE_PORTS.has(url.port)) return { ok: false, reason: "non-standard ports are rejected" };
  if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) return { ok: false, reason: "IP-literal hosts are rejected" };
  if (url.origin !== target.origin) return { ok: false, reason: "origin is not authorized for this target" };
  const path = decodeURIComponent(url.pathname);
  if (path.includes("..") || !path.startsWith(target.productPathPrefix)) {
    return { ok: false, reason: "path is outside the authorized product prefix" };
  }
  url.hash = "";
  url.search = "";
  return { ok: true, target, normalizedUrl: url.toString() };
}

export function isAllowedRequestUrl(raw: string, target: AllowedTarget): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.origin === target.origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  const addresses = await lookup(hostname, { all: true });
  return addresses.length > 0 && addresses.every((a) => isPublicAddress(a.address));
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return false;
    if (lower.startsWith("::ffff:")) return isPublicAddress(lower.slice(7));
    return true;
  }
  return false;
}
