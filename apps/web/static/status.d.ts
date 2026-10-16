export declare const TERMINAL: string[];
export interface StatusInfo {
  kind: "live" | "report" | "stopped";
  title: string;
  now?: string;
  next?: string;
}
export declare function statusInfo(status: string): StatusInfo;
export declare function isTerminal(status: string): boolean;
export declare function blockerText(blocker: string | null): string | null;
export declare function viewportSummary(viewport: { verdict: string; blocker: string | null }): string;
export declare function actionText(action: string): string;
export declare function statusClass(result: string): string;
export declare function formatDuration(ms: number | null): string;
export declare function formatOffset(ms: number | null): string;
export declare function formatUtc(iso: string | null): string;
export declare function usdc(atomic: string | number): string;
export declare function summaryText(report: unknown): string;
