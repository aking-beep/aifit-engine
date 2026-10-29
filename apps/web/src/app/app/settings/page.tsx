"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, KeyValue, Modal, PageHeader, Panel, PanelHeader, Select, TextInput, ThemeToggle, useToast } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { date } from "@/components/app/bits";
import { account, AccountApiError, downloadJson, type Role } from "@/lib/account";

const ROLES: { value: Role; label: string }[] = [
  { value: "individual", label: "Professional" },
  { value: "engineer", label: "Developer" },
  { value: "creator", label: "Creator" },
  { value: "student", label: "Student" },
  { value: "freelancer", label: "Freelancer" },
  { value: "small_business_owner", label: "Business owner" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
  { value: "other", label: "Something else" },
];

export default function Settings() {
  const { me, refresh } = useAccount();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(me.user.name);
  const [role, setRole] = useState<Role>(me.user.role ?? "individual");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await account.update({ name, role });
      await refresh();
      toast({ title: "Saved", tone: "success" });
    } catch (err) {
      toast({ title: "Could not save", body: err instanceof Error ? err.message : undefined, tone: "warn" });
    }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await account.changePassword(current, next);
      setPwMsg("Password changed.");
      setCurrent("");
      setNext("");
    } catch (err) {
      setPwMsg(err instanceof AccountApiError ? err.message : "Could not change the password.");
    }
  };
  const signOut = async () => {
    await account.logout().catch(() => null);
    router.replace("/");
  };
  const remove = async () => {
    await account.deleteAccount();
    router.replace("/?deleted=account");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account settings" actions={<Button onClick={signOut}>Sign out</Button>} />
      <Panel>
        <PanelHeader title="Profile" />
        <form onSubmit={saveProfile} className="grid gap-4 p-4 sm:grid-cols-2">
          <TextInput label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <Select label="What best describes you" value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLES} hint="Pre-fills the task check. The quiz never reads it." />
          <dl className="sm:col-span-2"><KeyValue label="Email">{me.user.email}</KeyValue><KeyValue label="Member since">{date(me.user.created_at)}</KeyValue></dl>
          <div><Button type="submit" variant="primary">Save profile</Button></div>
        </form>
      </Panel>
      <Panel>
        <PanelHeader title="Password" />
        <form onSubmit={changePw} className="grid gap-4 p-4 sm:grid-cols-2">
          <TextInput label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <TextInput label="New password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters." value={next} onChange={(e) => setNext(e.target.value)} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={!current || next.length < 10}>Change password</Button>
            {pwMsg ? <p role="status" className="text-body-sm text-fg-2">{pwMsg}</p> : null}
          </div>
        </form>
      </Panel>
      <Panel>
        <PanelHeader title="Appearance" actions={<ThemeToggle />} />
        <p className="p-4 text-body-sm text-fg-muted">Dark by default; your choice is kept in this browser.</p>
      </Panel>
      <Panel>
        <PanelHeader title="Your data" />
        <div className="space-y-4 p-4">
          <p className="text-body-sm text-fg-2">Download everything this account stores as JSON: profile, history, saved items and payment records. Passwords and session tokens are never included.</p>
          <Button onClick={async () => downloadJson("aifit-account-export.json", await account.exportAll())}>Download my data</Button>
          <div className="border-t border-line pt-4">
            <Banner tone="danger" title="Delete account" action={<Button variant="danger" size="sm" onClick={() => setConfirm(true)}>Delete account</Button>}>
              Removes your account, history and saved items now. Stripe keeps its own records of past payments. Cancel Pro first if it is active.
            </Banner>
          </div>
        </div>
      </Panel>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete your account?"
        description="This cannot be undone."
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep account</Button><Button variant="danger" onClick={remove}>Delete account</Button></>}
      />
    </div>
  );
}
