import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { proposeX402, x402OutputSchema } from "./paybox.js";

const PROTOCOL_VERSION = "2026-07-28";
// The production AisleRun API. Configure this exact host as the plugin's network access in the portal.
const API = "https://aislerun.158-220-85-120.sslip.io";
const WEB = "https://aislerun.vercel.app";
const PROFILE = "shopify_checkout_entry_v1";
const STORES = ["fixture-mobile-cart-broken-v1", "fixture-fixed-v2", "fixture-healthy-v1", "fixture-bot-check-v1"] as const;
const FIXTURE_ORIGIN = "https://aislerun-fixtures.vercel.app";
const CALL_BUDGET_MS = 8_000;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    signal: AbortSignal.timeout(CALL_BUDGET_MS),
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; code?: string; message?: string };
  if (!response.ok) throw new Error(`AisleRun refused the request: ${body.code ?? response.status}${body.message ? `, ${body.message}` : ""}`);
  return body;
}

const textResult = <T extends Record<string, unknown>>(text: string, structuredContent: T) => ({
  content: [{ type: "text" as const, text }],
  structuredContent,
});

const viewportSchema = z.object({
  viewport: z.string(),
  verdict: z.string().nullable(),
  blocker: z.string().nullable(),
  attempts: z.number().int(),
}).strict();

function createServer() {
  const server = new McpServer({ name: "aislerun", version: "1.0.0" }, { supportedProtocolVersions: [PROTOCOL_VERSION] });

  server.registerTool(
    "list_test_stores",
    {
      title: "List AisleRun test stores and price",
      description:
        "Lists the stores AisleRun is authorized to test, the price of one inspection and the payment network. Free; nothing is paid or started.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({
        price_usdc: z.string(),
        network: z.string(),
        stores: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
        note: z.string(),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      const meta = await api<{ payment: { price_usd: string; network: string }; authorized_targets: Array<{ id: string; label: string }> }>("/v1/meta");
      const stores = meta.authorized_targets.map((t) => ({ id: t.id, label: t.label }));
      const note = "These are AisleRun's own labelled test stores. A run opens the product page in Chromium on a phone and a desktop, adds to cart and stops at checkout entry. No order is ever placed.";
      return textResult(
        `${stores.length} test stores. One inspection costs ${meta.payment.price_usd} USDC on Base.\n${stores.map((s) => `- ${s.id}: ${s.label}`).join("\n")}\n${note}`,
        { price_usdc: meta.payment.price_usd, network: meta.payment.network, stores, note },
      );
    },
  );

  server.registerTool(
    "order_inspection",
    {
      title: "Order a paid checkout inspection",
      description:
        "Gets a free quote, then proposes the paid x402 request that starts one AisleRun inspection of a test store (0.05 USDC on Base). PayBox checks the payment request and asks for approval; nothing is paid until then. The paid response contains inspection_id and read_token for get_inspection_result.",
      inputSchema: z.object({
        store: z.enum(STORES).describe("Test store to inspect, from list_test_stores."),
        client_reference: z.string().max(128).optional().describe("Optional reference echoed back in the run."),
      }).strict(),
      outputSchema: x402OutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ store, client_reference }) => {
      const productUrl = `${FIXTURE_ORIGIN}/v/${store}/products/cup`;
      const quote = await api<{ quote_id: string; expires_at: string; price: { amount_atomic: string; network: string } }>("/v1/quotes", {
        method: "POST",
        body: JSON.stringify({ product_url: productUrl, authorized_target_id: store, profile: PROFILE, viewports: ["mobile", "desktop"] }),
      });
      if (quote.price.network !== "eip155:8453") throw new Error(`Unexpected payment network ${quote.price.network}.`);
      // The proposal must expire within five minutes and never after the quote does.
      const fourMinutes = Date.now() + 240_000;
      const expiresAt = new Date(Math.min(fourMinutes, Date.parse(quote.expires_at) - 5_000)).toISOString().replace(/\.\d{3}Z$/, "Z");
      return proposeX402({
        chain: "eip155:8453",
        url: `${API}/v1/inspections`,
        method: "POST",
        maxAmount: quote.price.amount_atomic,
        expiresAt,
        body: {
          quote_id: quote.quote_id,
          product_url: productUrl,
          authorized_target_id: store,
          profile: PROFILE,
          idempotency_key: randomUUID(),
          ...(client_reference ? { client_reference } : {}),
        },
      });
    },
  );

  server.registerTool(
    "get_inspection_result",
    {
      title: "Get an inspection's result",
      description:
        "Reads the status and verdicts of an AisleRun inspection using the inspection_id and read_token returned by the paid order. Free. Poll every 2 seconds until terminal is true.",
      inputSchema: z.object({
        inspection_id: z.uuid(),
        read_token: z.string().regex(/^rt_[A-Za-z0-9_-]{20,}$/).describe("read_token from the paid order's response."),
      }).strict(),
      outputSchema: z.object({
        inspection_id: z.string(),
        status: z.string(),
        terminal: z.boolean(),
        overall_verdict: z.string().nullable(),
        error_code: z.string().nullable(),
        viewports: z.array(viewportSchema),
        settlement_tx: z.string().nullable(),
        report_url: z.string(),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ inspection_id, read_token }) => {
      const auth = { authorization: `Bearer ${read_token}` };
      const status = await api<{ status: string; terminal: boolean; overall_verdict: string | null; error_code: string | null; viewports: Array<{ viewport: string; verdict: string | null; blocker: string | null; attempts: number }> }>(
        `/v1/inspections/${inspection_id}`,
        { headers: auth },
      );
      let settlement: string | null = null;
      if (status.terminal) {
        const report = await api<{ payment: { settlement_reference: string | null } | null }>(`/v1/reports/${inspection_id}`, { headers: auth });
        settlement = report.payment?.settlement_reference ?? null;
      }
      const viewports = status.viewports.map((v) => ({ viewport: v.viewport, verdict: v.verdict, blocker: v.blocker, attempts: v.attempts }));
      const reportUrl = `${WEB}/runs/${inspection_id}#token=${read_token}`;
      const lines = status.terminal
        ? [`Finished: ${status.overall_verdict ?? status.status}${status.error_code ? ` (${status.error_code})` : ""}.`, ...viewports.map((v) => `- ${v.viewport}: ${v.verdict ?? "no verdict"}${v.blocker ? ` (${v.blocker})` : ""}, ${v.attempts} attempt(s)`)]
        : [`Still running: ${status.status}. Check again in 2 seconds.`];
      if (settlement) lines.push(`Payment settled on Base: https://basescan.org/tx/${settlement}`);
      lines.push(`Report with the recording: ${reportUrl}`);
      return textResult(lines.join("\n"), {
        inspection_id,
        status: status.status,
        terminal: status.terminal,
        overall_verdict: status.overall_verdict,
        error_code: status.error_code,
        viewports,
        settlement_tx: settlement,
        report_url: reportUrl,
      });
    },
  );

  return server;
}

serveStdio(createServer, { legacy: "reject" });
