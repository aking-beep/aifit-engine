"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { account, type Status } from "@/lib/account";

/** "Sign in" or "Dashboard" in the site header; nothing when accounts are off. */
export function AccountLink({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    account.status().then(setStatus).catch(() => setStatus(null));
  }, []);
  if (!status?.accounts.enabled) return null;
  return status.signed_in ? (
    <Link href="/app" className={className}>Dashboard</Link>
  ) : (
    <Link href="/signin" className={className}>Sign in</Link>
  );
}
