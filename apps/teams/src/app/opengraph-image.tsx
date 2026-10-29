import { ogCard, OG_SIZE } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'AI Fit Teams: should you build this?';

export default function Image() {
  return ogCard('AI Fit Teams', 'Should this workload use AI at all?', 'Verdict, build vs buy vs automate, run cost and the controls it needs before launch.');
}
