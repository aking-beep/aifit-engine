import Link from 'next/link';
import { shapesDecideNotAi } from '@aifit/teams-core';
import { Panel } from '@/design';
import { decodeWorkload } from '@/lib/encode';
import { ReportPrintStyles, intakeHref } from '@/components/report-footer';
import { VerdictOnlyReport } from '@/components/report-verdict-only';
import { AssessmentScreen } from '@/components/assessment/screen';
import { viewFromLink } from '@/server/assessment-view';
import { BadLink } from '@/components/assessment/bad-link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assessment — AI Fit Teams' };

/** The report from a link: the intake is in `?w=`, recalculated on every open, stored nowhere. */
export default async function Report({ searchParams }: { searchParams: Promise<{ w?: string; scope?: string; reassess?: string }> }) {
  const { w: encoded, scope, reassess } = await searchParams;
  const workload = encoded ? decodeWorkload(encoded) : null;
  if (!workload || !encoded) return <BadLink />;

  // `scope=verdict` is the intake's short-circuit: every answer after the
  // shapes is a placeholder. Any other value is treated as absent.
  if (scope === 'verdict') {
    if (!shapesDecideNotAi(workload.task)) {
      return (
        <Panel className="p-6">
          <h1 className="text-headline-md text-fg">This link asks for a verdict the shapes cannot decide</h1>
          <p className="mt-2 text-body-md text-fg-2">
            A verdict-only report exists for work that is only lookup and calculation. This job includes other shapes, so its verdict
            depends on answers the link does not carry.{' '}
            <Link href={intakeHref(encoded, 1)} className="text-accent underline underline-offset-2">Continue the full assessment</Link>.
          </p>
        </Panel>
      );
    }
    return (
      <>
        <ReportPrintStyles />
        <VerdictOnlyReport workload={workload} encoded={encoded} />
      </>
    );
  }
  return <AssessmentScreen view={await viewFromLink(encoded, workload, typeof reassess === 'string' ? reassess : null)} section="verdict" />;
}
