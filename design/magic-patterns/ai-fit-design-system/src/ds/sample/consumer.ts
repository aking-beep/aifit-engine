/**
 * SAMPLE DATA — mock content for the prototype. Not from a live integration.
 * Vendor pricing and privacy notes are illustrative and labelled with evidence
 * states; verify with each vendor before relying on them.
 */
import type { ActivityItem, AssessmentRecord, GeneratedFile, ToolRecommendation, Workflow } from '../types'

export const SAMPLE_USER = {
  name: 'Maya Chen',
  email: 'maya@example.com',
  role: 'Product designer & indie developer',
  plan: 'consumer-free',
}

export const SAMPLE_PROFILE = {
  archetype: 'Builder-Creator',
  summary: 'You ship side projects and design work. You want AI that accelerates coding and writing, but you keep client data private and prefer predictable monthly costs.',
  traits: [
    { label: 'Technical comfort', value: 78 },
    { label: 'Privacy sensitivity', value: 84 },
    { label: 'Budget flexibility', value: 42 },
    { label: 'Automation appetite', value: 61 },
  ],
  goals: ['Write and review code faster', 'Draft client documentation', 'Automate weekly reporting'],
  constraints: ['Client NDAs — no training on inputs', 'Under $30/month total', 'macOS + VS Code'],
}

export const SAMPLE_TOOLS: ToolRecommendation[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    vendor: 'Anysphere',
    category: 'Code editor',
    bestFor: 'Writing and refactoring code inside a VS Code–compatible editor',
    whyItFits: 'You already work in VS Code, and Privacy Mode keeps code out of training — matching your NDA constraint.',
    reasons: [
      { label: 'Matches your editor', detail: 'Imports VS Code extensions and keybindings.', weight: 0.32, direction: 'for', evidence: 'verified' },
      { label: 'Privacy mode available', detail: 'Vendor states code is not stored or trained on in Privacy Mode.', weight: 0.28, direction: 'for', evidence: 'verified' },
      { label: 'Within budget', detail: 'Paid tier fits under your $30 ceiling with room for one more tool.', weight: 0.2, direction: 'for', evidence: 'estimated' },
      { label: 'Usage caps on fast requests', detail: 'Heavy users may hit monthly limits.', weight: 0.12, direction: 'against', evidence: 'assumption' },
    ],
    pricing: { value: 'Free · ~$20/mo Pro', evidence: 'verified', asOf: '2025-06' },
    difficulty: 'easy',
    setupMinutes: 10,
    privacy: { summary: 'Privacy Mode: no code retention. Off by default — our config turns it on.', trainsOnData: { value: false, evidence: 'verified', asOf: '2025-06' } },
    alternatives: ['GitHub Copilot', 'Zed AI'],
    fit: 92,
  },
  {
    id: 'claude',
    name: 'Claude',
    vendor: 'Anthropic',
    category: 'Writing assistant',
    bestFor: 'Long-form drafting and reviewing documents with large context',
    whyItFits: 'Handles full client specs in one go, and consumer chats can be excluded from training in settings.',
    reasons: [
      { label: 'Large context window', detail: 'Fits complete specs and long threads.', weight: 0.3, direction: 'for', evidence: 'verified' },
      { label: 'Writing quality for docs', detail: 'Rated highly for structured documentation in our evals.', weight: 0.26, direction: 'for', evidence: 'estimated' },
      { label: 'Training opt-out', detail: 'Check your data controls; setup guide covers it.', weight: 0.18, direction: 'for', evidence: 'assumption' },
      { label: 'Overlaps with Cursor chat', detail: 'Some coding Q&A could stay in your editor instead.', weight: 0.1, direction: 'against', evidence: 'recommendation' },
    ],
    pricing: { value: 'Free · ~$20/mo Pro', evidence: 'estimated', asOf: '2025-06' },
    difficulty: 'easy',
    setupMinutes: 5,
    privacy: { summary: 'Review data-use controls on first sign-in. Do not paste client secrets.', trainsOnData: { value: null, evidence: 'untested' } },
    alternatives: ['ChatGPT', 'Gemini'],
    fit: 86,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    vendor: 'Zapier',
    category: 'Automation',
    bestFor: 'Weekly report assembly from Sheets, Linear and email',
    whyItFits: 'Your reporting is rule-based. Deterministic automation is cheaper and more reliable than an AI agent here.',
    reasons: [
      { label: 'Task is deterministic', detail: 'Same sources, same format every week — no judgement needed.', weight: 0.4, direction: 'for', evidence: 'recommendation' },
      { label: 'Connectors exist', detail: 'Native integrations for every source you listed.', weight: 0.3, direction: 'for', evidence: 'verified' },
      { label: 'Free tier may suffice', detail: 'At ~4 runs/month you stay under limits.', weight: 0.15, direction: 'for', evidence: 'estimated' },
    ],
    pricing: { value: 'Free tier likely enough', evidence: 'estimated', asOf: '2025-06' },
    difficulty: 'moderate',
    setupMinutes: 25,
    privacy: { summary: 'Data passes through vendor servers. Keep client names out of report titles.', trainsOnData: { value: false, evidence: 'assumption' } },
    alternatives: ['Make', 'n8n (self-hosted)'],
    fit: 81,
  },
]

export const MORE_TOOLS: ToolRecommendation[] = [
  { ...SAMPLE_TOOLS[0], id: 'copilot', name: 'GitHub Copilot', vendor: 'GitHub', fit: 84, pricing: { value: '~$10/mo', evidence: 'verified', asOf: '2025-06' }, alternatives: ['Cursor', 'Zed AI'], whyItFits: 'Lower cost than Cursor and works in your current editor without switching.' },
  { ...SAMPLE_TOOLS[1], id: 'chatgpt', name: 'ChatGPT', vendor: 'OpenAI', fit: 79, pricing: { value: 'Free · ~$20/mo Plus', evidence: 'verified', asOf: '2025-06' }, alternatives: ['Claude', 'Gemini'], whyItFits: 'Strong general assistant; data controls need configuring for client work.' },
]

export const COMPARISON_ROWS: { label: string; values: Record<string, string>; evidence: 'verified' | 'estimated' | 'assumption' | 'untested' }[] = [
  { label: 'Price', values: { cursor: '~$20/mo', copilot: '~$10/mo', claude: '~$20/mo' }, evidence: 'verified' },
  { label: 'Works in VS Code', values: { cursor: 'Fork of VS Code', copilot: 'Extension', claude: 'Via extension' }, evidence: 'verified' },
  { label: 'No training on inputs', values: { cursor: 'Privacy Mode', copilot: 'Business tier', claude: 'Settings opt-out' }, evidence: 'assumption' },
  { label: 'Multi-file edits', values: { cursor: 'Yes', copilot: 'Yes', claude: 'Limited' }, evidence: 'estimated' },
  { label: 'Setup time', values: { cursor: '~10 min', copilot: '~5 min', claude: '~5 min' }, evidence: 'estimated' },
  { label: 'Offline / local model', values: { cursor: 'No', copilot: 'No', claude: 'No' }, evidence: 'untested' },
]

export const SAMPLE_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-code',
    name: 'Ship features faster',
    outcome: 'Plan → code → review in one editor loop',
    verdict: 'buy',
    steps: [
      { title: 'Draft spec', tool: 'Claude', detail: 'Paste the ticket, ask for acceptance criteria.' },
      { title: 'Implement', tool: 'Cursor', detail: 'Use Composer with the spec pinned as context.' },
      { title: 'Self-review', tool: 'Cursor', detail: 'Run the review rule from your generated config.' },
    ],
    timeSaved: { value: '3–5 h/week', evidence: 'estimated' },
  },
  {
    id: 'wf-report',
    name: 'Weekly client report',
    outcome: 'Auto-assembled every Friday at 4pm',
    verdict: 'automation',
    steps: [
      { title: 'Collect', tool: 'Zapier', detail: 'Pull closed Linear issues and Sheet metrics.' },
      { title: 'Format', tool: 'Zapier', detail: 'Fill your Google Docs template.' },
      { title: 'Send', tool: 'Gmail', detail: 'Draft to you for a 2-minute check before sending.' },
    ],
    timeSaved: { value: '~1.5 h/week', evidence: 'estimated' },
  },
  {
    id: 'wf-invoice',
    name: 'Invoice reminders',
    outcome: 'Use your accounting app’s built-in reminders',
    verdict: 'no-ai',
    steps: [{ title: 'Enable reminders', tool: 'Your invoicing app', detail: 'Built-in scheduled reminders already do this reliably.' }],
    timeSaved: { value: '~30 min/week', evidence: 'assumption' },
  },
]

export const SAMPLE_PACKAGE_FILES: GeneratedFile[] = [
  {
    path: 'README.md',
    language: 'markdown',
    content: `# Maya's AI setup — Builder-Creator
Generated by AI Fit · sample package

## Install order
1. Cursor (10 min) — run setup.sh
2. Claude (5 min) — follow claude-settings.md
3. Zapier (25 min) — import weekly-report.json

## Privacy checklist
- [ ] Cursor Privacy Mode is ON (settings.json sets it)
- [ ] Claude data controls reviewed
- [ ] No client names in Zap titles`,
  },
  {
    path: '.cursor/settings.json',
    language: 'json',
    content: `{
  "cursor.privacyMode": true,
  "cursor.chat.defaultModel": "auto",
  "editor.inlineSuggest.enabled": true,
  "files.exclude": {
    "**/.env": true,
    "**/secrets/**": true
  }
}`,
  },
  {
    path: '.cursor/rules/review.md',
    language: 'markdown',
    content: `# Review rule
When asked to review, check:
- Accessibility of any UI change
- Missing tests for new branches
- Secrets or client identifiers in code
Respond as a checklist. Do not rewrite code unless asked.`,
  },
  {
    path: 'setup.sh',
    language: 'bash',
    content: `#!/usr/bin/env bash
# Installs Cursor settings into your user profile.
set -euo pipefail
DEST="$HOME/Library/Application Support/Cursor/User"
mkdir -p "$DEST"
cp .cursor/settings.json "$DEST/settings.json"
echo "Cursor configured. Privacy Mode: on."`,
  },
  {
    path: 'weekly-report.json',
    language: 'json',
    content: `{
  "name": "Weekly client report",
  "trigger": { "app": "schedule", "every": "friday 16:00" },
  "steps": [
    { "app": "linear", "action": "find_issues", "filter": "closed_this_week" },
    { "app": "sheets", "action": "get_rows", "range": "Metrics!A:F" },
    { "app": "docs", "action": "fill_template", "template": "Client report" },
    { "app": "gmail", "action": "create_draft", "to": "me" }
  ]
}`,
  },
]

export const SAMPLE_ACTIVITY: ActivityItem[] = [
  { id: 'a1', actor: 'You', action: 'generated', target: 'Cursor configuration', at: '2h ago' },
  { id: 'a2', actor: 'You', action: 'saved', target: 'Claude', at: 'Yesterday' },
  { id: 'a3', actor: 'AI Fit', action: 'flagged a pricing change for', target: 'Zapier', at: '3 days ago' },
  { id: 'a4', actor: 'You', action: 'completed', target: 'Five-minute assessment', at: '5 days ago' },
]

export const SAMPLE_HISTORY: AssessmentRecord[] = [
  { id: 'h3', title: 'Builder-Creator profile', date: '2025-06-12', verdict: 'buy', score: 92, status: 'complete', version: 3 },
  { id: 'h2', title: 'Weekly reporting', date: '2025-05-28', verdict: 'automation', score: 81, status: 'complete', version: 1 },
  { id: 'h1', title: 'Invoice reminders', date: '2025-05-02', verdict: 'no-ai', score: 88, status: 'stale', version: 1 },
]
