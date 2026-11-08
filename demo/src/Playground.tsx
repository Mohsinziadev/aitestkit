import { useEffect, useMemo, useState } from "react";
import type { AssertionResult, AssertionSpec, Change } from "m2aitestkit";
import { evaluate, type Evaluation } from "../snippets/playground/evaluate";
import { PRESETS, hero } from "./samples";
import { docHref } from "./router";
import { Snippet } from "./Snippet";
import { Verdict } from "./Verdict";

type Edit = { input: string; baseline: string; current: string; assertions: string };
type Tab = "results" | "diff" | "text" | "json";

const initial = (): Record<string, Edit> =>
  Object.fromEntries(
    PRESETS.map((p) => [
      p.id,
      { input: p.input, baseline: p.baseline, current: p.current, assertions: JSON.stringify(p.assertions, null, 2) },
    ]),
  );

function parseAssertions(text: string): AssertionSpec[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new Error("Assertions must be a JSON array.");
  return value as AssertionSpec[];
}

const describe = (c: Change) => {
  const where = c.assertionId ?? "case";
  const arrow = c.from || c.to ? ` (${c.from ?? "-"} → ${c.to ?? "-"})` : "";
  return { where, arrow };
};

function ResultRow({ before, after }: { before?: AssertionResult; after: AssertionResult }) {
  const regressed = before?.status === "pass" && after.status !== "pass";
  return (
    <li className="finding" data-severity={after.status === "pass" ? "info" : after.status === "fail" ? "error" : "warning"}>
      <div className="finding-top">
        <code className="finding-rule">{after.id}</code>
        <span className="chip soft">{after.kind}</span>
        {regressed && <span className="chip" data-severity="error">regressed</span>}
      </div>
      <div className="finding-verdicts" style={{ marginTop: 8 }}>
        {before && <Verdict label="baseline" value={before.status} />}
        <Verdict label="now" value={after.status} />
      </div>
      {after.message && <p className="finding-message" style={{ fontWeight: 500, marginBottom: 0 }}>{after.message}</p>}
    </li>
  );
}

export function Playground() {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const [edits, setEdits] = useState(initial);
  const [tab, setTab] = useState<Tab>("results");
  const edit = edits[preset.id]!;
  const [outcome, setOutcome] = useState<{ ok: true; value: Evaluation } | { ok: false; error: string }>({ ok: true, value: hero });

  // The first render shows the build-time result, so the prerendered page and the hydrated page match.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const value = await evaluate({ ...edit, assertions: parseAssertions(edit.assertions) });
        if (live) setOutcome({ ok: true, value });
      } catch (error) {
        if (live) setOutcome({ ok: false, error: (error as Error).message });
      }
    })();
    return () => {
      live = false;
    };
  }, [edit]);

  const patch = (next: Partial<Edit>) => setEdits((all) => ({ ...all, [preset.id]: { ...all[preset.id]!, ...next } }));
  const result = outcome.ok ? outcome.value : undefined;
  const rows = useMemo(() => {
    if (!result) return [];
    const before = new Map(result.baseline.cases[0]?.assertions.map((a) => [a.id, a]));
    return (result.current.cases[0]?.assertions ?? []).map((after) => ({ before: before.get(after.id), after }));
  }, [result]);
  const blocked = result ? result.diff.regressions > 0 || result.current.summary.assertions.fail > 0 : false;
  const unevaluable = result?.current.summary.assertions.unevaluable ?? 0;

  return (
    <section className="section playground" id="playground" aria-labelledby="playground-title">
      <div className="section-head">
        <p className="eyebrow">Playground</p>
        <h2 id="playground-title" className="section-title">Change the output. Watch the gate react.</h2>
        <p className="section-lead">
          This runs the m2aitestkit source from this repository in your browser: the same assertions, the
          same replay and the same baseline diff as the CLI. Nothing is mocked and nothing is uploaded.
        </p>
      </div>

      <div className="pg-presets" role="tablist" aria-label="Example">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === preset.id} onClick={() => setPresetId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="pg">
        <div className="pg-editors">
          <label className="pg-field">
            <span>known-good output · recorded and committed</span>
            <textarea spellCheck={false} value={edit.baseline} onChange={(e) => patch({ baseline: e.target.value })} />
          </label>
          <label className="pg-field">
            <span>output today · after a prompt or model change</span>
            <textarea spellCheck={false} value={edit.current} onChange={(e) => patch({ current: e.target.value })} />
          </label>
          <label className="pg-field">
            <span>assertions · the JSON suite format</span>
            <textarea spellCheck={false} value={edit.assertions} onChange={(e) => patch({ assertions: e.target.value })} />
          </label>
        </div>

        <div className="pg-output" aria-live="polite">
          <div className="pg-tabs" role="tablist" aria-label="Output">
            {(
              [
                ["results", "Assertions"],
                ["diff", "Baseline diff"],
                ["text", "CLI text"],
                ["json", "JSON"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {!result ? (
            <div className="pg-error" role="alert">
              <strong>Could not evaluate these inputs</strong>
              <p>{outcome.ok ? "" : outcome.error}</p>
            </div>
          ) : (
            <>
              <div className="verdict" data-passed={!blocked}>
                <strong>{blocked ? "Blocked" : unevaluable ? "Passed, with unevaluable checks" : "Passed"}</strong>
                <span>
                  {result.current.summary.assertions.pass} pass · {result.current.summary.assertions.fail} fail ·{" "}
                  {unevaluable} unevaluable · {result.diff.regressions} regression{result.diff.regressions === 1 ? "" : "s"}
                </span>
              </div>
              {tab === "results" && (
                <ul className="findings">
                  {rows.map(({ before, after }) => <ResultRow key={after.id} before={before} after={after} />)}
                </ul>
              )}
              {tab === "diff" &&
                (result.diff.changes.length ? (
                  <ul className="findings">
                    {result.diff.changes.map((c, i) => {
                      const { where, arrow } = describe(c);
                      return (
                        <li key={i} className="finding" data-severity={c.kind === "regressed" ? "error" : c.kind === "fixed" ? "info" : "warning"}>
                          <div className="finding-top">
                            <span className="chip" data-severity={c.kind === "regressed" ? "error" : c.kind === "fixed" ? "info" : "warning"}>{c.kind}</span>
                            <code className="finding-rule">{where}</code>
                            <span className="finding-name">{arrow}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="pg-empty">No assertion changed status and the output is identical.</p>
                ))}
              {tab === "text" && <pre className="pg-json"><code>{result.text}</code></pre>}
              {tab === "json" && <pre className="pg-json"><code>{JSON.stringify({ report: result.current, diff: result.diff }, null, 2)}</code></pre>}
            </>
          )}
        </div>
      </div>

      <p className="pg-note">
        {preset.note} <a href={docHref("concepts")}>How the outcomes work →</a>
      </p>

      <details className="pg-source">
        <summary>The code behind this panel</summary>
        <Snippet name="playground/evaluate" />
      </details>
    </section>
  );
}
