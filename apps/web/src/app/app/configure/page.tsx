"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, DownloadPreview, EngineProgress, EvidenceLabel, PageHeader, Panel, PanelHeader, useToast, type GeneratedFile } from "@/design";
import { useAccount } from "@/components/app/account-context";
import { Loading, LoadError, NoProfile, UpgradeNote } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account, AccountApiError, downloadBase64 } from "@/lib/account";
import { api } from "@/lib/api";

function language(path: string): GeneratedFile["language"] {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md") || path.endsWith(".mdc")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".sh")) return "bash";
  if (path.endsWith(".ts")) return "typescript";
  return "text";
}

/**
 * Previews the files the API generates for your profile (each one validated
 * and secret-scanned on the server), then downloads the full setup package.
 */
export default function Configure() {
  const { me, refresh } = useAccount();
  const toast = useToast();
  const { data, error, loading } = useLoad(() => account.profile());
  const [files, setFiles] = useState<GeneratedFile[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<{ files: number; redacted: number } | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const result = data?.entry?.result;
  useEffect(() => {
    if (!result) return;
    const targets = Array.from(new Set([...(result.install_guides ?? []).map((g) => g.export_target), "profile", "routing"]));
    Promise.all(targets.map((t) => api.exportPersona(t, result).then((f) => ({ path: f.filename, language: language(f.filename), content: f.content }) as GeneratedFile)))
      .then(setFiles)
      .catch((err) => setPreviewError(err instanceof Error ? err.message : "Could not generate the files."));
  }, [result]);

  if (loading) return <Loading label="Loading your profile" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  if (!result) return <><PageHeader title="Configuration generator" /><NoProfile /></>;

  const cap = me.account.limits.config_packages_per_month;
  const used = me.account.usage.config_packages_this_month;
  const download = async () => {
    setLimitMsg(null);
    try {
      const pkg = await account.package();
      downloadBase64(pkg.filename, pkg.content);
      setDownloaded({ files: pkg.manifest.files.length, redacted: pkg.manifest.secretsRedacted });
      toast({ title: "Setup package downloaded", tone: "success" });
      void refresh();
    } catch (err) {
      setLimitMsg(err instanceof AccountApiError ? err.message : "Could not build the package.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configuration generator" description="Instructions and config files written from your profile. Review every file before you paste or run anything." />
      {cap !== null ? <p className="text-body-sm text-fg-muted">Free plan: {Math.min(used, cap)} of {cap} setup package this month.</p> : null}
      {limitMsg ? <UpgradeNote>{limitMsg}</UpgradeNote> : null}
      {downloaded ? (
        <Banner tone="success" title="Package downloaded" action={<Link href="/app" className="text-label-md underline underline-offset-2">Back to dashboard</Link>}>
          {downloaded.files} files. {downloaded.redacted ? `${downloaded.redacted} secret-looking strings were redacted.` : "No secrets were found in it."} Open README in the ZIP first.
        </Banner>
      ) : null}
      {previewError ? <LoadError message={previewError} /> : !files ? (
        <div className="mx-auto max-w-md py-6"><EngineProgress steps={["Reading your profile", "Writing instructions for each app", "Validating every file", "Scanning for secrets"]} done={false} /></div>
      ) : (
        <DownloadPreview
          name="aifit-setup-package"
          files={files}
          meta={<span>{files.length} preview files · the ZIP adds prompt templates, a workflow and a README</span>}
          onDownload={download}
        />
      )}
      <Panel>
        <PanelHeader title="Check after setup" description="Nothing here has been tested on your machine yet." />
        <ul className="divide-y divide-line">
          {(result.install_guides ?? []).slice(0, 4).map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 text-body-sm">
              <span className="text-fg">{g.label}: instructions show up in a new chat</span>
              <EvidenceLabel kind="untested" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
