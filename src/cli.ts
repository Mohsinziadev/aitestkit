#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { compareRecordings, diffReports, type Diff } from './baseline.ts';
import { fileSafe, loadRecording, loadReport, loadSuite, stableStringify, writeJson } from './files.ts';
import { formatComparison, formatJUnit, formatPretty } from './report.ts';
import { createRedactor } from './redact.ts';
import { runSuite } from './runner.ts';
import { writeFile } from 'node:fs/promises';
import type { RunMode, RunReport } from './types.ts';

const USAGE = `m2aitestkit <command> [options]

Commands
  run <suite|dir>...      Evaluate suites against recordings (default) or live
  record <suite|dir>...   Call suite.run for each case and save redacted recordings
  compare <suite>         Evaluate one suite against two recordings (--a, --b)

Options
  --format pretty|json|junit   Output format (default pretty)
  --output <file>              Write the report to a file instead of stdout
  --recordings-dir <dir>       Default .m2aitestkit/recordings
  --baseline-dir <dir>         Default .m2aitestkit/baselines
  --update-baseline            Save this run as the new baseline (run)
  --live                       Call suite.run instead of replaying (run)
  --allow-unevaluable          Do not fail the build on unevaluable assertions
  --no-redact                  Disable built-in redaction when recording
  --a <file> --b <file>        Recordings to compare

Exit codes
  0 all passed   1 failures or baseline regressions
  2 usage/load error   3 only unevaluable assertions (see --allow-unevaluable)
`;

class UsageError extends Error {}

async function findSuiteFiles(args: string[]): Promise<string[]> {
  const out: string[] = [];
  const walk = async (p: string) => {
    const s = await stat(p).catch(() => null);
    if (!s) throw new UsageError(`no such file or directory: ${p}`);
    if (!s.isDirectory()) return void out.push(p);
    for (const e of (await readdir(p, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(p, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.aitest\.(json|m?js|m?ts)$/.test(e.name)) out.push(full);
    }
  };
  for (const a of args) await walk(a);
  if (!out.length) throw new UsageError('no suite files found (expected *.aitest.json, *.aitest.mjs, ...)');
  return out;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: 'string', default: 'pretty' },
      output: { type: 'string' },
      'recordings-dir': { type: 'string', default: '.m2aitestkit/recordings' },
      'baseline-dir': { type: 'string', default: '.m2aitestkit/baselines' },
      'update-baseline': { type: 'boolean', default: false },
      live: { type: 'boolean', default: false },
      'allow-unevaluable': { type: 'boolean', default: false },
      'no-redact': { type: 'boolean', default: false },
      a: { type: 'string' },
      b: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [cmd, ...rest] = positionals;
  if (values.help || !cmd) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 2;
  }
  if (!['pretty', 'json', 'junit'].includes(values.format!)) throw new UsageError(`unknown --format ${values.format}`);
  const emit = async (text: string) => {
    if (values.output) await writeFile(values.output, text);
    else process.stdout.write(text);
  };

  if (cmd === 'compare') {
    if (rest.length !== 1 || !values.a || !values.b) throw new UsageError('usage: m2aitestkit compare <suite> --a <recording> --b <recording>');
    const suite = await loadSuite(rest[0]!);
    const cmp = await compareRecordings(suite, await loadRecording(values.a), await loadRecording(values.b));
    await emit(values.format === 'json' ? stableStringify(cmp) : formatComparison(cmp));
    return cmp.diff.regressions > 0 ? 1 : 0;
  }

  if (cmd !== 'run' && cmd !== 'record') throw new UsageError(`unknown command "${cmd}"`);
  const files = await findSuiteFiles(rest);
  const reports: { report: RunReport; diff?: Diff }[] = [];

  for (const file of files) {
    const suite = await loadSuite(file);
    const recPath = join(values['recordings-dir']!, `${fileSafe(suite.name)}.json`);
    const basePath = join(values['baseline-dir']!, `${fileSafe(suite.name)}.json`);
    const mode: RunMode = cmd === 'record' ? 'record' : values.live ? 'live' : 'replay';
    const recording = mode === 'replay' && existsSync(recPath) ? await loadRecording(recPath) : undefined;
    const redactor = createRedactor({ ...suite.redact, ...(values['no-redact'] ? { builtins: false } : {}) });
    const { report, recording: rec } = await runSuite(suite, { mode, ...(recording ? { recording } : {}), redactor });
    if (rec) await writeJson(recPath, rec);

    let diff: Diff | undefined;
    if (cmd === 'run') {
      if (values['update-baseline']) await writeJson(basePath, report);
      else if (existsSync(basePath)) diff = diffReports(await loadReport(basePath), report);
    }
    reports.push({ report, ...(diff ? { diff } : {}) });
  }

  if (values.format === 'json') await emit(stableStringify({ reports }));
  else if (values.format === 'junit') await emit(formatJUnit(reports.map((r) => r.report)));
  else await emit(reports.map((r) => formatPretty(r.report, r.diff)).join('\n'));

  const a = reports.reduce(
    (t, r) => ({
      fail: t.fail + r.report.summary.assertions.fail,
      unev: t.unev + r.report.summary.assertions.unevaluable,
      reg: t.reg + (r.diff?.regressions ?? 0),
    }),
    { fail: 0, unev: 0, reg: 0 },
  );
  if (cmd === 'record') return 0;
  if (a.fail || a.reg) return 1;
  if (a.unev && !values['allow-unevaluable']) return 3;
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    process.stderr.write(`m2aitestkit: ${e instanceof Error ? e.message : String(e)}\n`);
    if (e instanceof UsageError || (e as { code?: string })?.code?.startsWith?.('ERR_PARSE_ARGS')) process.stderr.write('\n' + USAGE);
    process.exit(2);
  },
);
