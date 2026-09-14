# MVP launch readiness — 12 September 2026

Scan of competitors, TAM, product-market fit, and whether Fit should launch gated.

**Verdict:** Launch the public MVP today as a **try-this**, not as a company. The problem is real and the wedge is distinct. Product-market fit is **not proven**. Do **not** paywall the quiz. Ship an **optional** waitlist or access-code gate (off by default) so an invite-first cohort is one env var away.

Live URL: `https://aifit-engine.vercel.app`

---

## What Fit actually sells

A five-minute, vendor-neutral assessment that watches how someone asks, checks, and decides, then returns:

1. A named **interaction profile** (not a personality type)
2. Ranked **products** and **models** as separate lists
3. A **workflow / stack**
4. A portable **persona** they can paste into ChatGPT, Claude, Gemini, Cursor, or an agent

Scoring is deterministic and server-side. An LLM never picks the winner. The catalog is a dated seed (16 products, 4 model rows, reviewed 2026-09-12), not a 10,000-tool directory.

That last point is the product: Fit is a **fit engine**, not a search box.

---

## Competitor scan

No live product is a 1:1 of “observed behavior → product + model + workflow + pasteable persona.” The market is crowded in **adjacent** jobs. Classes below were checked in September 2026.

### 1. “Which AI should I use?” quizzes (closest)

These are the real substitutes for a first visit.

| Product | What it does | Why it is not Fit |
| --- | --- | --- |
| [WhichAI](https://whichai.tech/) | 4 questions, 16 tools, 11 scored dimensions, email when the pick changes | Catalog-led weighted score. One product winner. No persona, no separate model list. |
| [PickTheBestAI](https://www.pickthebestai.com/quiz) | 8 questions, ~60 seconds, task + budget; writing/coding/image/video/voice/music/resume variants | Affiliate-aware directory quiz. Named tool + “try it free.” |
| [WhichAIIsBest](https://whichaiisbest.com/) | 6 questions (use case, comfort, budget, privacy, language, volume) | Same job-to-be-done, shallower output. |
| [AIFindr “Which AI are you?”](https://aifindr.app/quiz/) | 6 questions → 8 **AI personalities** (ChatGPT the Generalist, Claude the Analyst, …) | Personality-quiz adjacent. Fit’s rules forbid this. |
| [AIToolsBakery](https://aitoolsbakery.com/find-the-right-ai-tool/) | 3 questions: role, budget, trial | Role/budget filter into a review site. |
| [AI Tools Key](https://aitoolskey.com/ai-tool-finder/) | Per-category 60-second finders | Category shop, not an interaction profile. |
| [AidTaskPro](https://aidtaskpro.com/tools/ai-tool-finder/) | 6 questions: profession, task, budget, comfort → 3 tools | Self-report, not observed behavior. |
| [AIToolsHaven](https://aitoolshaven.com/ai-tool-recommender) | Role + bottleneck → 3-tool “stack” | Marketing recommender; claims 15k+ tools. |
| [TechRadar chatbot quiz](https://www.techradar.com/ai-platforms-assistants/which-ai-chatbot-is-right-for-you-take-our-quiz-to-find-out-whether-chatgpt-claude-gemini-grok-or-perplexity-is-best) | Editorial pick among ChatGPT / Claude / Gemini / Grok / Perplexity | Vendor-named, 5 outcomes. |
| Gartner-style “find the right AI tool” pages | 4–6 questions, 6 named assistants | Analyst/media lead-gen. Hard-codes vendor winners. |

**How Fit should win this class:** stay longer than 30 seconds, refuse personality types, keep product ≠ model, show evidence + freshness, and hand the user a file they can paste today.

### 2. AI tool directories (scale, not fit)

| Product | Role |
| --- | --- |
| There's An AI For That (TAAFT) | Largest consumer directory. Public counts in 2026 sit in the tens of thousands of tools; TAAFT-derived writeups cite ~47,400 listed tools and millions of monthly users. Search/browse, not assessment. |
| FutureTools | Curated ~4,000 tools, community upvotes (Matt Wolfe). |
| Toolify, Futurepedia, RankmyAI, OpenFuture, TopAI.tools | More catalogs. Toolify-class sites claim 20k+ rows and 400+ categories. |
| OpenTools and similar “chat with a GPT to find a tool” | LLM as the recommender — the thing Fit’s rules forbid as the decider. |

Fit will lose a “who has more tools” fight forever. Do not try. The catalog stays curated and dated.

### 3. Review marketplaces (procurement, not a five-minute quiz)

G2 (18,000+ products under Artificial Intelligence alone), Capterra, TrustRadius, Gartner Peer Insights. Buyer reviews, grids, vendor-paid features. Different buyer, different session length.

### 4. Analyst reports (enterprise budget)

Gartner Magic Quadrant, Forrester Wave, and Gartner “AI access / readiness” assessments. Thousands of dollars, org-level, not a homework/shop/side-hustle quiz.

### 5. Model pickers and benches (model ≠ product)

LMSYS / LMArena, Artificial Analysis, WhichLLM, ChatbotKit comparison pages, OpenTheRank. Useful evidence **inputs** for Fit’s model registry. They do not output a working persona or a product/workflow split.

### 6. Generic personality tests (off-limits)

16Personalities, Crystal, Traitify, AIPRM “AI productivity personality,” and AIFindr’s eight types. Fit must not drift here. That is also why those products are not true competitors — they answer a different, weaker question.

### 7. The default (largest “competitor”)

“Just use ChatGPT.” Pew (survey 17–23 Feb 2026, published June 2026): **44% of U.S. adults** have used ChatGPT. Reuters (9 Feb 2026): ChatGPT had **more than 800 million weekly active users**. Most people never open a directory or a quiz. Fit’s job is to intercept the moment they suspect the default is a poor fit — not to out-brand OpenAI.

### 8. Org “AI readiness” forms

Intooligence-style 2-minute business readiness checks, Gartner employee-access assessments. Company capability, not individual interaction fit.

---

## TAM — is it large enough to use this tool?

Order-of-magnitude only. Not a fundraising model.

| Layer | Estimate | Source / method |
| --- | --- | --- |
| **Ceiling — people already using a general AI assistant** | 800M+ weekly ChatGPT users globally; ~49% of U.S. adults have used a chatbot; ~24% of U.S. adults use one daily; 38% of employed U.S. adults use a chatbot for work | Reuters 2026-02-09; Pew “Americans and AI 2026” (fielded 2026-02-17–23) |
| **Serviceable — people stuck choosing a setup** | Low-single-digit % of daily users is still **millions in the U.S.** and **tens of millions** globally | Choice overload vs ~10k–47k listed tools. Not “all knowledge workers.” |
| **Obtainable for this MVP** | **200–2,000 completed quizzes** from an English-speaking LinkedIn / X / friend graph | Enough to read finish rate, share/export rate, and “I pasted the setup.” Not enough to claim a market. |

**Is TAM “good enough to use Fit”?** Yes, as a **learning product**. The beachhead is people who already want AI help and are stuck — students, shop/studio owners, side hustles, small teams — not “the $174B AI software market” and not the directory-publisher TAM.

Adjacent directory-market dollar figures ($hundreds of millions) are **not** Fit’s revenue. Fit has no paid plan today (`README` is explicit: this is a free individual quiz). Do not confuse catalog-ad ARPU with this wedge.

**What would make TAM *not* enough:** if the only users who finish are people who would have picked ChatGPT anyway and never export the persona. That is a PMF miss, not a TAM miss. Measure it after launch.

---

## Product-market fit

**Problem is real.** Thousands of overlapping tools; directories increase overload; 30-second quizzes collapse to “ChatGPT vs Claude vs Gemini”; personality quizzes are entertainment.

**Wedge is real** if Fit stays:

- observed behavior, not self-reported job title
- product fit ≠ model fit
- dated registry + visible evidence
- no MBTI / Enneagram / clinical labels
- a file the user can paste today

**PMF is not proven.** This repo has no public completion, share, or “I used the setup” numbers. Shipping today is a **learning launch**, not “we have PMF.”

Watch after launch (anonymous analytics already exist):

| Signal | Healthy early bar |
| --- | --- |
| Start → finish | ≥ 50% |
| Finish → export or copy persona | ≥ 15% |
| Finish → share | ≥ 10% |
| Qualitative “I pasted this into ChatGPT/Claude/Cursor” | ≥ 10 of the first 25 people |

If those miss, the issue is the quiz or the catalog, not TAM.

### Risks that can fake a bad-PMF reading

- Seed catalog (16 products) vs TAAFT-scale directories — users may say “you missed my tool.”
- `vercel.app` URL and no custom domain.
- Share IDs need Upstash / Vercel KV to survive serverless; hash fallback exists.
- LinkedIn audience may be more professional than the “homework / shop” homepage. That is positioning, not engine failure.

---

## Gate or not?

Checked against how every close competitor ships: **the quiz is free and ungated.** A paywall or forced email before the first result kills the only loop that can prove PMF.

| Option | Do it? | Why |
| --- | --- | --- |
| Paywall the quiz | **No** | Every substitute is free. |
| Forced email to start | **No** for public MVP | Privacy promise is anonymous-by-default. |
| Waitlist in front of `/` and `/assessment` | **Optional** | Use for an invite-first friends / LinkedIn cohort so you can see *who* and *whether they finish*. |
| Access code | **Optional** | Same cohort, no email. |
| Gate depth later (PDF pack, team copy, refresh alerts) | **Later** | Charge for artifacts, not for the five minutes. |

**Default in production: gate off.** Set `FIT_ACCESS_GATE=waitlist` or `FIT_ACCESS_GATE=code` on Vercel when you want invite-first. Privacy, share links, How it works, and the registry stay public so a shared result still opens.

You can see whether gating works: waitlist POSTs return 200 and `GET /v1/waitlist` returns a count (emails are redacted). Access codes are checked server-side and never sent to the browser.

To preview a gate without changing production env, open `/?preview_gate=waitlist` or `/?preview_gate=code`. The query can only turn a gate **on**, never off.

---

## Launch-today checklist

Already true on `main` / production:

- [x] Deterministic engine, separate product and model registries, dated 2026-09-12 review
- [x] 8 scenarios, ~12-question path, Simple/Detailed reading level
- [x] Persona exports (ChatGPT, Claude, Gemini, Cursor, AGENTS.md, pack)
- [x] Anonymous mode, delete/export, privacy page
- [x] Phone + desktop quiz path
- [x] Hosted at `https://aifit-engine.vercel.app`

Human-only leftovers (do not block a try-this launch):

- [ ] Custom domain + `NEXT_PUBLIC_SITE_URL`
- [ ] Upstash Redis or Vercel KV so short share IDs survive
- [ ] First 25 real sessions with a finish/export note (roadmap Week 4)

**Ship today:** public, gate off, tell people it is a beta quiz. Turn the gate on only if you want a closed first week.

---

## How safe is it?

Safe enough for a public anonymous quiz. Not an enterprise control plane.

Product guardrails (already in the engine): no MBTI / clinical / hiring labels, no sensitive-attribute metrics, LLM does not pick the winner.

MVP network guardrails: size caps, per-IP rate limits, drop raw notes after classify, waitlist emails not listed publicly, CSP / nosniff / no-framing, CORS allowlist.

See `docs/SECURITY.md`. Do not block launch on SSO, a WAF, or a pen-test program.
