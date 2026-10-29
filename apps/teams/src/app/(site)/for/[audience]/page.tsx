import { notFound } from 'next/navigation';
import { ArcCta, AudienceLanding, LeadForm } from '@/design';
import { ARC_LINKS } from '@/lib/arc';
import { AUDIENCES, audienceBySlug } from '@/lib/audiences';

export const dynamicParams = false;
export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ audience: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }) {
  const a = audienceBySlug((await params).audience);
  if (!a) return {};
  return {
    title: a.metaTitle,
    description: a.metaDescription,
    alternates: { canonical: `/for/${a.slug}` },
    openGraph: { title: a.metaTitle, description: a.metaDescription, url: `/for/${a.slug}`, type: 'website' },
    twitter: { card: 'summary_large_image', title: a.metaTitle, description: a.metaDescription },
  };
}

export default async function AudiencePage({ params }: { params: Promise<{ audience: string }> }) {
  const a = audienceBySlug((await params).audience);
  if (!a) notFound();
  return (
    <AudienceLanding content={a} app="ai-fit-teams">
      <ArcCta links={ARC_LINKS} app="ai-fit-teams" placement={`for-${a.slug}`} />
      <LeadForm endpoint="/api/leads" app="ai-fit-teams" page={`for/${a.slug}`} />
    </AudienceLanding>
  );
}
