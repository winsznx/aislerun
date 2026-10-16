#!/usr/bin/env bash
# Commissions one real, PayBox-paid AisleRun inspection the way an agent does:
# free quote -> PayBox use_service (x402 payment) -> poll the result with the returned read token.
# Spends real USDC from the granted PayBox credential. Usage:
#   scripts/paybox-inspect.sh <service-base-url> <paybox-credential-id> <fixture-version> [client-reference]
set -euo pipefail

BASE="${1:?service base url}"
CREDENTIAL="${2:?paybox credential id}"
TARGET="${3:?fixture version, e.g. fixture-fixed-v2}"
REFERENCE="${4:-}"
FIXTURE_ORIGIN="${FIXTURE_ORIGIN:-https://aislerun-fixtures.vercel.app}"
PAYBOX="${PAYBOX:-npx --no-install paybox}"
OUT="${OUT_DIR:-$(mktemp -d)}"
PRODUCT_URL="$FIXTURE_ORIGIN/v/$TARGET/products/cup"

curl -fsS -X POST "$BASE/v1/quotes" -H 'content-type: application/json' \
  -d "{\"product_url\":\"$PRODUCT_URL\",\"authorized_target_id\":\"$TARGET\",\"profile\":\"shopify_checkout_entry_v1\"}" > "$OUT/quote.json"
QUOTE_ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).quote_id)' "$OUT/quote.json")
echo "quote $QUOTE_ID: $(node -e 'const q=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(q.price.amount, q.price.asset_symbol, "on", q.price.network)' "$OUT/quote.json")"

node -e 'const [q,u,t,r,k]=process.argv.slice(1);const b={quote_id:q,product_url:u,authorized_target_id:t,profile:"shopify_checkout_entry_v1",idempotency_key:k};if(r)b.client_reference=r;console.log(JSON.stringify(b))' \
  "$QUOTE_ID" "$PRODUCT_URL" "$TARGET" "$REFERENCE" "$(uuidgen | tr 'A-Z' 'a-z')" > "$OUT/body.json"

$PAYBOX use-service --json --wait --credential "$CREDENTIAL" --url "$BASE/v1/inspections" --method POST --body "@$OUT/body.json" > "$OUT/paybox.json"
node -e '
const d = JSON.parse(require("fs").readFileSync(process.argv[1]));
const r = d.response;
if (r.status !== "success") { console.error("PayBox did not complete:", r.status, JSON.stringify(r.error ?? r.next_action)); process.exit(1); }
const body = JSON.parse(r.output.value.response.body);
if (!body.ok) { console.error("AisleRun refused:", body.code, body.message); process.exit(1); }
require("fs").writeFileSync(process.argv[2], JSON.stringify(body));
console.log("paid:", r.output.value.payment.status, "| inspection", body.inspection_id);
' "$OUT/paybox.json" "$OUT/accepted.json"

ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).inspection_id)' "$OUT/accepted.json")
TOKEN=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).read_token)' "$OUT/accepted.json")
LAST=""
for _ in $(seq 1 90); do
  curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/v1/inspections/$ID" > "$OUT/status.json"
  STATUS=$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(s.status+(s.terminal?" terminal "+(s.overall_verdict??""):""))' "$OUT/status.json")
  [ "$STATUS" != "$LAST" ] && echo "status: $STATUS" && LAST="$STATUS"
  case "$STATUS" in *terminal*) break ;; esac
  sleep 2
done
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/v1/reports/$ID" > "$OUT/report.json"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log("verdict:", r.overall_verdict, r.viewports.map(v=>v.viewport+"="+v.verdict+(v.blocker?"("+v.blocker+")":"")).join(" "), "| settlement", r.payment.settlement_reference)' "$OUT/report.json"
echo "report: $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).report_url)' "$OUT/accepted.json")"
echo "artifacts in $OUT"
