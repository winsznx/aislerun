import express from "express";
import { paymentMiddleware } from "@x402/express";
import { createResourceServer, paidAccepts, type PaymentSettings } from "./payments.js";
import { log } from "../../../packages/shared/src/log.js";

// Integration spike (PRD §6.2 trial 2): the smallest x402-protected route, used to
// observe exactly what PayBox's use_service sends and accepts before anything else is built.
const settings: PaymentSettings = {
  network: "eip155:8453",
  facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://facilitator.payai.network",
  receiver: process.env.PAYMENT_RECEIVER ?? "",
  priceUsd: process.env.INSPECTION_PRICE_USD ?? "0.01",
};
if (!/^0x[0-9a-fA-F]{40}$/.test(settings.receiver)) throw new Error("PAYMENT_RECEIVER must be an EVM address");

const resourceServer = createResourceServer(settings);
resourceServer.onAfterSettle(async ({ result }) => {
  log.info({ settle: result }, "x402 settled");
});
resourceServer.onSettleFailure(async ({ error }) => {
  log.warn({ err: error.message }, "x402 settle failed");
});

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "16kb" }));
app.use((req, _res, next) => {
  const headers = { ...req.headers };
  for (const k of ["payment-signature", "x-payment", "authorization"]) if (headers[k]) headers[k] = `[present len=${String(headers[k]).length}]`;
  log.info({ method: req.method, path: req.path, headers, body: req.body }, "incoming");
  next();
});

const accepts = paidAccepts(settings);
app.use(
  paymentMiddleware(
    {
      "POST /v1/echo-paid": { accepts, description: "AisleRun integration spike: echoes the request body after payment", mimeType: "application/json" },
      "GET /v1/echo-paid": { accepts, description: "AisleRun integration spike: echoes the query after payment", mimeType: "application/json" },
    },
    resourceServer,
  ),
);

app.get("/healthz", (_req, res) => { res.json({ ok: true }); });
app.post("/v1/echo-paid", (req, res) => { res.json({ echoed: req.body ?? null, method: "POST", at: new Date().toISOString() }); });
app.get("/v1/echo-paid", (req, res) => { res.json({ echoed: req.query, method: "GET", at: new Date().toISOString() }); });

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => log.info({ port }, "spike listening"));
