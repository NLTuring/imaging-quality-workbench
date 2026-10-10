import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReport } from './quality.js';

const conflict = text => analyzeReport(text).issues.some(i => i.id === 'dimension-conflict');

test('empty and non-string inputs are explicit and safe', () => {
  for (const input of ['', '  ', null, undefined, 123]) {
    const result = analyzeReport(input);
    assert.equal(result.ruleVersion, 'prototype-1');
    assert.equal(result.fields[0].status, '未提及');
    assert.equal(result.fields[0].start, null);
    assert.deepEqual(result.issues, []);
    assert.match(result.coverage, /不作诊断/);
  }
});

test('extracts original dimensions, location, density, and exact evidence offsets', () => {
  const text = '胸部CT：右肺上叶见磨玻璃结节，大小约8×6 mm。';
  const result = analyzeReport(text);
  assert.equal(result.fields.find(f => f.id.endsWith('.dimensions')).value, '8×6 mm');
  assert.equal(result.fields.find(f => f.id.endsWith('.location')).value, '右肺上叶');
  assert.equal(result.fields.find(f => f.id.endsWith('.density')).value, '磨玻璃');
  assert.deepEqual(result.issues, []);
  for (const field of result.fields) assert.equal(text.slice(field.start, field.end), field.evidence);
});

test('negated nodules do not trigger positive completeness checks', () => {
  for (const text of ['胸部CT：双肺未见结节。', '肺内未发现明显结节。', '胸部CT：无明显结节。']) {
    const result = analyzeReport(text);
    assert.equal(result.fields[0].value, '否定描述');
    assert.deepEqual(result.issues, []);
    assert.equal(result.fields.length, 1);
  }
});

test('uncertainty remains explicit rather than becoming a positive or negative diagnosis', () => {
  for (const qualifier of ['未除外', '不能排除', '未能除外', '可疑']) {
    const result = analyzeReport(`胸部CT：右肺上叶${qualifier}结节。`);
    assert.equal(result.fields[0].value, '不确定描述');
    assert.equal(result.fields[0].status, '待确认');
    assert.equal(result.fields.find(f => f.id.endsWith('.dimensions')).status, '待确认');
    assert.equal(result.issues.length, 0);
  }
});

test('outside chest scope does not extract positive nodules', () => {
  const result = analyzeReport('甲状腺见实性结节，8mm。');
  assert.equal(result.fields[0].status, '待确认');
  assert.equal(result.issues.length, 0);
  assert.match(result.coverage, /未确认胸部/);
});

test('missing positive attributes have no fabricated evidence or values', () => {
  const text = '胸部CT：见结节。';
  const result = analyzeReport(text);
  assert.equal(result.issues.length, 3);
  for (const field of result.fields.slice(1)) {
    assert.equal(field.value, '');
    assert.equal(field.evidence, '');
    assert.equal(field.start, null);
    assert.equal(field.end, null);
    assert.equal(field.status, '未提及');
  }
  for (const issue of result.issues) assert.equal(text.slice(issue.start, issue.end), issue.evidence);
  assert.ok(!result.issues.some(i => /随访/.test(i.title)));
});

test('separate nodule mentions have explicit distinct IDs without cross-comparison', () => {
  for (const separator of ['。', '，', '；', '\n']) {
    const result = analyzeReport(`胸部CT：右肺上叶实性结节8mm${separator}左肺下叶磨玻璃结节1.2cm。`);
    const presence = result.fields.filter(f => f.id.endsWith('.presence'));
    assert.deepEqual(presence.map(f => f.id), ['nodule-1.presence', 'nodule-2.presence']);
    assert.equal(result.fields.find(f => f.id === 'nodule-1.dimensions').value, '8mm');
    assert.equal(result.fields.find(f => f.id === 'nodule-2.dimensions').value, '1.2cm');
    assert.ok(!result.issues.some(i => i.id === 'dimension-conflict'));
  }
});

test('collective nodules keep attributes unassigned and disclose limitation', () => {
  const result = analyzeReport('胸部CT：双肺多发实性结节，较大者8mm。');
  assert.equal(result.fields.find(f => f.id.endsWith('.dimensions')).status, '待确认');
  assert.match(result.coverage, /不能安全逐个归属/);
});

test('contradictory sole nodule in supported sections is flagged with exact evidence', () => {
  for (const [finding, conclusion] of [['检查所见', '检查结论'], ['影像所见', '影像诊断']]) {
    const text = `胸部CT\n${finding}：右肺上叶实性结节8×6mm。\n${conclusion}：右肺上叶实性结节1.2×0.9cm。`;
    const issue = analyzeReport(text).issues.find(i => i.id === 'dimension-conflict');
    assert.ok(issue);
    assert.equal(text.slice(issue.start, issue.end), issue.evidence);
  }
});

test('normalizes units and axis order without rounding away real conflicts', () => {
  assert.equal(conflict('胸部CT\n检查所见：右肺上叶结节8×6mm。\n检查结论：右肺上叶结节0.6×0.8cm。'), false);
  assert.equal(conflict('胸部CT\n检查所见：右肺上叶结节8毫米。\n检查结论：右肺上叶结节0.8厘米。'), false);
  assert.equal(conflict('胸部CT\n检查所见：右肺上叶结节8mm。\n检查结论：右肺上叶结节0.9cm。'), true);
});

test('never blindly compares different nodules, uncertain or ambiguous measurements', () => {
  for (const text of [
    '胸部CT：右肺上叶结节8mm。右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节8mm。\n检查结论：左肺下叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶多发结节8mm。\n检查结论：右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节8mm。左肺下叶结节6mm。\n检查结论：右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节未除外，8mm。\n检查结论：右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节8×6mm。\n检查结论：右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节6-8mm。\n检查结论：右肺上叶结节12mm。',
    '胸部CT\n检查所见：右肺上叶结节8mm。\n检查结论：右肺上叶结节前次12mm。',
    '胸部CT\n检查所见：结节8mm。\n检查结论：结节12mm。',
  ]) assert.equal(conflict(text), false, text);
});

test('no nodules and unitless measurements are not invented', () => {
  assert.equal(analyzeReport('胸部CT：肺纹理清晰。').issues.length, 0);
  const result = analyzeReport('胸部CT：右肺上叶结节8×6。');
  assert.equal(result.fields.find(f => f.id.endsWith('.dimensions')).status, '未提及');
});
