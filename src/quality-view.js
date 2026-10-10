/** Display order only; do not change clinical rules, issue IDs, or evidence. */
export function prioritizeIssues(issues = [], decisions = {}) {
  return [...issues].sort((a, b) =>
    Number(Boolean(decisions[a.id])) - Number(Boolean(decisions[b.id]))
    || Number(b.id === 'dimension-conflict') - Number(a.id === 'dimension-conflict'));
}

/** Describe the original text section, not the identity of a lesion. */
export function issueSource(issue, text) {
  if (typeof text !== 'string' || !Number.isInteger(issue.start) || !Number.isInteger(issue.end)
    || issue.start < 0 || issue.end <= issue.start || issue.end > text.length
    || text.slice(issue.start, issue.end) !== issue.evidence) return '原文片段';
  const headings = [...text.matchAll(/检查所见|检查结论|影像所见|影像诊断/g)];
  const before = headings.filter(heading => heading.index <= issue.start).at(-1);
  const within = headings.filter(heading => heading.index > issue.start && heading.index < issue.end);
  const sections = [...new Set([before, ...within].filter(Boolean).map(heading => heading[0]))];
  return sections.join(' ↔ ') || '原文片段';
}
