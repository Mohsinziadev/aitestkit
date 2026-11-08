# CLI & CI

```
m2aitestkit <command> [options]

Commands
  run <suite|dir>...      Evaluate suites against recordings (default) or live
  record <suite|dir>...   Call suite.run for each case and save redacted recordings
  compare <suite>         Evaluate one suite against two recordings (--a, --b)
```

Directories are searched recursively for `*.aitest.json|js|mjs|ts|mts`. `node_modules` and dot-folders are skipped.

## Options

| Option | Meaning |
|---|---|
| `--format pretty\|json\|junit` | Report format. Default `pretty`. |
| `--output <file>` | Write the report to a file instead of stdout. |
| `--recordings-dir <dir>` | Default `.m2aitestkit/recordings`. |
| `--baseline-dir <dir>` | Default `.m2aitestkit/baselines`. |
| `--update-baseline` | Save this run as the new baseline (`run`). |
| `--live` | Call `suite.run` instead of replaying (`run`). |
| `--allow-unevaluable` | Don't fail the build on unevaluable assertions. |
| `--no-redact` | Disable built-in redaction when recording. |
| `--a <file> --b <file>` | Recordings to compare. |

## Exit codes

| Exit | Meaning |
|---|---|
| 0 | All assertions passed, no regressions. |
| 1 | An assertion failed, or a baseline regression. |
| 2 | Usage or load error: bad flag, missing file, invalid suite. |
| 3 | Nothing failed, but some assertions were `unevaluable` (`--allow-unevaluable` to accept). |

`record` always exits 0 unless it hits a usage or load error.

## Formats

- **pretty**: human-readable, as in [Recordings & Baselines](recordings.md).
- **json**: stable and machine-readable, with sorted keys.
- **junit**: understood by most CI systems. `unevaluable` is reported as an `<error>`, `fail` as a `<failure>`.

## GitHub Actions

```yaml
- run: npm ci
- run: npx m2aitestkit run . --format junit --output m2aitestkit.xml
```

No API key is needed: replay only reads committed files. Run `record` or `--live` on a schedule, or by hand, where the key is available.
