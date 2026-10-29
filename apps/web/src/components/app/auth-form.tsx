"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, TextInput } from "@/design";
import { account, AccountApiError, type Status } from "@/lib/account";

/** Only same-site paths are followed after sign-in. */
export function safeNext(raw: string | null, fallback = "/app"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), mode === "signup" ? "/onboarding" : "/app");
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    account.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await account.signup(email, password, name);
      else await account.login(email, password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const off = status && !status.accounts.enabled;
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-headline-lg text-fg">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <p className="mt-2 text-body-md text-fg-muted">
        {mode === "signup"
          ? "Keep your AI profile, saved tools and setup packages in one place. The quiz works without an account too."
          : "Welcome back."}
      </p>
      {off ? (
        <div className="mt-6"><Banner tone="info" title="Accounts are not available on this deployment">{status.accounts.reason}</Banner></div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
          {mode === "signup" ? <TextInput label="Name (optional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /> : null}
          <TextInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 10 : 1}
            hint={mode === "signup" ? "At least 10 characters." : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" loading={busy} disabled={busy || !email || !password}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-body-sm text-fg-muted">
        {mode === "signup" ? (
          <>Already have an account? <Link className="text-accent underline underline-offset-2" href={`/signin?next=${encodeURIComponent(next)}`}>Sign in</Link></>
        ) : (
          <>New here? <Link className="text-accent underline underline-offset-2" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>
        )}
      </p>
    </div>
  );
}
