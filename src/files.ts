import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize } from './canonical.ts';
import { suiteFromSpec } from './spec.ts';
import type { Recording, RunReport, Suite } from './types.ts';

/** Stable, human-diffable JSON: sorted keys, 2-space indent, trailing newline, no timestamps. */
export function stableStringify(v: unknown): string {
  return JSON.stringify(JSON.parse(canonicalize(v)), null, 2) + '\n';
}

export async function writeJson(path: string, v: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableStringify(v));
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function loadRecording(path: string): Promise<Recording> {
  const r = await readJson<Recording>(path);
  if (r?.version !== 1 || !Array.isArray(r.entries)) throw new Error(`${path} is not an m2aitestkit recording (version 1)`);
  return r;
}

export async function loadReport(path: string): Promise<RunReport> {
  const r = await readJson<RunReport>(path);
  if (r?.version !== 1 || !Array.isArray(r.cases)) throw new Error(`${path} is not an m2aitestkit report (version 1)`);
  return r;
}

/**
 * Loads a suite from `.json` (declarative) or `.js/.mjs/.ts/.mts` (default export of a
 * Suite, or a function returning one). TypeScript files need a Node that strips types
 * (22.18+) or a loader such as tsx.
 */
export async function loadSuite(file: string): Promise<Suite> {
  const abs = resolve(file);
  if (extname(abs) === '.json') return suiteFromSpec(JSON.parse(await readFile(abs, 'utf8')));
  const mod = await import(pathToFileURL(abs).href);
  const exp = mod.default ?? mod.suite;
  const suite = typeof exp === 'function' ? await exp() : exp;
  if (!suite || typeof suite.name !== 'string' || !Array.isArray(suite.cases)) {
    throw new Error(`${file} must default-export a suite ({ name, cases }) or a function returning one`);
  }
  return suite as Suite;
}

export function fileSafe(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
}
