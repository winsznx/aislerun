import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/run/ReportView";
import { getDemoRuns } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run AR-${id.slice(0, 8).toUpperCase()}` };
}

export default async function DemoRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runs = await getDemoRuns();
  const entry = runs.find((r) => r.report.inspection_id === id);
  if (!entry) notFound();
  const paired = runs.some((r) => r.role === "failed") && runs.some((r) => r.role === "retest");
  const compareHref = paired && (entry.role === "failed" || entry.role === "retest") ? "/demo/compare" : undefined;
  return <ReportView report={entry.report} compareHref={compareHref} crumbs={{ href: "/demo", label: "Runs" }} />;
}
