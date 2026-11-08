import type { Status } from "m2aitestkit";

const MARK: Record<Status, string> = { pass: "✓", fail: "✕", unevaluable: "?" };
const TONE: Record<Status, string> = { pass: "compatible", fail: "incompatible", unevaluable: "unknown" };

/** One assertion status: a glyph and its word, never colour alone. */
export function Verdict({ label, value }: { label?: string; value: Status }) {
  return (
    <span className="verdict-pill" data-compat={TONE[value]}>
      {label && <span className="verdict-label">{label}</span>}
      <span className="verdict-mark" aria-hidden="true">{MARK[value]}</span>
      <span className="verdict-word">{value}</span>
    </span>
  );
}
