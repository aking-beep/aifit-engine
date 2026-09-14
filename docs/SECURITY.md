# Security and guardrails — MVP

Fit is a public anonymous quiz. This is **not** a SOC 2 / HIPAA / hiring-tool security program. The job is to keep a five-minute assessment from leaking notes, eating the host, or pretending to be a clinical or employment screen.

## How safe is it for MVP?

**Safe enough to launch as a try-this.** Not safe to put behind a company SSO and call it an enterprise product.

What is already true:

- No accounts, names, or employers are requested.
- Scoring is deterministic on the server. An LLM, if enabled, may only emit allowlisted event types and never picks the winner.
- Persona labels are interaction profiles, not MBTI / Enneagram / IQ / clinical terms.
- Protected characteristics are not dimensions in the metric map.
- Delete and export exist for the anonymous session id.

What this MVP layer adds:

- Request size caps (notes, events, comments).
- Best-effort per-IP rate limits (per process; weak on many Vercel instances).
- Raw free-text is classified then **dropped** (`source_text` is not stored).
- Waitlist emails are not listed on the public `GET /v1/waitlist` (count only unless `FIT_OPERATOR_KEY` is sent).
- Browser headers: `nosniff`, `DENY` framing, referrer policy, CSP.
- CORS allowlist instead of `*`.

## What it is not

- Not a login wall. Anyone with a session or share id can read that record. Ids are random 128-bit values, not a secret vault.
- Not a WAF, bot farm defense, or DDoS product. Rate limits reset per instance.
- Not content moderation of the tools we recommend. Those vendors have their own policies.
- Not a guarantee that a user will not type a secret into the optional note field before we drop it. Treat notes as untrusted input; we do not keep them.

## Operator env

```
FIT_OPERATOR_KEY=           # required to see redacted waitlist rows
FIT_RATE_LIMIT_PER_MINUTE=180
FIT_WAITLIST_RATE_LIMIT_PER_MINUTE=8
FIT_CORS_ORIGINS=https://aifit-engine.vercel.app,http://127.0.0.1:43123
FIT_RATE_LIMIT_PER_MINUTE=0 # disable limiter in an isolated test if needed
```

Keep `AIFIT_LLM_CLASSIFIER` off in production unless the classifier URL is one you control.

## After MVP (do not block launch)

- Durable store (Upstash / Vercel KV) so share ids and rate limits survive instances.
- Custom domain + `NEXT_PUBLIC_SITE_URL` so share cards and CORS stay on one origin.
- Abuse mailbox / takedown for waitlist if you turn the gate on.
