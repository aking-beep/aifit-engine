import { Panel } from '@/components/kit';

export const metadata = { title: 'Privacy — AI Fit Teams' };

export default function Privacy() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fg">Privacy</h1>
      <Panel title="Without an account">
        <p className="text-sm leading-relaxed text-fg-2">
          Nothing you enter is stored. The intake is encoded into the report link and recalculated every time the link
          is opened. Anyone with the link can read the report, so share it as you would the answers themselves.
        </p>
      </Panel>
      <Panel title="With a workspace">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-2">
          <li>Your name, email, a scrypt hash of your password, and your workspace memberships.</li>
          <li>Assessments you save: the answers, every version, and a snapshot of the verdict and the engine versions.</li>
          <li>The workspace profile you give at setup (industry, size, regions, data classes, regimes, engineer count) and the owners, status and mitigations you record on a risk register.</li>
          <li>Sign-in sessions, stored only as hashes of the session token, for up to 14 days.</li>
          <li>An activity log per workspace (saves, exports, membership and billing changes), visible to admins.</li>
          <li>If billing is on: what was bought, the subscription status, and a payment history (amounts, dates, outcomes) as reported by Stripe. Card details stay with Stripe; this app never sees them.</li>
          <li>Rate-limit counters keyed by a hash of the email or network address, kept for minutes.</li>
        </ul>
      </Panel>
      <Panel title="Your controls">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-2">
          <li>Download everything stored about you from the Account page.</li>
          <li>Delete your account from the Account page. Workspaces only you belong to are deleted with their data.</li>
          <li>Admins can delete any saved assessment, with all its versions.</li>
        </ul>
      </Panel>
      <Panel title="AI assistance (off unless the operator turns it on)">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-2">
          <li>“Suggest answers” sends the job&apos;s name and description to Anthropic&apos;s API. Suggestions change the form only when you click Apply.</li>
          <li>“Explain this in plain language” sends the structured decision, never the description, and cannot change the decision.</li>
          <li>Neither is stored by this app. Logs record a hash of the request, not its content.</li>
        </ul>
      </Panel>
      <Panel title="What is never done">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-2">
          <li>
            Scoring is rules in this codebase; no language model scores or decides anything. Answers are sent to a model
            only if the operator turned on AI assistance and you click one of its buttons (see below).
          </li>
          <li>Nothing is sold or shared with vendors that appear in a recommendation. No vendor pays for placement.</li>
          <li>Exports to ARC Control happen only when an admin starts one, and only to an endpoint the operator configured.</li>
        </ul>
      </Panel>
    </div>
  );
}
