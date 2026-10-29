import { notFound, redirect } from 'next/navigation';
import { PlatformError } from '@aifit/platform';
import { AssessmentScreen } from '@/components/assessment/screen';
import { isSection, viewFromSaved } from '@/server/assessment-view';
import { currentViewer, storeResolution } from '@/server/platform';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved assessment — AI Fit Teams' };

export default async function SavedAssessmentSection({ params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!isSection(section) || section === 'verdict') notFound();
  if (!storeResolution().store) return null;
  const v = await currentViewer();
  if (!v) redirect(`/signin?next=/workspace/assessments/${encodeURIComponent(id)}/${section}`);
  const view = await viewFromSaved(id, v).catch((e) => {
    if (e instanceof PlatformError && e.code === 'not_found') notFound();
    throw e;
  });
  return <AssessmentScreen view={view} section={section} />;
}
