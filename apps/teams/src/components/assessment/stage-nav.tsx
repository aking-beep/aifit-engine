'use client';

import { useRouter } from 'next/navigation';
import { StageRail, type StageId } from '@/design';

/** The five-stage rail, each stage a link to its home section. */
export function StageNav({ current, hrefs }: { current: StageId; hrefs: Record<StageId, string> }) {
  const router = useRouter();
  const order: StageId[] = ['understand', 'decide', 'configure', 'validate', 'improve'];
  const completed = order.slice(0, order.indexOf(current));
  return <StageRail current={current} completed={completed} onSelect={(s) => router.push(hrefs[s])} />;
}
