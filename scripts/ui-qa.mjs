// Screenshot QA for every public page at the release breakpoints. Reports console errors,
// horizontal overflow and the rendered height of every video stage.
// Usage: node scripts/ui-qa.mjs <base-url> <out-dir>
import { chromium } from "playwright";

const [base = "http://localhost:8790", out = "qa"] = process.argv.slice(2);
const sizes = [[1440, 900], [1280, 800], [768, 1024], [390, 844]];
const pages = (process.env.QA_PAGES ?? "/,/demo,/demo/compare,/demo/runs/2c076b7f-3613-41c7-a5e3-6c46d7628f76,/docs,/nope").split(",");

const browser = await chromium.launch();
let problems = 0;
for (const path of pages) {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/404 \(Not Found\)/.test(m.text()) && errors.push(m.text()));
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => undefined);
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      stages: [...document.querySelectorAll(".viewer-stage")].map((s) => Math.round(s.getBoundingClientRect().height)),
      videos: [...document.querySelectorAll("video")].map((v) => Math.round(v.getBoundingClientRect().height)),
    }));
    const name = `${path.replace(/[^a-z0-9]+/gi, "_") || "home"}-${width}`;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    const bad = errors.length || metrics.overflow > 0 || metrics.videos.some((h) => h > 600);
    if (bad) problems++;
    console.log(`${bad ? "!!" : "ok"} ${path} @${width}: overflow=${metrics.overflow} stages=${metrics.stages} videos=${metrics.videos} errors=${JSON.stringify(errors)}`);
    await page.close();
  }
}
await browser.close();
process.exit(problems ? 1 : 0);
