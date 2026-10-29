"use client";

import Link from "next/link";
import { PageHeader } from "@/design";
import { ResultsView } from "@/components/results-view";
import { Loading, LoadError, NoProfile, UpgradeNote, date } from "@/components/app/bits";
import { useLoad } from "@/components/app/use-load";
import { account } from "@/lib/account";

/** The saved quiz result, shown with the same results view as /results, minus session controls. */
export default function Profile() {
  const { data, error, loading } = useLoad(() => account.profile());
  if (loading) return <Loading label="Loading your profile" />;
  if (error || !data) return <LoadError message={error ?? "No data."} />;
  if (!data.entry) return <><PageHeader title="Your AI profile" /><NoProfile /></>;
  const { entry } = data;
  return (
    <div>
      <PageHeader
        title="Your AI profile"
        description={<>Scored by the engine from your quiz answers on <time dateTime={entry.saved_at}>{date(entry.saved_at)}</time>.</>}
        actions={<Link href="/assessment?save=account" className="inline-flex h-9 items-center rounded-sm border border-line px-3.5 text-label-md text-fg hover:bg-sunken">Retake the quiz</Link>}
      />
      {entry.result.locked_products ? (
        <div className="mb-6"><UpgradeNote>{entry.result.locked_products} more tool matches are available on Pro.</UpgradeNote></div>
      ) : null}
      <div className="-mx-4">
        <ResultsView result={entry.result} />
      </div>
    </div>
  );
}
