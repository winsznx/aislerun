import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES } from "./fixtures.js";

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, "site");
const out = join(here, "..", "dist");

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`fixture template is missing {{${key}}}`);
    return value;
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "assets"), { recursive: true });
cpSync(join(site, "store.css"), join(out, "assets", "store.css"));

const pages: Array<[string, string]> = [
  ["product.html", "products/cup/index.html"],
  ["cart.html", "cart/index.html"],
  ["checkout.html", "checkouts/entry/index.html"],
];

for (const fixture of FIXTURES) {
  const values = { VERSION: fixture.version, DISCLOSURE: fixture.disclosure, DRAWER_LOOKUP: fixture.drawerLookup };
  const root = join(out, "v", fixture.version);
  for (const [source, target] of pages) {
    const dest = join(root, target);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, render(readFileSync(join(site, source), "utf8"), values));
  }
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "assets", "cart.js"), render(readFileSync(join(site, "cart.js"), "utf8"), values));
}

writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>AisleRun fixtures</title>
<h1>AisleRun synthetic storefront fixtures</h1><p>Labelled test fixtures. Not a real store.</p><ul>${FIXTURES.map(
    (f) => `<li><a href="/v/${f.version}/products/cup">${f.version}</a> – ${f.disclosure}</li>`,
  ).join("")}</ul>`,
);
writeFileSync(join(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log(`built ${FIXTURES.length} fixtures into ${out}`);
