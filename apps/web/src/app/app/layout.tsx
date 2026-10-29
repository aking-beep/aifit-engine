"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Bookmark, CreditCard, GitCompare, History, Home, LayoutList, Settings, Settings2, UserRound, Workflow } from "lucide-react";
import { AppShell, Banner, Skeleton, type NavGroup } from "@/design";
import { AccountGate, useAccount } from "@/components/app/account-context";
import { planLabel } from "@/lib/account";

const ic = { size: 16, strokeWidth: 1.5 } as const;
const NAV: NavGroup[] = [
  { items: [
    { id: "", label: "Home", icon: <Home {...ic} />, href: "/app" },
    { id: "profile", label: "AI profile", icon: <UserRound {...ic} />, href: "/app/profile" },
  ] },
  { label: "Recommendations", items: [
    { id: "tools", label: "Recommended tools", icon: <LayoutList {...ic} />, href: "/app/tools" },
    { id: "compare", label: "Compare", icon: <GitCompare {...ic} />, href: "/app/compare" },
    { id: "workflows", label: "Workflows", icon: <Workflow {...ic} />, href: "/app/workflows" },
    { id: "saved", label: "Saved", icon: <Bookmark {...ic} />, href: "/app/saved" },
  ] },
  { label: "Set up", items: [
    { id: "configure", label: "Configurations", icon: <Settings2 {...ic} />, href: "/app/configure" },
    { id: "history", label: "Assessment history", icon: <History {...ic} />, href: "/app/history" },
  ] },
  { label: "Account", items: [
    { id: "subscription", label: "Subscription", icon: <CreditCard {...ic} />, href: "/app/subscription" },
    { id: "settings", label: "Settings", icon: <Settings {...ic} />, href: "/app/settings" },
  ] },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { me } = useAccount();
  const path = usePathname();
  const active = path.replace(/^\/app\/?/, "").split("/")[0] ?? "";
  const initials = (me.user.name || me.user.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  const free = me.account.plan === "free";
  return (
    <AppShell
      product="Consumer"
      nav={NAV}
      active={active}
      homeHref="/app"
      topRight={free && me.account.billing.pro_available ? (
        <Link href="/app/upgrade" className="hidden h-8 items-center gap-1.5 rounded-sm border border-line px-3 text-label-md text-fg hover:bg-sunken sm:inline-flex">
          Upgrade <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden />
        </Link>
      ) : null}
      sidebarFooter={
        <Link href="/app/settings" className="flex w-full items-center gap-2.5 rounded-sm p-1.5 text-left hover:bg-sunken">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-label-sm text-fg">{initials}</span>
          <span className="min-w-0">
            <span className="block truncate text-label-md text-fg">{me.user.name || me.user.email}</span>
            <span className="block text-label-sm text-fg-muted">{planLabel(me.account)} plan</span>
          </span>
        </Link>
      }
    >
      <div id="main-content" className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
        {me.account.billing.mode === "test" ? (
          <div className="mb-6"><Banner tone="warn" title="Stripe test mode">Use Stripe test cards. No real money moves.</Banner></div>
        ) : null}
        {children}
      </div>
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountGate
      fallback={(g) => (
        <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-16">
          {g.kind === "loading" ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading your account"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24 w-full" /></div>
          ) : g.kind === "unavailable" ? (
            <Banner tone="info" title="Accounts are not available on this deployment">
              {g.reason} The quiz, results and task check still work without an account: <Link className="underline" href="/assessment">take the quiz</Link>.
            </Banner>
          ) : (
            <Banner tone="danger" title="Could not load your account">{g.message}</Banner>
          )}
        </main>
      )}
    >
      <Shell>{children}</Shell>
    </AccountGate>
  );
}
