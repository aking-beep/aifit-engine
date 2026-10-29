import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="text-muted-foreground">
        Without an account, Fit runs in anonymous mode. It does not ask for your name, an account, your employer, or
        demographic attributes, and it does not infer protected characteristics. Accounts are optional.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>What is stored</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Your answers — the choices you pick and any notes you type — are saved on our server under a random,
            anonymous session ID for up to 30 days, or until you delete them. A copy is also kept in this browser.
          </p>
          <p>
            Share links hold a snapshot of your scores and suggestions for 30 days. They do not include your notes or
            your raw answers.
          </p>
          <p>
            Notes are scored on our server. They are only sent to a third-party AI classifier if the operator of this
            site turns on the optional LLM classifier (<code>AIFIT_LLM_CLASSIFIER</code>). It is off by default.
          </p>
          <p>Feedback stores a 1–5 rating and an optional comment. Do not include identifying details.</p>
          <p>
            The task check (“Should I use AI?”) is not stored on our server. Its result, and your history list, are kept
            only in this browser; you can delete them from the History page.
          </p>
          <p>
            If the operator of this site turns on AI assistance (<code>AIFIT_AGENTS</code>, off by default), two buttons
            appear on the task check. “Suggest answers” sends the description you typed to Anthropic&apos;s API;
            “Explain this result” sends the structured result, never your description. Neither is stored by Fit, and our
            logs record only a fingerprint (hash) of the request. Suggestions fill the form only when you click Apply.
          </p>
          <p>
            To see whether Fit is useful, the site counts anonymous events such as “quiz completed” or “setup
            downloaded”. Each count is only the event name — no session ID, IP address, or anything you typed.
          </p>
          <p>
            Downloaded setup files are checked for anything that looks like a password or API key before you get them,
            and any match is replaced with [REDACTED].
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>If you create an account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            We store your email, the name and role you give us, a scrypt hash of your password (never the password),
            the quiz results and task checks you choose to save, your saved tools, and a monthly count of setup packages.
            Saved results are re-scored on our server from your answers.
          </p>
          <p>
            Sign-in uses an HttpOnly cookie that holds a random token; we keep only a hash of it. Sessions last 30 days.
          </p>
          <p>
            If billing is on and you buy Pro, payment happens on Stripe&apos;s checkout page. Card details never reach Fit.
            We keep the Stripe customer and subscription IDs and a record of each payment, failure and refund Stripe
            reports.
          </p>
          <p>
            Settings → Download my data exports everything the account stores as JSON. Delete account removes all of it
            at once. Stripe keeps its own records of past payments.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete and export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>From your results page you can export your data as JSON or delete the session.</p>
          <p>
            Deleting removes the server session, its scores, and any share links created from it, plus the copy in
            this browser.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        One limitation, stated once: this is not a personality test, clinical tool, or hiring screen.
      </p>
    </div>
  );
}
