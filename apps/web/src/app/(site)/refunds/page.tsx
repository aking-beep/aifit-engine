import { LegalPage } from "@/design";
import { ARC_LINKS } from "@/lib/arc";

export const metadata = { title: "Refund policy — AI Fit", description: "How refunds and cancellations work for AI Fit Pro." };

export default function Refunds() {
  return (
    <LegalPage title="Refund policy" updated="2026-10-29">
      <h2>AI Fit Pro (monthly)</h2>
      <ul>
        <li>Cancel at any time from Subscription. You keep Pro until the end of the period you paid for, and you are not charged again.</li>
        <li>If you were charged by mistake, or twice, we refund it in full.</li>
        <li>New subscribers can ask for a full refund of their first payment within 14 days.</li>
        <li>We do not refund part-used months otherwise, except where the law requires it. A refunded payment ends Pro access.</li>
      </ul>
      <h2>How to ask</h2>
      <p>Write to us through the <a href={ARC_LINKS.contact}>ARC contact page</a> with the email on your account. Refunds go back to the original card through Stripe and usually appear within 5–10 business days.</p>
      <h2>Your legal rights</h2>
      <p>Nothing here limits rights you have under consumer law where you live.</p>
    </LegalPage>
  );
}
