import { FIXTURES } from "../../fixtures/src/fixtures.js";
import type { Db } from "../../../packages/shared/src/db.js";

// The hackathon allowlist: only the project's own labelled fixtures. Each fixture version is its
// own target so a report can never attribute one build's behaviour to another.
export async function seedFixtureTargets(db: Db, fixtureOrigin: string): Promise<void> {
  const origin = new URL(fixtureOrigin).origin;
  for (const fixture of FIXTURES) {
    await db.query(
      `INSERT INTO authorized_targets (id, origin, product_path_prefix, label, fixture_version, owner_reference, permission_record)
       VALUES ($1, $2, $3, $4, $1, 'aislerun-project', 'Operated by the AisleRun project (synthetic fixture)')
       ON CONFLICT (id) DO UPDATE SET origin = EXCLUDED.origin, product_path_prefix = EXCLUDED.product_path_prefix, label = EXCLUDED.label, is_active = true`,
      [fixture.version, origin, `/v/${fixture.version}/products/`, `${fixture.version}: ${fixture.disclosure}`],
    );
  }
}
