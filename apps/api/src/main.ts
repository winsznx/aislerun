import { migrate } from "../../../db/migrate.js";
import { loadConfig } from "../../../packages/shared/src/config.js";
import { createPool } from "../../../packages/shared/src/db.js";
import { EvidenceStore } from "../../../packages/shared/src/evidence.js";
import { log } from "../../../packages/shared/src/log.js";
import { startWorkerLoop } from "../../worker/src/worker.js";
import { createApp } from "./app.js";
import { createResourceServer } from "./payments.js";
import { seedFixtureTargets } from "./targets-seed.js";

const config = loadConfig();
const applied = await migrate(config.DATABASE_URL);
if (applied.length) log.info({ applied }, "migrations applied");

const db = createPool(config.DATABASE_URL);
await seedFixtureTargets(db, config.FIXTURE_ORIGIN);
const evidence = new EvidenceStore(config.EVIDENCE_DIR);
const resourceServer = createResourceServer({
  network: config.X402_NETWORK,
  facilitatorUrl: config.X402_FACILITATOR_URL,
  receiver: config.PAYMENT_RECEIVER,
  priceUsd: config.INSPECTION_PRICE_USD,
});

const app = createApp({ config, db, evidence, resourceServer });
const server = app.listen(config.PORT, () => log.info({ port: config.PORT, build: config.BUILD_VERSION }, "api listening"));

const shutdown = new AbortController();
const worker = config.WORKER_ENABLED === "true" ? startWorkerLoop({ db, evidence }, shutdown.signal) : Promise.resolve();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    log.info({ signal }, "shutting down");
    shutdown.abort();
    server.close();
    void worker.finally(() => db.end().finally(() => process.exit(0)));
  });
}
