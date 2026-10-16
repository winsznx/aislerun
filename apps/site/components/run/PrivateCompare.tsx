"use client";

import { useEffect, useState } from "react";
import { ApiError, getPrivateComparison } from "@/lib/api";
import type { Comparison } from "@/lib/types";
import { CompareView } from "./CompareView";
import { RunState } from "./RunState";
import { Workspace } from "./Workspace";
import run from "./run.module.css";

type View = { kind: "loading" } | { kind: "ready"; data: Comparison; tokens: [string, string] } | { kind: "error"; title: string; body: string };

export function PrivateCompare({ before, after }: { before: string; after: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const tokens: [string, string] = [params.get("before") ?? "", params.get("after") ?? ""];
    let cancelled = false;
    getPrivateComparison(before, after, tokens[0], tokens[1]).then(
      (data) => !cancelled && setView({ kind: "ready", data, tokens }),
      (error: unknown) => {
        if (cancelled) return;
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 409) setView({ kind: "error", title: "These runs can't be compared", body: (error as Error).message });
        else if (status === 401 || status === 403) setView({ kind: "error", title: "This comparison link isn't valid", body: "Both runs' read tokens are needed. AisleRun never makes a private report public to work around this." });
        else setView({ kind: "error", title: "Couldn't load the comparison", body: error instanceof Error ? error.message : "Unknown error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [before, after]);

  if (view.kind === "loading") return <Workspace crumbs={[{ href: "/demo", label: "Runs" }, { label: "Before and after" }]}><p className={run.caption}>Loading comparison…</p></Workspace>;
  if (view.kind === "error") return <RunState crumbs={{ href: "/demo", label: "Runs" }} label="Before and after" title={view.title} body={view.body} />;
  return <CompareView data={view.data} hrefs={{ before: `/runs/${before}#token=${view.tokens[0]}`, after: `/runs/${after}#token=${view.tokens[1]}` }} />;
}
