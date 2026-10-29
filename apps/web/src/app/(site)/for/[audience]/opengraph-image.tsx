import { ogCard, OG_SIZE } from "@/lib/og";
import { AUDIENCES, audienceBySlug } from "@/lib/audiences";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "AI Fit";

export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ audience: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ audience: string }> }) {
  const a = audienceBySlug((await params).audience);
  return ogCard("AI Fit", a?.title ?? "Find the AI that fits you", a?.eyebrow ?? "A five-minute quiz");
}
