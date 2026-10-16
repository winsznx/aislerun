import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, BrowserContext, Locator, Page } from "playwright";
import { VIEWPORTS, type Blocker, type StepResult, type Verdict, type ViewportName } from "../../contracts/src/index.js";
import { isAllowedRequestUrl, type AllowedTarget } from "../../shared/src/targets.js";

export type StepAction = "load" | "ready" | "variant" | "add_to_cart" | "confirm_cart" | "checkout_entry";

export interface StepRecord {
  ordinal: number;
  action: StepAction;
  expected: string;
  observed: Record<string, unknown>;
  result: StepResult;
  startedAt: string;
  endedAt: string;
  decision: string;
}

export interface ArtifactFile {
  kind: "screenshot" | "video" | "trace";
  label: string;
  path: string;
  mimeType: string;
}

export interface JourneyEvent {
  type: "step_started" | "step_finished" | "attempt_started" | "retrying";
  viewport: ViewportName;
  step?: StepAction;
  observed?: string;
  nextAction?: string;
  causeEffect?: string;
}

export interface ViewportOutcome {
  viewport: ViewportName;
  verdict: Verdict;
  blocker: Blocker | null;
  firstBlockerOrdinal: number | null;
  attempts: number;
  steps: StepRecord[];
  artifacts: ArtifactFile[];
  fixtureVersion: string | null;
  consoleErrors: string[];
  blockedRequests: string[];
  startedAt: string;
  endedAt: string;
}

export interface JourneyInput {
  browser: Browser;
  viewport: ViewportName;
  productUrl: string;
  target: AllowedTarget;
  workDir: string;
  emit: (event: JourneyEvent) => Promise<void>;
  navigationTimeoutMs?: number;
}

const ADD_TIMEOUT_MS = 4_000;
const CAPTCHA_PATTERN = /captcha|are you a robot|verify you are human|access denied|cf-challenge/i;

class StopJourney extends Error {
  constructor(
    readonly verdict: Verdict,
    readonly blocker: Blocker,
  ) {
    super(blocker);
  }
}

interface AttemptResult {
  steps: StepRecord[];
  verdict: Verdict;
  blocker: Blocker | null;
  retryable: boolean;
  fixtureVersion: string | null;
}

export async function runViewportJourney(input: JourneyInput): Promise<ViewportOutcome> {
  const startedAt = new Date().toISOString();
  const artifacts: ArtifactFile[] = [];
  const consoleErrors: string[] = [];
  const blockedRequests: string[] = [];

  let attempt = 1;
  let result = await runAttempt(input, attempt, artifacts, consoleErrors, blockedRequests);
  if (result.retryable) {
    await input.emit({
      type: "retrying",
      viewport: input.viewport,
      step: "confirm_cart",
      observed: "Cart state unchanged after Add to cart",
      nextAction: "Repeat the journey once in a clean browser context",
      causeEffect: "Click Add to cart → cart state unchanged → retrying once",
    });
    attempt = 2;
    result = await runAttempt(input, attempt, artifacts, consoleErrors, blockedRequests);
  }

  const firstBlocker = result.steps.find((s) => s.result === "FAIL" || s.result === "INCONCLUSIVE");
  return {
    viewport: input.viewport,
    verdict: result.verdict,
    blocker: result.blocker,
    firstBlockerOrdinal: firstBlocker?.ordinal ?? null,
    attempts: attempt,
    steps: result.steps,
    artifacts,
    fixtureVersion: result.fixtureVersion,
    consoleErrors: consoleErrors.slice(0, 50),
    blockedRequests: blockedRequests.slice(0, 50),
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function runAttempt(
  input: JourneyInput,
  attempt: number,
  artifacts: ArtifactFile[],
  consoleErrors: string[],
  blockedRequests: string[],
): Promise<AttemptResult> {
  const { viewport, target } = input;
  const dir = join(input.workDir, viewport, `attempt-${attempt}`);
  await mkdir(dir, { recursive: true });
  await input.emit({ type: "attempt_started", viewport, observed: `Attempt ${attempt} in a fresh browser context` });

  const preset = VIEWPORTS[viewport];
  const context = await input.browser.newContext({
    viewport: { width: preset.width, height: preset.height },
    deviceScaleFactor: preset.deviceScaleFactor,
    isMobile: preset.isMobile,
    hasTouch: preset.hasTouch,
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
    acceptDownloads: false,
    recordVideo: { dir, size: { width: preset.width, height: preset.height } },
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await restrictNetwork(context, target, blockedRequests);

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(input.navigationTimeoutMs ?? 20_000);
  page.setDefaultTimeout(8_000);
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${viewport} #${attempt}] ${msg.text().slice(0, 500)}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${viewport} #${attempt}] pageerror: ${err.message.slice(0, 500)}`));

  const steps: StepRecord[] = [];
  const shot = async (label: string) => {
    const path = join(dir, `${String(artifacts.length).padStart(2, "0")}-${label}.png`);
    await page.screenshot({ path, fullPage: false });
    artifacts.push({ kind: "screenshot", label: `${viewport} #${attempt} ${label}`, path, mimeType: "image/png" });
  };
  const step = async (
    action: StepAction,
    expected: string,
    body: () => Promise<{ result: StepResult; observed: Record<string, unknown>; decision: string; blocker?: Blocker; verdict?: Verdict }>,
  ) => {
    const ordinal = steps.length + 1;
    const startedAt = new Date().toISOString();
    await input.emit({ type: "step_started", viewport, step: action, nextAction: expected });
    let outcome;
    try {
      outcome = await body();
    } catch (error) {
      if (error instanceof StopJourney) throw error;
      outcome = {
        result: "INCONCLUSIVE" as const,
        observed: { error: error instanceof Error ? error.message.split("\n")[0] : String(error) },
        decision: `Could not complete "${action}" because the page did not respond as expected.`,
        blocker: "NAVIGATION_FAILED" as const,
      };
    }
    steps.push({ ordinal, action, expected, observed: outcome.observed, result: outcome.result, startedAt, endedAt: new Date().toISOString(), decision: outcome.decision });
    await input.emit({ type: "step_finished", viewport, step: action, observed: outcome.decision });
    if (outcome.result === "FAIL" || outcome.result === "INCONCLUSIVE") {
      throw new StopJourney(outcome.verdict ?? (outcome.result === "FAIL" ? "FAIL" : "INCONCLUSIVE"), outcome.blocker ?? "UNSUPPORTED_MARKUP");
    }
  };

  let fixtureVersion: string | null = null;
  let verdict: Verdict = "PASS";
  let blocker: Blocker | null = null;
  let retryable = false;

  try {
    await step("load", "Product page loads on an authorized origin", async () => {
      const response = await page.goto(input.productUrl, { waitUntil: "domcontentloaded" });
      const finalUrl = page.url();
      const status = response?.status() ?? 0;
      fixtureVersion = await page.locator("body").getAttribute("data-fixture-version");
      const observed = { requested_url: input.productUrl, final_url: finalUrl, http_status: status };
      if (!isAllowedRequestUrl(finalUrl, target)) {
        return { result: "INCONCLUSIVE", observed, decision: "The page redirected outside the authorized target, so the run stopped.", blocker: "TARGET_LEFT_ALLOWLIST" };
      }
      const text = (await page.locator("body").innerText()).slice(0, 4000);
      if (status === 403 || status === 429 || CAPTCHA_PATTERN.test(text)) {
        return { result: "INCONCLUSIVE", observed, decision: "The store answered with a bot check or access refusal, so the purchase path could not be judged.", blocker: "BROWSER_BLOCKED" };
      }
      if (status >= 400) {
        return { result: "INCONCLUSIVE", observed, decision: `The product page returned HTTP ${status}.`, blocker: "NAVIGATION_FAILED" };
      }
      await shot("product-loaded");
      return { result: "PASS", observed, decision: `Product page loaded (HTTP ${status}).` };
    });

    await step("ready", "Product title and price are visible and the product is in stock", async () => {
      const title = page.locator("h1").first();
      await title.waitFor({ state: "visible" });
      const titleText = (await title.innerText()).trim();
      const price = await firstText(page, ["[data-price]", ".price", "[itemprop=price]"]);
      const stock = await page.locator("[data-stock]").first().getAttribute("data-stock").catch(() => null);
      const observed = { title: titleText, price, stock };
      if (stock === "out_of_stock" || /sold out/i.test((await firstText(page, ["[data-stock]", ".product__stock"])) ?? "")) {
        return { result: "INCONCLUSIVE", observed, decision: "The product is out of stock, so Add to cart cannot be judged.", blocker: "PRODUCT_UNAVAILABLE" };
      }
      return { result: "PASS", observed, decision: `Found "${titleText}" at ${price ?? "an unlisted price"}.` };
    });

    await step("variant", "An available variant is selected if the product has variants", async () => {
      const options = page.locator("input[name=variant], input[name^='options']");
      const count = await options.count();
      if (count === 0) return { result: "SKIPPED", observed: { variants: 0 }, decision: "No variant picker on this product." };
      for (let i = 0; i < count; i++) {
        const option = options.nth(i);
        if (await option.isEnabled()) {
          await option.check();
          const value = await option.getAttribute("value");
          return { result: "PASS", observed: { variants: count, chosen: value }, decision: `Selected available variant "${value}".` };
        }
      }
      return { result: "INCONCLUSIVE", observed: { variants: count }, decision: "Every variant is unavailable.", blocker: "PRODUCT_UNAVAILABLE" };
    });

    const before = await readCartSignals(page);
    await step("add_to_cart", "Add to cart control is found and clicked", async () => {
      const button = await findAddToCart(page);
      if (!button) {
        return { result: "INCONCLUSIVE", observed: {}, decision: "No recognizable Add to cart control on the page.", blocker: "UNSUPPORTED_MARKUP" };
      }
      await shot("before-add-to-cart");
      await button.locator.scrollIntoViewIfNeeded();
      await button.locator.click();
      return { result: "PASS", observed: { matched_by: button.matchedBy, cart_count_before: before.count }, decision: `Clicked Add to cart (matched by ${button.matchedBy}).` };
    });

    await step("confirm_cart", "Cart count increases and the cart lists the item (two signals)", async () => {
      const after = await waitForCartChange(page, before);
      await shot("after-add-to-cart");
      const countIncreased = after.count !== null && before.count !== null && after.count > before.count;
      const itemListed = after.items > before.items;
      const signals = [countIncreased && "cart count increased", itemListed && "cart line item appeared"].filter(Boolean);
      const observed = { cart_count_before: before.count, cart_count_after: after.count, line_items_before: before.items, line_items_after: after.items, signals };
      if (countIncreased && itemListed) {
        return { result: "PASS", observed, decision: `Item reached the cart (${signals.join(" and ")}).` };
      }
      if (!countIncreased && !itemListed) {
        retryable = attempt === 1;
        return { result: "FAIL", observed, decision: "Add to cart was clicked but the cart did not change.", blocker: "ADD_TO_CART_NO_EFFECT" };
      }
      return { result: "INCONCLUSIVE", observed, decision: `Only one cart signal changed (${signals.join("")}), which is not enough to confirm the item was added.`, blocker: "UNSUPPORTED_MARKUP" };
    });

    await step("checkout_entry", "A checkout control leads to the checkout entrance (nothing is submitted)", async () => {
      let control = await findCheckout(page);
      if (!control) {
        const cartLink = page.locator("#cart-icon-bubble, a[href$='/cart']").first();
        if ((await cartLink.count()) > 0) {
          await cartLink.click();
          await page.waitForLoadState("domcontentloaded");
          control = await findCheckout(page);
        }
      }
      if (!control) {
        return { result: "FAIL", observed: { url: page.url() }, decision: "The item is in the cart but no checkout control is reachable.", blocker: "CHECKOUT_ENTRY_BLOCKED" };
      }
      await Promise.all([page.waitForURL(/\/checkouts?(\/|$|\?)/, { timeout: 10_000 }).catch(() => undefined), control.click()]);
      await page.waitForLoadState("domcontentloaded");
      const url = page.url();
      if (!isAllowedRequestUrl(url, target)) {
        return { result: "INCONCLUSIVE", observed: { url }, decision: "Checkout left the authorized origin, so the run stopped before loading it.", blocker: "TARGET_LEFT_ALLOWLIST" };
      }
      const heading = await firstText(page, ["h1"]);
      const reached = /\/checkouts?(\/|$|\?)/.test(new URL(url).pathname) || /checkout/i.test(heading ?? "");
      await shot("checkout-entry");
      if (!reached) {
        return { result: "FAIL", observed: { url, heading }, decision: "Clicking checkout did not reach a checkout page.", blocker: "CHECKOUT_ENTRY_BLOCKED" };
      }
      return { result: "PASS", observed: { url, heading }, decision: `Reached the checkout entrance ("${heading}"). Nothing was submitted.` };
    });
  } catch (error) {
    if (!(error instanceof StopJourney)) throw error;
    verdict = error.verdict;
    blocker = error.blocker;
  } finally {
    const tracePath = join(dir, "trace.zip");
    await context.tracing.stop({ path: tracePath }).catch(() => undefined);
    artifacts.push({ kind: "trace", label: `${viewport} #${attempt} Playwright trace`, path: tracePath, mimeType: "application/zip" });
    const video = page.video();
    await context.close();
    if (video) {
      artifacts.push({ kind: "video", label: `${viewport} #${attempt} recording`, path: await video.path(), mimeType: "video/webm" });
    }
  }

  return { steps, verdict, blocker, retryable: retryable && verdict === "FAIL", fixtureVersion };
}

async function restrictNetwork(context: BrowserContext, target: AllowedTarget, blocked: string[]) {
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("data:") || url.startsWith("blob:") || isAllowedRequestUrl(url, target)) {
      await route.continue();
      return;
    }
    blocked.push(url.slice(0, 300));
    await route.abort("blockedbyclient");
  });
}

async function firstText(page: Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) return (await el.innerText()).trim();
  }
  return null;
}

async function findAddToCart(page: Page): Promise<{ locator: Locator; matchedBy: string } | null> {
  const candidates: Array<[string, Locator]> = [
    ["test id", page.locator("[data-testid=add-to-cart]")],
    ["Shopify form button", page.locator("form[action*='/cart/add'] [name=add], form[action*='/cart/add'] button[type=submit]")],
    ["accessible name", page.getByRole("button", { name: /add to (cart|bag)/i })],
  ];
  for (const [matchedBy, locator] of candidates) {
    const first = locator.first();
    if ((await first.count()) > 0 && (await first.isVisible())) return { locator: first, matchedBy };
  }
  return null;
}

async function findCheckout(page: Page): Promise<Locator | null> {
  const candidates = [
    page.locator("[name=checkout]"),
    page.getByRole("link", { name: /check ?out/i }),
    page.getByRole("button", { name: /check ?out/i }),
  ];
  for (const locator of candidates) {
    const first = locator.first();
    if ((await first.count()) > 0 && (await first.isVisible())) return first;
  }
  return null;
}

interface CartSignals {
  count: number | null;
  items: number;
}

async function readCartSignals(page: Page): Promise<CartSignals> {
  const countText = await page.locator("[data-cart-count], .cart-count-bubble").first().textContent().catch(() => null);
  const parsed = countText ? Number.parseInt(countText.replace(/\D+/g, ""), 10) : Number.NaN;
  const items = await page.locator("[data-cart-item], .cart-item, cart-drawer-items .cart-item").count();
  return { count: Number.isFinite(parsed) ? parsed : null, items };
}

async function waitForCartChange(page: Page, before: CartSignals): Promise<CartSignals> {
  const deadline = Date.now() + ADD_TIMEOUT_MS;
  let latest = await readCartSignals(page);
  while (Date.now() < deadline) {
    const changed = (latest.count ?? 0) > (before.count ?? 0) && latest.items > before.items;
    if (changed) return latest;
    await page.waitForTimeout(200);
    latest = await readCartSignals(page);
  }
  return latest;
}
