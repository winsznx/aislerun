import type { Metadata } from "next";
import { PrivateCompare } from "@/components/run/PrivateCompare";

export const metadata: Metadata = { title: "Before and after", robots: { index: false, follow: false } };

export default async function PrivateComparePage({ params }: { params: Promise<{ id: string; otherId: string }> }) {
  const { id, otherId } = await params;
  return <PrivateCompare before={id} after={otherId} />;
}
