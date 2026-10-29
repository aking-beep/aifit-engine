"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Code2, GraduationCap, Palette, Rocket, User, Users } from "lucide-react";
import { Banner, Button, ProgressBar, TextInput, cn } from "@/design";
import { account, AccountApiError, type Me, type Role } from "@/lib/account";

const ROLES: { id: Role; label: string; line: string; icon: React.ReactNode }[] = [
  { id: "engineer", label: "Developer", line: "Code, review, ship", icon: <Code2 size={20} strokeWidth={1.5} /> },
  { id: "creator", label: "Creator", line: "Design, video, writing", icon: <Palette size={20} strokeWidth={1.5} /> },
  { id: "individual", label: "Professional", line: "Docs, email, analysis", icon: <Briefcase size={20} strokeWidth={1.5} /> },
  { id: "student", label: "Student", line: "Study, research, notes", icon: <GraduationCap size={20} strokeWidth={1.5} /> },
  { id: "small_business_owner", label: "Business owner", line: "Run and grow a business", icon: <Rocket size={20} strokeWidth={1.5} /> },
  { id: "manager", label: "Manager", line: "Lead a team", icon: <Users size={20} strokeWidth={1.5} /> },
  { id: "other", label: "Something else", line: "None of these fit", icon: <User size={20} strokeWidth={1.5} /> },
];

/** Two questions, saved to the account, then the quiz. Signed-out visitors are sent to sign up first. */
export default function Onboarding() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    account
      .me()
      .then((m) => {
        setMe(m);
        setName(m.user.name);
        setRole(m.user.role);
      })
      .catch((err) => {
        if (err instanceof AccountApiError && err.status === 401) router.replace("/signup?next=/onboarding");
        else setError(err instanceof Error ? err.message : "Could not load your account.");
      });
  }, [router]);

  const finish = async () => {
    setBusy(true);
    try {
      await account.update({ name, ...(role ? { role } : {}) });
      router.push("/assessment?save=account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  };

  if (error) return <div className="mx-auto max-w-xl px-4 py-16"><Banner tone="danger" title="Onboarding unavailable">{error} <Link className="underline" href="/assessment">Take the quiz without an account</Link>.</Banner></div>;
  if (!me) return <p className="mx-auto max-w-xl px-4 py-16 text-fg-muted">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <p className="text-label-sm text-fg-muted">About you · {step + 1} of 2</p>
      <ProgressBar value={((step + 1) / 2) * 100} label="Onboarding progress" className="mt-2 h-1" />
      {step === 0 ? (
        <section className="mt-8">
          <h1 className="text-headline-lg text-fg">Let’s personalise your assessment.</h1>
          <p className="mt-2 text-body-md text-fg-muted">Next comes a five-minute quiz. We score how you choose, not what you say about yourself.</p>
          <div className="mt-8"><TextInput label="What should we call you?" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <Button variant="primary" className="mt-6" onClick={() => setStep(1)}>Continue</Button>
        </section>
      ) : (
        <section className="mt-8">
          <h1 className="text-headline-lg text-fg">What best describes you{name ? `, ${name}` : ""}?</h1>
          <p className="mt-2 text-body-md text-fg-muted">Used to pre-fill the “Should I use AI?” task check. The quiz does not read it.</p>
          <div role="radiogroup" aria-label="Role" className="mt-8 grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={role === r.id}
                onClick={() => setRole(r.id)}
                className={cn("flex items-start gap-3 rounded-md border p-4 text-left transition-colors duration-150", role === r.id ? "border-accent bg-accent-subtle" : "border-line bg-surface hover:border-line-strong")}
              >
                <span className="text-fg-muted" aria-hidden>{r.icon}</span>
                <span>
                  <span className="block text-body-md font-medium text-fg">{r.label}</span>
                  <span className="block text-body-sm text-fg-muted">{r.line}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button variant="primary" loading={busy} onClick={finish}>Start the quiz</Button>
          </div>
        </section>
      )}
    </div>
  );
}
