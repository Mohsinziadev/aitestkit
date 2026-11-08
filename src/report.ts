import type { Comparison, Diff } from './baseline.ts';
import type { RunReport, Status } from './types.ts';

const MARK: Record<Status, string> = { pass: 'PASS', fail: 'FAIL', unevaluable: 'UNEVALUABLE' };

export function formatPretty(report: RunReport, diff?: Diff): string {
  const L: string[] = [];
  const { cases, assertions } = report.summary;
  L.push(`Suite: ${report.suite}  (mode: ${report.mode})`);
  for (const c of report.cases) {
    L.push(`  ${MARK[c.status].padEnd(11)} ${c.id}`);
    for (const a of c.assertions) {
      if (a.status === 'pass') continue;
      const ext = a.usesExternalService ? ' [external evaluator]' : '';
      L.push(`      ${MARK[a.status].toLowerCase()} ${a.id} <${a.kind}>${ext}${a.message ? ': ' + a.message : ''}`);
    }
  }
  L.push('');
  L.push(`Cases:      ${cases.pass} passed, ${cases.fail} failed, ${cases.unevaluable} unevaluable`);
  L.push(`Assertions: ${assertions.pass} passed, ${assertions.fail} failed, ${assertions.unevaluable} unevaluable`);
  if (assertions.unevaluable) L.push('Unevaluable means the check could not run reliably; it is NOT a pass.');
  if (diff) {
    L.push('');
    L.push(`Baseline: ${diff.regressions} regression(s), ${diff.changes.length} change(s)`);
    for (const ch of diff.changes) {
      const where = ch.assertionId ? `${ch.caseId} :: ${ch.assertionId}` : ch.caseId;
      const arrow = ch.from || ch.to ? `  (${ch.from ?? '-'} -> ${ch.to ?? '-'})` : '';
      L.push(`  ${ch.kind.toUpperCase().padEnd(14)} ${where}${arrow}`);
    }
  }
  return L.join('\n') + '\n';
}

export function formatComparison(c: Comparison): string {
  const L: string[] = [`Comparison: ${c.suite}  (A -> B)`];
  L.push('Exact-match and lexical columns describe text drift only; they do not measure correctness.');
  for (const k of c.cases) {
    const exact = k.exactTextMatch === null ? 'n/a' : k.exactTextMatch ? 'identical' : 'differs';
    const sim = k.lexicalSimilarity === null ? 'n/a' : k.lexicalSimilarity.toFixed(2);
    L.push(`  ${k.id}: text ${exact}, lexical overlap ${sim}`);
  }
  L.push('');
  L.push(`Assertion changes A -> B: ${c.diff.regressions} regression(s)`);
  for (const ch of c.diff.changes.filter((x) => x.kind !== 'output-changed')) {
    L.push(`  ${ch.kind.toUpperCase().padEnd(14)} ${ch.caseId}${ch.assertionId ? ' :: ' + ch.assertionId : ''}  (${ch.from ?? '-'} -> ${ch.to ?? '-'})`);
  }
  return L.join('\n') + '\n';
}

const esc = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

/** JUnit XML, understood by most CI systems. `unevaluable` is reported as an error. */
export function formatJUnit(reports: RunReport[]): string {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<testsuites>'];
  for (const r of reports) {
    const total = r.summary.assertions.pass + r.summary.assertions.fail + r.summary.assertions.unevaluable;
    out.push(`  <testsuite name="${esc(r.suite)}" tests="${total}" failures="${r.summary.assertions.fail}" errors="${r.summary.assertions.unevaluable}">`);
    for (const c of r.cases) {
      for (const a of c.assertions) {
        const head = `    <testcase classname="${esc(r.suite)}.${esc(c.id)}" name="${esc(a.id)}"`;
        if (a.status === 'pass') out.push(head + '/>');
        else {
          const tag = a.status === 'fail' ? 'failure' : 'error';
          out.push(`${head}>`, `      <${tag} message="${esc(a.message ?? a.status)}"/>`, '    </testcase>');
        }
      }
    }
    out.push('  </testsuite>');
  }
  out.push('</testsuites>');
  return out.join('\n') + '\n';
}
