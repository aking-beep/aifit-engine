import type { AudienceContent } from '@/design';

/**
 * Paid-ad landing pages for AI Fit Teams. Every claim describes what the
 * product does; none is a customer result, a statistic or a testimonial.
 */
export const AUDIENCES: AudienceContent[] = [
  {
    slug: 'operations',
    eyebrow: 'For operations leaders',
    title: 'Know which workflows should use AI before you fund them.',
    lede: 'Describe one workload in about ten minutes. AI Fit Teams says whether it should use AI at all, compares building, buying, ordinary software and rules-based automation, and shows what it would cost to run.',
    pains: [
      'Every team has an AI idea, and there is no consistent way to rank them.',
      'Vendor demos promise savings, but nobody has priced what it costs to run at your volume.',
      'Some of the ideas are really a spreadsheet or an automation, and nobody says so.',
      'You need a decision you can defend to finance, not a slide.',
    ],
    outcomes: [
      { title: 'A verdict, including "not AI"', body: 'Five options are scored against fixed, published rules. "Do not use a model for this" is a first-class answer.' },
      { title: 'Run cost and payback', body: 'Monthly cost and ROI from your volumes, with every figure tagged as calibrated, estimated or an assumption.' },
      { title: 'A portfolio view', body: 'Save each workload to a workspace and compare recommendations, run costs and launch-blocking controls side by side.' },
    ],
    steps: [
      'Describe the workload: the task, volume, data and what a mistake costs.',
      'Read the free verdict and the build-vs-buy comparison.',
      'Unlock the cost model, risks and governance for $149, or the full blueprint for $399.',
      'Bring ARC in to validate the figures and deliver it, if you want help.',
    ],
    faq: [
      { q: 'Do I need an account?', a: 'No. The assessment and the verdict work without one. An account is only needed to save work, invite your team and download paid deliverables.' },
      { q: 'Is my data used to train anything?', a: 'No. Without an account nothing you type is stored: the intake is encoded into the report link.' },
      { q: 'Are the savings figures guaranteed?', a: 'No. They are estimates from your inputs and published rules, labelled as such. Nothing is measured until you run the evaluation plan.' },
    ],
    primary: { href: '/assess', label: 'Assess a workload free' },
    metaTitle: 'AI Fit Teams for operations leaders: decide which workflows should use AI',
    metaDescription: 'A defensible verdict for one workload: AI or not, build vs buy vs automate, and what it costs to run. Free verdict; paid cost model and blueprint.',
  },
  {
    slug: 'it-security',
    eyebrow: 'For IT and security teams',
    title: 'Review AI requests with the controls written down first.',
    lede: 'Every AI Fit Teams assessment lists the security and governance requirements a workload needs before launch, from data classes, actions and autonomy, and exports them for ARC Control.',
    pains: [
      'AI requests arrive with no description of the data or the actions involved.',
      'You are asked to approve tools without a list of controls to check.',
      'Agents that act in other systems need limits nobody has defined.',
      'There is no record of what was recommended and why.',
    ],
    outcomes: [
      { title: 'Launch-blocking controls', body: 'Security and governance requirements derived from the workload, marked recommended-not-enforced until you verify them.' },
      { title: 'An editable risk register', body: 'Likelihood, impact, owner and mitigation for each risk, saved with the assessment and versioned.' },
      { title: 'A governance export', body: 'Requirements, suggested policies, the agent inventory and the evaluation plan as JSON for ARC Control (workspace plan).' },
    ],
    steps: [
      'Ask the requesting team to run the intake, or run it with them.',
      'Read the security and governance sections against your own standards.',
      'Assign owners in the risk register and save the assessment to your workspace.',
      'Export the governance package, or talk to ARC about runtime enforcement.',
    ],
    faq: [
      { q: 'Is this a compliance attestation?', a: 'No. The output is recommendations. Nothing in it is an enforced control or a certification.' },
      { q: 'Can other organisations see our assessments?', a: 'No. Workspaces are isolated; a person outside your workspace gets "not found".' },
      { q: 'Do AI agents make the decision?', a: 'No. The decision comes from fixed rules. Optional AI helpers only suggest intake answers or explain the result, and are off by default.' },
    ],
    primary: { href: '/assess', label: 'Run a security-first assessment' },
    metaTitle: 'AI Fit Teams for IT and security: the controls an AI workload needs',
    metaDescription: 'Security and governance requirements, an editable risk register and a governance export for each AI workload, before anything ships.',
  },
  {
    slug: 'small-business',
    eyebrow: 'For small businesses',
    title: 'Find out if AI is worth it for your business, in plain numbers.',
    lede: 'Pick one job your team does every week. AI Fit Teams tells you whether to use AI, a cheaper tool, an automation, or nothing, and what each option would cost.',
    pains: [
      'You keep hearing you should use AI, but not for what.',
      'Subscriptions add up, and you cannot tell which ones pay back.',
      'You do not have an engineer to ask.',
      'You want an honest answer, even if it is "do not bother".',
    ],
    outcomes: [
      { title: 'An honest answer', body: 'Including "keep doing it by hand" or "use ordinary software" when that is the better choice.' },
      { title: 'Costs you can check', body: 'What it would cost each month and what it would save, with the assumptions written out.' },
      { title: 'A plan to act on', body: 'The blueprint lists the steps, the tools and how to check it works, for $399 once.' },
    ],
    steps: [
      'Describe one job: how often it happens and how long it takes.',
      'Get the free verdict in minutes.',
      'Buy the cost model or the blueprint only if you want more detail.',
      'Book a call with ARC if you want someone to set it up with you.',
    ],
    faq: [
      { q: 'How much does it cost?', a: 'The verdict is free. A full assessment is $149 and a blueprint $399, one-time. The workspace plan is $199 a month for teams with several workloads.' },
      { q: 'Do I need technical knowledge?', a: 'No. The intake asks about the work, not the technology.' },
      { q: 'What if AI is not the answer?', a: 'Then the report says so and recommends the cheaper option. That is a common result.' },
    ],
    primary: { href: '/assess', label: 'Check one job free' },
    metaTitle: 'AI Fit Teams for small businesses: is AI worth it for this job?',
    metaDescription: 'An honest, free verdict on whether one job should use AI, a cheaper tool, an automation or nothing, with costs you can check.',
  },
];

export const audienceBySlug = (slug: string) => AUDIENCES.find((a) => a.slug === slug);
