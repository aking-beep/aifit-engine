"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { account, AccountApiError, type Me } from "@/lib/account";

type Ctx = { me: Me; refresh: () => Promise<void> };
const AccountCtx = createContext<Ctx | null>(null);

export function useAccount(): Ctx {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount outside AccountGate");
  return ctx;
}

type Gate = { kind: "loading" } | { kind: "ready"; me: Me } | { kind: "unavailable"; reason: string } | { kind: "error"; message: string };

/** Loads the signed-in account; sends anyone signed out to /signin and back. */
export function AccountGate({ children, fallback }: { children: React.ReactNode; fallback: (g: Exclude<Gate, { kind: "ready" }>) => React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [gate, setGate] = useState<Gate>({ kind: "loading" });

  const refresh = useCallback(async () => {
    try {
      const me = await account.me();
      setGate({ kind: "ready", me });
    } catch (err) {
      if (err instanceof AccountApiError && err.status === 401) {
        router.replace(`/signin?next=${encodeURIComponent(path)}`);
        return;
      }
      if (err instanceof AccountApiError && err.status === 503) {
        setGate({ kind: "unavailable", reason: err.message });
        return;
      }
      setGate({ kind: "error", message: err instanceof Error ? err.message : "Could not load your account." });
    }
  }, [router, path]);

  useEffect(() => {
    let cancelled = false;
    account.me().then(
      (me) => !cancelled && setGate({ kind: "ready", me }),
      () => !cancelled && void refresh(),
    );
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (gate.kind !== "ready") return <>{fallback(gate)}</>;
  return <AccountCtx.Provider value={{ me: gate.me, refresh }}>{children}</AccountCtx.Provider>;
}
