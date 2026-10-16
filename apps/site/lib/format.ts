export function duration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function offset(ms: number | null | undefined): string {
  if (ms == null) return "–";
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export function utc(iso: string | null | undefined, withSeconds = true): string {
  if (!iso) return "–";
  return `${new Date(iso).toISOString().replace("T", " ").slice(0, withSeconds ? 19 : 16)} UTC`;
}

export const usdc = (atomic: string | number) => `${(Number(atomic) / 1e6).toFixed(2)} USDC`;

export const shortHash = (hash: string | null | undefined, head = 10, tail = 6) => (hash ? `${hash.slice(0, head)}…${hash.slice(-tail)}` : "–");

export const basescan = (tx: string) => `https://basescan.org/tx/${tx}`;

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
