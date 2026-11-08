import { createHash } from 'node:crypto';

/** JSON.stringify with sorted object keys, so equal values always serialize identically. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return canonicalize(a) === canonicalize(b);
}
