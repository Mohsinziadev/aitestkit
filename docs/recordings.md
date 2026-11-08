# Recordings & Baselines

## Record

```bash
m2aitestkit record .
```

Calls `run()` for every case and writes `.m2aitestkit/recordings/<suite>.json`. A recording holds, per case, the redacted output, a SHA-256 of the redacted input and any metadata. It has no timestamps, durations or absolute paths, and keys are sorted, so it diffs cleanly in review.

Redaction happens **before** evaluation, so what you test is what you committed. See [Privacy & Redaction](privacy.md).

## Replay

```bash
m2aitestkit run .
```

Replay evaluates the committed outputs and never calls your application. If a case's input changed since it was recorded, the case is `unevaluable` with a "recording is stale" message rather than silently reusing an old output. A case with no recording and no saved `output` is also `unevaluable`.

## Baseline

```bash
m2aitestkit run . --update-baseline    # save this run as .m2aitestkit/baselines/<suite>.json
m2aitestkit run .                      # later runs diff against it
```

```
$ m2aitestkit run .
Suite: support-bot  (mode: replay)
  FAIL        refund-request
      fail forbid(competitor-mention) <rule>: output matched disallowed rule(s): competitor-mention

Baseline: 1 regression(s), 2 change(s)
  REGRESSED      refund-request :: forbid(competitor-mention)  (pass -> fail)
  OUTPUT-CHANGED refund-request
```

`REGRESSED` blocks CI. `OUTPUT-CHANGED` (the stored output differs but assertions still pass) is informational. Removed cases and assertions are always listed.

## Live

`--live` calls `run()` instead of replaying. Use it to check a real model before you re-record. Live output is non-deterministic: record one sample per case, or run `--live` several times. There is no built-in repeat or flakiness statistic.

## Comparing prompt versions or models

```bash
m2aitestkit record . && cp .m2aitestkit/recordings/support-bot.json prompt-v3.json
# change the prompt, record again
m2aitestkit compare support-bot.aitest.mjs --a prompt-v3.json --b .m2aitestkit/recordings/support-bot.json
```

The report keeps three things apart: whether the text is **byte-identical**, **lexical overlap** (0 to 1), and **assertion transitions** A → B. Only the last says anything about requirements you wrote. Lexical overlap is not correctness: "The capital of France is Berlin" scores high against "...is Paris", and a unit test in the repository pins that.
