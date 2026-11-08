# Privacy & Redaction

## What m2aitestkit does not do

- **No network access, no telemetry, no uploads.** The package makes no outbound calls. The only way data leaves the process is an evaluator or `run()` function that **you** write.
- **Reports don't print inputs or outputs.** Built-in assertion messages state the path or rule that failed, not the value. Messages from your own `custom` checks and evaluators are passed through the redactor, but you decide what they say.

## What recordings contain

Recordings are redacted by default, in `record` and `--live`. They hold the redacted output, a SHA-256 of the **redacted** input (the raw input is not stored) and your metadata. Report `outputHash` values are truncated hashes of the redacted output.

## Built-in patterns

| Name | Matches |
|---|---|
| `email` | Email addresses |
| `jwt` | JSON Web Tokens |
| `bearer` | `Bearer …` tokens |
| `api-key` | Common provider key shapes (`sk-…`, `ghp_…`, `AKIA…`, `xox…-…`) |
| `card` | Card-like digit runs |
| `ssn` | `123-45-6789` shapes |
| `phone` | Common phone number shapes |

Matches are replaced with `[REDACTED:<name>]`.

## Adding your own

```js
export default defineSuite({
  name: 'support-bot',
  redact: {
    patterns: [{ name: 'order-id', pattern: /ORD-\d{6}/g, replacement: '[ORDER]' }],
    transform: (s) => s.replaceAll('Initech', 'ACME'),
  },
  cases: [/* … */],
});
```

`--no-redact` disables the built-ins; recordings are then verbatim.

## What it will miss

Redaction is regex matching. It will miss names, addresses and free-text personal data, and its patterns are biased toward US and English formats. **Review recordings before committing them.**
