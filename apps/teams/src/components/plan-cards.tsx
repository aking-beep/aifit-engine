'use client';

import { useRouter } from 'next/navigation';
import { PricingCard, plansFor } from '@/design';

/** Plan cards for the public site. Each leads to the step that starts that plan; nothing is charged here. */
export function PublicPlanCards({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const target = (id: string) => (id === 'teams-workspace' ? (signedIn ? '/workspace/billing' : '/signup') : '/assess');
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plansFor('teams').map((p) => <PricingCard key={p.id} plan={p} onSelect={() => router.push(target(p.id))} />)}
    </div>
  );
}
