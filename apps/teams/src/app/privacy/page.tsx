import { Panel } from '@aifit/ui';

export const metadata = { title: 'Privacy — AI Fit Teams' };

export default function Privacy() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink-100">Privacy</h1>
      <Panel title="Without an account">
        <p className="text-sm leading-relaxed text-ink-300">
          Nothing you enter is stored. The intake is encoded into the report link and recalculated every time the link
          is opened. Anyone with the link can read the report, so share it as you would the answers themselves.
        </p>
      </Panel>
      <Panel title="With a workspace">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
          <li>Your name, email, a scrypt hash of your password, and your workspace memberships.</li>
          <li>Assessments you save: the answers, every version, and a snapshot of the verdict and the engine versions.</li>
          <li>Sign-in sessions, stored only as hashes of the session token, for up to 14 days.</li>
          <li>An activity log per workspace (saves, exports, membership and billing changes), visible to admins.</li>
          <li>If billing is on: what was bought and the subscription status. Card details stay with Stripe; this app never sees them.</li>
          <li>Rate-limit counters keyed by a hash of the email or network address, kept for minutes.</li>
        </ul>
      </Panel>
      <Panel title="Your controls">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
          <li>Download everything stored about you from the Account page.</li>
          <li>Delete your account from the Account page. Workspaces only you belong to are deleted with their data.</li>
          <li>Admins can delete any saved assessment, with all its versions.</li>
        </ul>
      </Panel>
      <Panel title="What is never done">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
          <li>Answers are not sent to a language model. Scoring is rules in this codebase.</li>
          <li>Nothing is sold or shared with vendors that appear in a recommendation. No vendor pays for placement.</li>
          <li>Exports to ARC Control happen only when an admin starts one, and only to an endpoint the operator configured.</li>
        </ul>
      </Panel>
    </div>
  );
}
