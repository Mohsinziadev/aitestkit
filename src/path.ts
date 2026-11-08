export type PathLookup = { found: true; value: unknown } | { found: false };

/** Resolves paths like `user.tags[0].name`. A leading `$.` is accepted. */
export function getPath(root: unknown, path: string): PathLookup {
  const parts = parsePath(path);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return { found: false };
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return { found: false };
    cur = (cur as Record<string, unknown>)[part];
  }
  return { found: true, value: cur };
}

export function parsePath(path: string): string[] {
  const p = path.replace(/^\$\.?/, '');
  if (p === '') return [];
  const parts: string[] = [];
  for (const seg of p.split('.')) {
    const m = seg.match(/^([^[\]]*)((?:\[\d+\])*)$/);
    if (!m) {
      parts.push(seg);
      continue;
    }
    if (m[1]) parts.push(m[1]);
    for (const idx of m[2]!.matchAll(/\[(\d+)\]/g)) parts.push(idx[1]!);
  }
  return parts;
}
