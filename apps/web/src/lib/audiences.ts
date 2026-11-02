import type { AudienceContent } from "@/design";

/**
 * Paid-ad landing pages for AI Fit. Every claim describes what the product
 * does; none is a customer result, a statistic or a testimonial.
 */
export const AUDIENCES: AudienceContent[] = [
  {
    slug: "professionals",
    eyebrow: "For busy professionals",
    title: "Find the AI tools that fit how you actually work.",
    lede: "A five-minute quiz watches how you make choices, not what you say about yourself, then recommends tools and gives you setup files to paste into ChatGPT, Claude, Gemini and more.",
    pains: [
      "You pay for an AI subscription and still do most of the work yourself.",
      "There are too many tools to try them all.",
      "The answers you get do not match how you like to work.",
      "Setting up custom instructions feels like guesswork.",
    ],
    outcomes: [
      { title: "Tools ranked for you", body: "Matched against a dated catalog of current apps, each with a last-checked date you can inspect." },
      { title: "Ready-to-paste setup", body: "Instructions written from your profile for each app you use, checked for secrets before you download them." },
      { title: "An honest task check", body: "Ask whether one job should use AI at all. Sometimes the answer is ordinary software or nothing." },
    ],
    steps: [
      "Answer about twelve short scenario questions.",
      "Read your profile and the tools that fit it.",
      "Paste the setup into the apps you already use.",
      "Save it to a free account to keep it and download a full package.",
    ],
    faq: [
      { q: "Is it free?", a: "Yes. The quiz, results and task check are free. Pro is $12 a month for unlimited recommendations and setup packages." },
      { q: "Do you sell my answers?", a: "No. Without an account your answers are anonymous and deleted after 30 days." },
      { q: "Do you take affiliate money?", a: "No. Rankings come from published rules and the tool registry, not payments." },
    ],
    primary: { href: "/assessment", label: "Take the five-minute quiz" },
    metaTitle: "AI Fit for professionals: the AI tools that fit how you work",
    metaDescription: "A five-minute quiz that recommends AI tools for how you actually work, with setup you can paste into ChatGPT, Claude and Gemini.",
  },
  {
    slug: "developers",
    eyebrow: "For developers",
    title: "Set up your coding assistants from how you really work.",
    lede: "AI Fit recommends coding tools from your choices in short scenarios and generates validated config files: Cursor rules, AGENTS.md, CLAUDE.md and more.",
    pains: [
      "Every editor and agent has its own config format.",
      "Default instructions are generic and fight your style.",
      "You want local or private options for sensitive code.",
      "You do not want to paste a secret into a config file by accident.",
    ],
    outcomes: [
      { title: "Coding tools matched to you", body: "IDE and coding-agent recommendations from your profile, including local options." },
      { title: "Validated config files", body: "Each file is format-checked and scanned for credential patterns; the ZIP includes a manifest of the checks." },
      { title: "One setup, many tools", body: "The same working style written for Cursor, Claude, ChatGPT, Gemini and an AGENTS.md." },
    ],
    steps: [
      "Take the quiz in about five minutes.",
      "Review the recommended coding tools and why they fit.",
      "Download the setup package and read the README first.",
      "Commit the config files you want to keep.",
    ],
    faq: [
      { q: "Which files does it generate?", a: "Instructions for ChatGPT, Claude, Gemini and Cursor, an AGENTS.md, prompt templates, a workflow file and a manifest." },
      { q: "Is anything executed on my machine?", a: "No. You get text files to review. Nothing runs until you choose to use them." },
      { q: "Is the source available?", a: "Yes, the engine and the tool registry are in the public repository linked in the footer." },
    ],
    primary: { href: "/assessment", label: "Generate my setup" },
    metaTitle: "AI Fit for developers: coding assistants set up from how you work",
    metaDescription: "Recommendations for IDEs and coding agents plus validated config files: Cursor rules, AGENTS.md, CLAUDE.md, secret-scanned.",
  },
  {
    slug: "creators",
    eyebrow: "For creators and freelancers",
    title: "Spend your AI budget on the tools that pay back.",
    lede: "AI Fit matches you to writing, design, research and automation tools from a five-minute quiz, and tells you honestly when a task does not need AI.",
    pains: [
      "Subscriptions pile up and you are not sure which you use.",
      "Some tools are great for others and wrong for you.",
      "Client work needs privacy you are not sure you have.",
      "You want time back, not another app to learn.",
    ],
    outcomes: [
      { title: "A short list, not a directory", body: "The few tools that fit your working style, with what each is good at." },
      { title: "Privacy-aware picks", body: "Filters for local-only and price tier, so private client work stays private." },
      { title: "The task check", body: "Test one recurring job: it says AI, a simple automation, ordinary software or nothing." },
    ],
    steps: [
      "Take the quiz.",
      "Filter recommendations by privacy and price.",
      "Run the task check on the job that eats your week.",
      "Save your setup to a free account.",
    ],
    faq: [
      { q: "Is it really free?", a: "Yes. Pro ($12/month) only adds unlimited recommendations, comparisons and setup packages." },
      { q: "Will it push me to buy tools?", a: "No. There are no affiliate links, and \"not AI\" is a common, honest answer." },
      { q: "Can I delete my data?", a: "Yes. Delete your session or account at any time; it is removed immediately." },
    ],
    primary: { href: "/assessment", label: "Find my AI fit" },
    metaTitle: "AI Fit for creators and freelancers: the AI tools that pay back",
    metaDescription: "A five-minute quiz that picks the writing, design, research and automation tools that fit you, and says honestly when AI is not needed.",
  },
];

export const audienceBySlug = (slug: string) => AUDIENCES.find((a) => a.slug === slug);
