import { Chip, EvidenceLabel, Panel, PanelHeader } from '@/design';
import type { AssessmentView } from '@/server/assessment-view';
import { Bullets } from '../bits';

/** Controls derived from the data classes and the action surface. Status starts unverified; colour waits for evidence. */
export function SecuritySection({ view }: { view: AssessmentView }) {
  const s = view.a.security;
  const notAi = view.a.suitability.verdict === 'not-ai';
  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{s.level} risk</Chip>
          <span className="font-mono text-label-sm text-fg-muted">score {Math.round(s.score)}/100</span>
          <EvidenceLabel kind="estimated" />
          {s.complianceFlags.map((f) => <Chip key={f}>{f}</Chip>)}
        </div>
        <h1 className="mt-2 text-headline-lg text-fg">Security</h1>
        <p className="mt-1.5 max-w-3xl text-body-md text-fg-muted">Derived from the data classes and the action surface you described, not a generic checklist.</p>
      </header>
      {s.drivers.length ? (
        <Panel>
          <PanelHeader title="What drives the risk" />
          <div className="p-4"><Bullets items={s.drivers} /></div>
        </Panel>
      ) : null}
      <Panel>
        <PanelHeader title="Controls" description="A control nobody can verify after launch is a paragraph in a document. The last column says how each one is checked." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-body-sm">
            <caption className="sr-only">Security controls</caption>
            <thead>
              <tr className="border-b border-line text-left text-label-sm text-fg-muted">
                <th scope="col" className="px-4 py-2 font-medium">Control</th>
                <th scope="col" className="px-3 py-2 font-medium">Requirement</th>
                <th scope="col" className="px-3 py-2 font-medium">Why</th>
                <th scope="col" className="px-3 py-2 font-medium">{notAi ? 'How it is verified' : 'How ARC Control verifies it at runtime'}</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.controls.map((c) => (
                <tr key={c.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-2 font-mono text-fg-muted">{c.id}</td>
                  <td className="px-3 py-2 text-fg">{c.requirement}{c.blocking ? <span className="mt-1 block text-label-sm text-danger">blocks launch</span> : null}</td>
                  <td className="px-3 py-2 text-fg-2">{c.why}</td>
                  <td className="px-3 py-2 text-fg-2">{c.verifiedBy}</td>
                  <td className="px-4 py-2"><EvidenceLabel kind="untested" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
