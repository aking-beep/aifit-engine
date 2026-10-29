import { notFound } from 'next/navigation';
import { decodeWorkload } from '@/lib/encode';
import { AssessmentScreen } from '@/components/assessment/screen';
import { isSection, viewFromLink } from '@/server/assessment-view';
import { BadLink } from '@/components/assessment/bad-link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assessment — AI Fit Teams' };

export default async function ReportSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ w?: string }> }) {
  const { section } = await params;
  if (!isSection(section) || section === 'verdict') notFound();
  const { w: encoded } = await searchParams;
  const workload = encoded ? decodeWorkload(encoded) : null;
  if (!workload || !encoded) return <BadLink />;
  return <AssessmentScreen view={await viewFromLink(encoded, workload)} section={section} />;
}
