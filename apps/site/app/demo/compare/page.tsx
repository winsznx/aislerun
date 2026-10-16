import type { Metadata } from "next";
import { CompareView } from "@/components/run/CompareView";
import { RunState } from "@/components/run/RunState";
import { getDemoComparison } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Before and after" };

export default async function DemoComparePage() {
  const data = await getDemoComparison().catch(() => null);
  if (!data) return <RunState crumbs={{ href: "/demo", label: "Runs" }} label="Before and after" title="No published pair yet" body="The before and after comparison appears once a failed run and its paid retest are published." />;
  return <CompareView data={data} hrefs={{ before: `/demo/runs/${data.before.inspection_id}`, after: `/demo/runs/${data.after.inspection_id}` }} />;
}
