import type { ReactNode } from "react";
import { tagTone } from "@/lib/status";

export function VerdictTag({ verdict, children }: { verdict: string | null | undefined; children?: ReactNode }) {
  return <span className={`tag ${tagTone(verdict)}`}>{children ?? (verdict ?? "No verdict")}</span>;
}

export function Tag({ tone, children }: { tone: "pass" | "fail" | "unsure" | "neutral" | "paid" | "fixture"; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
