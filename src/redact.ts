import type { Output, RedactOptions, RedactPattern } from './types.ts';

/**
 * Best-effort patterns. Redaction is pattern matching, not a privacy guarantee:
 * review recordings before committing them.
 */
export const BUILTIN_PATTERNS: RedactPattern[] = [
  { name: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g },
  { name: 'api-key', pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
  { name: 'card', pattern: /\b(?:\d[ -]?){13,16}\b/g },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'phone', pattern: /(?<!\d)\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]\d{3,4}[ .-]\d{3,4}(?!\d)/g },
];

export interface Redactor {
  string(s: string): string;
  value<T>(v: T): T;
  output(o: Output): Output;
}

export function createRedactor(opts: RedactOptions = {}): Redactor {
  const patterns = [...(opts.builtins === false ? [] : BUILTIN_PATTERNS), ...(opts.patterns ?? [])];
  const string = (s: string): string => {
    let out = s;
    for (const p of patterns) {
      const re = new RegExp(p.pattern.source, p.pattern.flags.includes('g') ? p.pattern.flags : p.pattern.flags + 'g');
      out = out.replace(re, p.replacement ?? `[REDACTED:${p.name}]`);
    }
    return opts.transform ? opts.transform(out) : out;
  };
  const value = <T>(v: T): T => walk(v, string) as T;
  return {
    string,
    value,
    output: (o) => value(o),
  };
}

function walk(v: unknown, f: (s: string) => string): unknown {
  if (typeof v === 'string') return f(v);
  if (Array.isArray(v)) return v.map((x) => walk(x, f));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = walk(x, f);
    return out;
  }
  return v;
}

export const noRedaction: Redactor = {
  string: (s) => s,
  value: (v) => v,
  output: (o) => o,
};
