/**
 * The documentation sidebar. Each slug is a file in ../../docs (docs/<slug>.md, or `file` when the
 * name differs); the pages are rendered from those files at build time by content-plugin.ts.
 */
export type DocLink = { slug: string; title: string; blurb: string; file?: string };
export type DocGroup = { title: string; items: DocLink[] };

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Start here",
    items: [
      { slug: "getting-started", title: "Getting Started", blurb: "Install m2aitestkit, record a known-good run and gate CI on it." },
      { slug: "concepts", title: "Core Concepts", blurb: "Three outcomes, assertion kinds, recordings and baselines." },
      { slug: "assertions", title: "Assertions", blurb: "Every built-in check, what it proves and what it cannot." },
    ],
  },
  {
    title: "Use it",
    items: [
      { slug: "recordings", title: "Recordings & Baselines", blurb: "Commit outputs, replay offline and diff at assertion level." },
      { slug: "cli", title: "CLI & CI", blurb: "Commands, flags, report formats and exit codes." },
      { slug: "api", title: "Programmatic API", blurb: "Suites, evaluators, assertOutput and the JSON report." },
    ],
  },
  {
    title: "Reference",
    items: [
      { slug: "privacy", title: "Privacy & Redaction", blurb: "What is stored, what is redacted and what never leaves the process." },
      { slug: "limitations", title: "Limitations", blurb: "What a green run does and does not tell you." },
      { slug: "comparison", title: "Comparison", blurb: "How it relates to promptfoo, vitest-evals and Evalite." },
    ],
  },
];

export const DOC_PAGES: DocLink[] = DOC_GROUPS.flatMap((g) => g.items);
export const DEFAULT_DOC = "getting-started";
