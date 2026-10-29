"use client";

import Link from "next/link";
import { Banner, EmptyState, Skeleton } from "@/design";
import type { Recommendation } from "@/lib/types";

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return <Banner tone="danger" title="Could not load this">{message}</Banner>;
}

export function NoProfile() {
  return (
    <EmptyState
      title="No AI profile yet"
      description="Take the five-minute quiz and save it to your account. Your recommendations, workflows and setup packages come from it."
      action={<Link href="/assessment?save=account" className="inline-flex h-9 items-center rounded-sm bg-accent px-3.5 text-label-md text-on-accent">Take the quiz</Link>}
    />
  );
}

export function UpgradeNote({ children }: { children: React.ReactNode }) {
  return (
    <Banner tone="info" title="Free plan" action={<Link href="/app/upgrade" className="text-label-md text-accent underline underline-offset-2">See Pro</Link>}>
      {children}
    </Banner>
  );
}

export const pct = (v: number | null | undefined) => (typeof v === "number" ? `${Math.round(v * 100)}` : "—");

export const CATEGORY: Record<string, string> = {
  general_assistant: "Assistant",
  coding_agent: "Coding",
  ide: "Coding",
  automation: "Automation",
  research: "Research",
  writing: "Writing",
  local: "Local",
};
export const category = (r: Pick<Recommendation, "category">) => (r.category ? CATEGORY[r.category] ?? r.category.replace(/_/g, " ") : "Tool");

export const date = (iso: string) => iso.slice(0, 10);
