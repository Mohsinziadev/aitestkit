# Comparison

Verified against vendor documentation on 2026-10-30. Pages change, so check them.

| | Offline deterministic assertions | Evaluate pre-recorded outputs | Replay / cache | Notes |
|---|---|---|---|---|
| **promptfoo** | Yes: `is-json` with schema, `contains-json`, `is-refusal`, tool-call assertions, `javascript` | Yes: `--model-outputs` with deterministic assertion files | Local disk cache (default `~/.promptfoo/cache`, 14-day TTL). Key formats are documented as implementation details; no committed snapshot described | Much broader: many providers, red-teaming, model-graded assertions, web UI |
| **vitest-evals** | Yes: `StructuredOutputJudge`, `ToolCallJudge` | Not verified | Not verified | Vitest-only. Also has an LLM-backed `FactualityJudge` |
| **Evalite** | Not verified | Not verified | Not verified | "TypeScript-native, local-first tool for testing LLM-powered apps". The README gave no detail on snapshots or regressions |
| **DeepEval / RAGAS** | Mostly LLM-metric based, per third-party comparisons | Not verified | Not verified | Python. Cost scales with LLM-judged metrics |

## Where m2aitestkit is different, and where it isn't

promptfoo can already assert on structured output and score saved outputs without a provider. If you use promptfoo, you don't *need* m2aitestkit for that.

m2aitestkit's narrower claims are:

- a documented, stable, redacted, commit-friendly recording format;
- a `pass` / `fail` / `unevaluable` model enforced by exit codes;
- assertion-level baseline diffs;
- a library-first API that works from any test runner.

It is much smaller and far less featureful.
