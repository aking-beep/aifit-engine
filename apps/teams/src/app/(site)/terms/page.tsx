import { LegalPage } from '@/design';
import { ARC_LINKS } from '@/lib/arc';

export const metadata = { title: 'Terms — AI Fit Teams', description: 'Terms of use for AI Fit Teams by ARC Transformation Group.' };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="2026-10-29">
      <p>These terms cover AI Fit Teams, a service of ARC Transformation Group (&quot;ARC&quot;, &quot;we&quot;). By using it you agree to them.</p>
      <h2>What the service is</h2>
      <p>AI Fit Teams produces assessments of a workload you describe: a recommendation on whether to use AI, a comparison of options, cost estimates, risks, security and governance requirements, and an implementation blueprint.</p>
      <h2>What the output is not</h2>
      <ul>
        <li>It is decision support, not professional, legal, security or financial advice.</li>
        <li>Cost, savings and ROI figures are estimates from your inputs and published rules. Each is labelled with what it rests on. They are not guarantees.</li>
        <li>Security and governance items are recommendations. They are not enforced controls, audits or compliance attestations.</li>
      </ul>
      <h2>Your account and workspace</h2>
      <ul>
        <li>Keep your password private. You are responsible for activity in your workspace.</li>
        <li>Workspace owners and admins control membership and roles.</li>
        <li>Do not enter passwords, secrets, or personal data you are not allowed to share. The intake does not need them.</li>
      </ul>
      <h2>Payments</h2>
      <ul>
        <li>Assessments and blueprints are one-time purchases for one workload. The workspace plan is a monthly subscription.</li>
        <li>Payment is processed by Stripe. The price charged is the one on Stripe&apos;s checkout page.</li>
        <li>Access is granted when Stripe confirms the payment. See the <a href="/refunds">refund policy</a>.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service: no attempts to access other workspaces, overload the service, or use it for unlawful purposes.</p>
      <h2>Your content</h2>
      <p>You keep ownership of what you enter and of the deliverables generated for you. We use it only to provide the service, as described in the <a href="/privacy">privacy notice</a>.</p>
      <h2>Liability</h2>
      <p>The service is provided as is. To the extent the law allows, ARC is not liable for decisions made on the basis of its output, and our total liability is limited to the amount you paid in the twelve months before a claim.</p>
      <h2>Changes and contact</h2>
      <p>We may update these terms and will change the date above when we do. Questions: <a href={ARC_LINKS.contact}>contact ARC</a>.</p>
    </LegalPage>
  );
}
