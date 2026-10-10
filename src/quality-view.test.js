import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReport } from './quality.js';
import { prioritizeIssues, issueSource } from './quality-view.js';

const report = '胸部 CT\n检查所见\n右肺上叶见一枚结节，大小约 6 mm。\n检查结论\n右肺上叶结节，大小约 8 mm。';

test('presentation puts explicit text conflicts first without changing rule results', () => {
  const result = analyzeReport(report);
  const original = structuredClone(result);
  const ordered = prioritizeIssues(result.issues);
  assert.equal(ordered[0].id, 'dimension-conflict');
  assert.deepEqual(result, original);
  assert.deepEqual(ordered.map(issue => issue.id).sort(), result.issues.map(issue => issue.id).sort());
  assert.equal(ordered[0], result.issues.at(-1));
});

test('unhandled issues stay ahead of recorded issues with stable source order', () => {
  const issues = analyzeReport(report).issues;
  const ordered = prioritizeIssues(issues, { 'dimension-conflict': '已核对，保留原文' });
  assert.deepEqual(ordered.map(issue => issue.id), [
    'nodule-1.missing-density', 'nodule-2.missing-density', 'dimension-conflict',
  ]);
  assert.deepEqual(prioritizeIssues(), []);
});

test('source labels distinguish findings, conclusions and cross-section evidence', () => {
  for (const [findings, conclusion] of [['检查所见', '检查结论'], ['影像所见', '影像诊断']]) {
    const text = report.replace('检查所见', findings).replace('检查结论', conclusion);
    const issues = analyzeReport(text).issues;
    assert.equal(issueSource(issues[0], text), findings);
    assert.equal(issueSource(issues[1], text), conclusion);
    assert.equal(issueSource(issues[2], text), `${findings} ↔ ${conclusion}`);
  }
});

test('missing, invalid or stale evidence never claims a source section', () => {
  const issue = analyzeReport(report).issues[0];
  for (const invalid of [{ ...issue, start: null }, { ...issue, start: -1 }, { ...issue, end: report.length + 1 }, { ...issue, end: issue.start }]) {
    assert.equal(issueSource(invalid, report), '原文片段');
  }
  assert.equal(issueSource(issue, report.replace('右肺', '左肺')), '原文片段');
  assert.equal(issueSource(issue, ''), '原文片段');
  assert.equal(issueSource(issue, null), '原文片段');
  const plain = '胸部 CT：右肺上叶见结节。';
  assert.equal(issueSource(analyzeReport(plain).issues[0], plain), '原文片段');
});


