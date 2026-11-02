import { LegalPage } from "@/design";
import { ARC_LINKS } from "@/lib/arc";

export const metadata = { title: "Terms — AI Fit", description: "Terms of use for AI Fit by ARC Transformation Group." };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="2026-10-29">
      <p>These terms cover AI Fit, a service of ARC Transformation Group (&quot;ARC&quot;, &quot;we&quot;). By using it you agree to them.</p>
      <h2>What the service is</h2>
      <p>AI Fit recommends AI tools and models from a short quiz, generates setup instructions and files for the apps you use, and checks whether a task should use AI at all.</p>
      <h2>What the output is not</h2>
      <ul>
        <li>It is guidance, not professional advice. It is not a personality test, a clinical tool or a hiring screen.</li>
        <li>Tool facts come from a dated registry; check current prices and terms on each vendor&apos;s site before you buy.</li>
        <li>Generated files are text to review. Nothing runs on your device unless you choose to use it.</li>
      </ul>
      <h2>Accounts</h2>
      <p>Accounts are optional. Keep your password private; you are responsible for activity on your account.</p>
      <h2>AI Fit Pro</h2>
      <ul>
        <li>Pro is a monthly subscription, processed by Stripe. The price charged is the one on Stripe&apos;s checkout page.</li>
        <li>Pro starts when Stripe confirms the payment. Cancel any time from Subscription; see the <a href="/refunds">refund policy</a>.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service: no attempts to access other accounts, overload the service, or use it for unlawful purposes.</p>
      <h2>Liability</h2>
      <p>The service is provided as is. To the extent the law allows, ARC is not liable for decisions made on the basis of its output, and our total liability is limited to the amount you paid in the twelve months before a claim.</p>
      <h2>Changes and contact</h2>
      <p>We may update these terms and will change the date above when we do. Questions: <a href={ARC_LINKS.contact}>contact ARC</a>.</p>
    </LegalPage>
  );
}
