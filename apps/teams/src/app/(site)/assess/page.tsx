import { Intake } from '@/components/intake';
import { decodeWorkload } from '@/lib/encode';
import { parseStep, stateFromWorkload, type IntakeState } from '@/lib/intake-state';
import { readOrgProfile } from '@aifit/platform';
import { currentViewer, storeResolution } from '@/server/platform';

export const metadata = { title: 'Assess a workload — AI Fit Teams' };

/**
 * `?w=` is a report's "Edit answers" link (or the short-circuit's "Continue the
 * full assessment"). It is decoded here because the codec needs Buffer; the
 * client form only ever receives plain intake state.
 */
export default async function Assess({
  searchParams,
}: {
  searchParams: Promise<{ w?: string | string[]; step?: string | string[]; reassess?: string | string[] }>;
}) {
  const { w, step, reassess } = await searchParams;
  const encoded = typeof w === 'string' && w.length > 0 ? w : null;
  const workload = encoded ? decodeWorkload(encoded) : null;
  const defaults = workload ? null : await profileDefaults();
  return (
    <Intake
      defaults={defaults}
      initial={workload ? stateFromWorkload(workload) : null}
      initialStep={parseStep(step)}
      badLink={encoded !== null && workload === null}
      reassess={typeof reassess === 'string' && /^asm_[A-Za-z0-9]{1,32}$/.test(reassess) ? reassess : null}
    />
  );
}

/** The signed-in workspace's profile as intake defaults. Null without a workspace or profile. */
async function profileDefaults(): Promise<Partial<IntakeState> | null> {
  const { store } = storeResolution();
  if (!store) return null;
  const v = await currentViewer().catch(() => null);
  if (!v) return null;
  const p = await readOrgProfile(store, v.ctx).catch(() => null);
  if (!p) return null;
  const out: Partial<IntakeState> = { dataResidency: p.dataResidency };
  if (p.dataClasses.length) out.dataClasses = p.dataClasses as IntakeState['dataClasses'];
  if (p.regulated.length) out.regulated = p.regulated as IntakeState['regulated'];
  if (p.engineers !== null) out.engineers = p.engineers;
  return out;
}
