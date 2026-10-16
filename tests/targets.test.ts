import { describe, expect, it } from "vitest";
import { checkProductUrl, isAllowedRequestUrl, isPublicAddress, type AllowedTarget } from "../packages/shared/src/targets.js";

const target: AllowedTarget = {
  id: "fixture-healthy-v1",
  origin: "https://aislerun-fixtures.vercel.app",
  productPathPrefix: "/v/fixture-healthy-v1/products/",
  label: "healthy",
  fixtureVersion: "fixture-healthy-v1",
};
const good = "https://aislerun-fixtures.vercel.app/v/fixture-healthy-v1/products/cup";

describe("checkProductUrl", () => {
  it("accepts an authorized product URL and strips query and fragment", () => {
    const result = checkProductUrl(`${good}?utm=x#top`, target);
    expect(result).toEqual({ ok: true, target, normalizedUrl: good });
  });

  it.each([
    ["unknown target", good, undefined],
    ["http", good.replace("https:", "http:"), target],
    ["other origin", "https://example.com/v/fixture-healthy-v1/products/cup", target],
    ["credentials", "https://user:pw@aislerun-fixtures.vercel.app/v/fixture-healthy-v1/products/cup", target],
    ["port", "https://aislerun-fixtures.vercel.app:8443/v/fixture-healthy-v1/products/cup", target],
    ["ip literal", "https://169.254.169.254/v/fixture-healthy-v1/products/cup", target],
    ["ipv6 literal", "https://[::1]/v/fixture-healthy-v1/products/cup", target],
    ["other fixture", "https://aislerun-fixtures.vercel.app/v/fixture-fixed-v2/products/cup", target],
    ["encoded traversal", "https://aislerun-fixtures.vercel.app/v/fixture-healthy-v1/products/%2e%2e/%2e%2e/cart", target],
    ["file scheme", "file:///etc/passwd", target],
    ["not a url", "cup", target],
  ])("rejects %s", (_name, url, t) => {
    expect(checkProductUrl(url, t).ok).toBe(false);
  });
});

describe("isAllowedRequestUrl", () => {
  it("allows same-origin subresources and blocks everything else", () => {
    expect(isAllowedRequestUrl("https://aislerun-fixtures.vercel.app/assets/store.css", target)).toBe(true);
    expect(isAllowedRequestUrl("https://evil.example/x.js", target)).toBe(false);
    expect(isAllowedRequestUrl("http://aislerun-fixtures.vercel.app/", target)).toBe(false);
    expect(isAllowedRequestUrl("http://169.254.169.254/latest/meta-data", target)).toBe(false);
  });
});

describe("isPublicAddress", () => {
  it.each(["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );
  it.each(["76.76.21.21", "2606:4700::1111"])("treats %s as public", (ip) => expect(isPublicAddress(ip)).toBe(true));
});
