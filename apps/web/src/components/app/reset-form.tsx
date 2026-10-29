"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Banner, Button, TextInput } from "@/design";
import { account, AccountApiError } from "@/lib/account";

/** Without ?token: ask for the email. With it: choose the new password. */
export function ResetForm() {
  const raw = useSearchParams().get("token");
  const token = raw && /^[A-Za-z0-9_-]{20,200}$/.test(raw) ? raw : null;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (token) {
        await account.completeReset(token, value);
        setDone("Password changed. Every session was signed out, so sign in again.");
      } else {
        setDone((await account.requestReset(value)).message);
      }
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-headline-lg text-fg">{token ? "Choose a new password" : "Reset your password"}</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <Banner tone="success" title={token ? "Done" : "Check your email"}>{done}</Banner>
          {token ? <Link href="/signin" className="text-accent underline underline-offset-2">Sign in</Link> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
          {token ? (
            <TextInput label="New password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters." required value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <TextInput label="Email" type="email" autoComplete="email" required value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" loading={busy} disabled={busy || !value}>{token ? "Set new password" : "Send reset link"}</Button>
          {!token ? <p className="text-body-sm text-fg-muted">The link works once, for 30 minutes.</p> : null}
        </form>
      )}
    </div>
  );
}
