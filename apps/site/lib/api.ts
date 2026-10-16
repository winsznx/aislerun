import type { Comparison, DemoRun, Report } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://aislerun.158-220-85-120.sslip.io").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

// Evidence URLs inside reports are signed for 30 minutes, so nothing here is cached.
async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (!response.ok) throw new ApiError(response.status, body.code, body.message ?? `HTTP ${response.status}`);
  return body;
}

export async function getDemoRuns(): Promise<DemoRun[]> {
  try {
    return (await get<{ runs: DemoRun[] }>("/v1/demo/runs")).runs;
  } catch {
    return [];
  }
}

export const getDemoReport = (id: string) => get<Report>(`/v1/demo/reports/${encodeURIComponent(id)}`);
export const getDemoComparison = () => get<Comparison>("/v1/demo/comparison");

export function getPrivateReport(id: string, token: string) {
  return get<Report>(`/v1/reports/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
}

export function getPrivateComparison(before: string, after: string, beforeToken: string, afterToken: string) {
  return get<Comparison>(`/v1/comparisons/${encodeURIComponent(before)}/${encodeURIComponent(after)}`, {
    headers: { "X-Read-Tokens": `${beforeToken},${afterToken}` },
  });
}

export function getInspection<T>(id: string, token: string, path = "") {
  return get<T>(`/v1/inspections/${encodeURIComponent(id)}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}
