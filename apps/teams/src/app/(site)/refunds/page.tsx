import { LegalPage } from '@/design';
import { ARC_LINKS } from '@/lib/arc';

export const metadata = { title: 'Refund policy — AI Fit Teams', description: 'How refunds and cancellations work for AI Fit Teams.' };

export default function Refunds() {
  return (
    <LegalPage title="Refund policy" updated="2026-10-29">
      <h2>Assessments and blueprints (one-time)</h2>
      <ul>
        <li>If something went wrong (a failed download, a charge for the wrong workload, a duplicate charge), we refund it in full.</li>
        <li>Otherwise, ask within 14 days of purchase and we will refund it. A refunded purchase no longer unlocks its sections or downloads.</li>
      </ul>
      <h2>Workspace plan (monthly)</h2>
      <ul>
        <li>Cancel at any time. You keep access until the end of the period you paid for, and you are not charged again.</li>
        <li>We do not refund part-used months, except where the law requires it or when the service was unavailable to you.</li>
      </ul>
      <h2>How to ask</h2>
      <p>Write to us through the <a href={ARC_LINKS.contact}>ARC contact page</a> with the email on your account and the date of the charge. Refunds go back to the original card through Stripe and usually appear within 5–10 business days.</p>
      <h2>Your legal rights</h2>
      <p>Nothing here limits rights you have under consumer law where you live.</p>
    </LegalPage>
  );
}
