import { useState, type ReactNode } from "react";
import type { RunReport, Diff } from "m2aitestkit";
import { DOC_PAGES } from "./docs-nav";
import {
  ArrowRight,
  BracesIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  ShieldIcon,
  LayersIcon,
  DiffIcon,
  GitHubIcon,
  TerminalIcon,
} from "./icons";
import {
  installCommand,
  M2TOOLKIT,
  NPM_URL,
  PACKAGE_MANAGERS,
  PACKAGES_URL,
  PKG,
  RELATED,
  REPO,
  type PackageManager,
} from "./meta";
import { Playground } from "./Playground";
import { docHref } from "./router";
import { hero } from "./samples";
import { Snippet } from "./Snippet";
import { Verdict } from "./Verdict";

function Install() {
  const [pm, setPm] = useState<PackageManager>("npm");
  const [copied, setCopied] = useState(false);
  const command = installCommand(pm);
  return (
    <div className="install">
      <div className="install-tabs" role="tablist" aria-label="Package manager">
        {PACKAGE_MANAGERS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === pm} onClick={() => setPm(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="install-cmd">
        <span aria-hidden="true">$</span>
        <code>{command}</code>
        <button
          type="button"
          aria-label={copied ? "Copied" : `Copy "${command}"`}
          onClick={() =>
            void navigator.clipboard?.writeText(command).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })
          }
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
}

/** The ledger: a real run, computed by the library at build time. */
function Ledger({ report, diff }: { report: RunReport; diff: Diff }) {
  const { assertions } = report.summary;
  const blocked = assertions.fail > 0 || diff.regressions > 0;
  const rows = report.cases[0]?.assertions ?? [];
  return (
    <figure className="ledger" aria-label={`m2aitestkit run: ${assertions.pass} passed, ${assertions.fail} failed, ${assertions.unevaluable} unevaluable`}>
      <figcaption className="ledger-head">
        <span className="ledger-file">baseline</span>
        <span className="ledger-arrow" aria-hidden="true">→</span>
        <span className="ledger-file">today</span>
        <span className="ledger-state" data-passed={!blocked}>{blocked ? "blocked" : "passed"}</span>
      </figcaption>
      <ul className="ledger-rows">
        {rows.map((a) => {
          const regressed = diff.changes.some((c) => c.kind === "regressed" && c.assertionId === a.id);
          return (
            <li key={a.id} data-severity={a.status === "pass" ? "info" : a.status === "fail" ? "error" : "warning"}>
              <div className="ledger-line">
                <Verdict value={a.status} />
                <code>{a.id}</code>
                <span className="ledger-path">{regressed ? "pass → " + a.status : a.kind}</span>
              </div>
              {a.message && <p>{a.message}</p>}
            </li>
          );
        })}
      </ul>
      <p className="ledger-foot">
        Real output from <code>runSuite</code> and <code>diffReports</code>. No model called, no key needed.
      </p>
    </figure>
  );
}

const FEATURES: { icon: ReactNode; title: string; body: string; size?: "lg" | "full" }[] = [
  {
    icon: <LayersIcon />,
    title: "Committed recordings",
    body: "Redacted, key-sorted, timestamp-free JSON that diffs cleanly in code review. Raw inputs are never stored, only a hash.",
    size: "lg",
  },
  {
    icon: <DiffIcon />,
    title: "Assertion-level baseline diff",
    body: "pass → fail and pass → unevaluable are regressions. Removed cases and assertions are always listed, so a suite can't be weakened silently.",
  },
  {
    icon: <ShieldIcon />,
    title: "Honest labels",
    body: "Every assertion is exact, structural, rule, heuristic, semantic or custom, so lexical overlap never passes for correctness.",
  },
  {
    icon: <BracesIcon />,
    title: "Structured-output checks",
    body: "Valid JSON, JSON Schema or any Standard Schema validator, required fields, types, ranges and tool-call rules.",
  },
  {
    icon: <LockIcon />,
    title: "Private by default",
    body: "No network, no telemetry. Emails, tokens, keys and card-like numbers are redacted before anything is evaluated or saved.",
  },
  {
    icon: <TerminalIcon />,
    title: "Built for CI",
    body: "Deterministic JSON and JUnit reports, and exit codes 0, 1, 2 and 3. Two runs of the same recording are byte-identical.",
    size: "full",
  },
];

const KINDS = [
  { name: "exact", note: "Deep equality against a stored expectation." },
  { name: "structural", note: "JSON shape, schema, fields, types and ranges." },
  { name: "rule", note: "Forbidden content, length caps, tool-call constraints." },
  { name: "heuristic", note: "Deterministic but approximate: refusal phrasing, lexical similarity." },
  { name: "semantic", note: "Judged by an evaluator you supply. Flagged when it uses an external service." },
  { name: "custom", note: "Your own function. A throw means unevaluable, never fail." },
];

const STEPS = [
  { id: "record", title: "Record", body: "Run your app once and commit the redacted recording. This is the only step that needs a model." },
  { id: "replay", title: "Replay", body: "CI re-evaluates the committed outputs offline, so parsing and assertion changes are caught without a key." },
  { id: "diff", title: "Diff", body: "Each assertion is compared with its baseline status. Regressions block the build." },
] as const;

export function Home() {
  const { current, diff } = hero;
  return (
    <main id="main" tabIndex={-1} className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="pill">
            <span className="pill-dot" /> v{PKG.version} · offline, provider-independent
          </p>
          <h1 className="hero-title">
            Catch AI output <span className="hero-mark">regressions</span> before they ship.
          </h1>
          <p className="hero-lead">
            m2aitestkit never calls a model. Point it at what your app produced and it tells you, per
            assertion, whether the output passed, failed or could not be evaluated reliably, and
            what changed since your last known-good run.
          </p>
          <Install />
          <div className="hero-actions">
            <a className="btn primary" href={docHref("getting-started")}>
              Get started <ArrowRight width={16} height={16} />
            </a>
            <a className="btn" href="#playground">Open the playground</a>
            <a className="btn ghost" href={REPO} target="_blank" rel="noreferrer">
              <GitHubIcon width={16} height={16} /> GitHub
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <Ledger report={current} diff={diff} />
        </div>
      </section>

      <section className="facts" aria-label="Facts">
        <div><strong>0</strong><span>runtime dependencies</span></div>
        <div><strong>{PKG.node.replace(">=", "Node ≥")}</strong><span>ESM only, ships its own types</span></div>
        <div><strong>3</strong><span>outcomes: pass, fail, unevaluable</span></div>
        <div><strong>0 · 1 · 2 · 3</strong><span>ok, failed, bad input, unevaluable</span></div>
      </section>

      <section className="section" id="outcomes" aria-labelledby="outcomes-title">
        <div className="section-head">
          <p className="eyebrow">Three outcomes, not two</p>
          <h2 id="outcomes-title" className="section-title">A check that couldn’t run is not a pass.</h2>
          <p className="section-lead">
            Most test tools collapse “couldn’t tell” into green. m2aitestkit keeps it separate and
            fails CI on it by default.
          </p>
        </div>
        <div className="directions">
          <article className="direction">
            <header>
              <span className="direction-tag">Pass</span>
              <h3>The requirement held.</h3>
            </header>
            <p>The assertion ran and the output satisfied it.</p>
            <div className="flow" aria-hidden="true">
              <span>output</span><i /><span>assertion</span>
            </div>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> Exit code 0.</p>
          </article>
          <article className="direction">
            <header>
              <span className="direction-tag alt">Fail</span>
              <h3>The requirement was broken.</h3>
            </header>
            <p>The assertion ran and the output violated it. The message names the rule, never the offending text.</p>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> Exit code 1. pass → fail blocks the build.</p>
          </article>
          <article className="direction unknown">
            <header>
              <span className="direction-tag muted">Unevaluable</span>
              <h3>Nobody can say.</h3>
            </header>
            <p>Malformed JSON, a crashing custom check, a dead evaluator, or a stale or missing recording. Never silently a pass.</p>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> Exit code 3, unless you opt out.</p>
          </article>
        </div>
      </section>

      <section className="section" id="why" aria-labelledby="why-title">
        <div className="section-head">
          <p className="eyebrow">What you get</p>
          <h2 id="why-title" className="section-title">Tests that don’t hit a paid, non-deterministic API on every run.</h2>
        </div>
        <ul className="bento">
          {FEATURES.map((f) => (
            <li key={f.title} className="bento-item" data-size={f.size}>
              <span className="bento-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" id="workflow" aria-labelledby="workflow-title">
        <div className="section-head">
          <p className="eyebrow">Workflow</p>
          <h2 id="workflow-title" className="section-title">Record once. Replay forever. Diff on every change.</h2>
          <p className="section-lead">
            One workflow, aimed at one problem: outputs your code depends on drifting quietly when a
            prompt, model or retrieval step changes.
          </p>
        </div>
        <div className="rail">
          {STEPS.map((step, i) => (
            <section key={step.id} className="rail-col" data-phase={step.id} aria-label={step.title}>
              <header>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </header>
              <ol>
                <li>
                  <span className="rail-n">{i + 1}</span>
                  <pre><code>{["m2aitestkit record .", "m2aitestkit run .", "m2aitestkit run . --update-baseline"][i]}</code></pre>
                </li>
              </ol>
            </section>
          ))}
        </div>
        <p className="rail-note">
          A green replay says your assertions and parsing still hold on the recorded output. To
          detect model drift, re-record or run <code>--live</code>. <a href={docHref("limitations")}>Read the limitations →</a>
        </p>
      </section>

      <section className="section" id="how" aria-labelledby="how-title">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="section-title">From a suite file, from a test runner, from CI.</h2>
        </div>
        <ol className="steps">
          <li className="step">
            <span className="step-n">1</span>
            <h3>Write a suite</h3>
            <p>Your app runs behind <code>run()</code>, with any provider. Assertions are plain functions.</p>
            <Snippet name="suite" />
          </li>
          <li className="step">
            <span className="step-n">2</span>
            <h3>Record, then run</h3>
            <p>Commit <code>.m2aitestkit</code>. Later runs replay it offline and diff against the baseline.</p>
            <Snippet name="cli" />
          </li>
          <li className="step">
            <span className="step-n">3</span>
            <h3>Gate the pull request</h3>
            <p>No API key in CI. A JUnit file feeds your usual test reporting.</p>
            <Snippet name="ci" />
            <Snippet name="api" />
          </li>
        </ol>
      </section>

      <Playground />

      <section className="section" id="kinds" aria-labelledby="kinds-title">
        <div className="section-head">
          <p className="eyebrow">Assertion kinds</p>
          <h2 id="kinds-title" className="section-title">Every check says how much weight it can bear.</h2>
          <p className="section-lead">
            Reports label each assertion, so a heuristic is never read as proof.
          </p>
        </div>
        <ul className="policies">
          {KINDS.map((p) => (
            <li key={p.name}>
              <code>{p.name}</code>
              <span>{p.note}</span>
            </li>
          ))}
        </ul>
        <p className="rail-note"><a href={docHref("assertions")}>See every built-in assertion →</a></p>
      </section>

      <section className="section" id="docs" aria-labelledby="docs-title">
        <div className="section-head">
          <p className="eyebrow">Documentation</p>
          <h2 id="docs-title" className="section-title">Everything is written down.</h2>
        </div>
        <div className="docs-grid">
          {DOC_PAGES.map((item) => (
            <a key={item.slug} className="doc-card" href={docHref(item.slug)}>
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
              <ArrowRight width={16} height={16} />
            </a>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="related-title">
        <div className="section-head">
          <p className="eyebrow">More from M2Toolkit</p>
          <h2 id="related-title" className="section-title">Other packages we publish.</h2>
        </div>
        <div className="related">
          {RELATED.map((p) => (
            <a key={p.slug} className="related-card" href={p.url} style={{ ["--tint" as string]: p.accent }}>
              <strong>{p.title}</strong>
              <span>{p.tagline}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>m2aitestkit</strong> v{PKG.version} · {PKG.license} licence ·{" "}
          <a href={M2TOOLKIT}>M2Toolkit</a>
        </div>
        <nav aria-label="Footer">
          <a href={NPM_URL} target="_blank" rel="noreferrer">npm</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={PACKAGES_URL}>All packages</a>
        </nav>
      </footer>
    </main>
  );
}
