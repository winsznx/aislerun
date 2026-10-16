import type { Metadata } from "next";
import { PrivateRun } from "@/components/run/PrivateRun";

export const metadata: Metadata = { title: "Shopper run", robots: { index: false, follow: false } };

export default async function PrivateRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrivateRun id={id} />;
}
