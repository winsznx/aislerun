// Canonical runs the operator chose to publish: DEMO_RUNS="failed:<id>,retest:<id>,control:<id>".
// Only these runs are readable through the /v1/demo endpoints, which never return read tokens.
export interface DemoRef {
  role: string;
  id: string;
}

export function parseDemoRuns(raw: string | undefined): DemoRef[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim().split(":"))
    .filter((p): p is [string, string] => p.length === 2 && /^[0-9a-f-]{36}$/.test(p[1] ?? ""))
    .map(([role, id]) => ({ role, id }));
}
