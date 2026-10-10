const LOCATION = /(?:右肺|左肺)(?:上叶|中叶|下叶)?(?:尖段|后段|前段|外侧段|内侧段|背段|基底段)?|(?:右|左)(?:上|中|下)肺(?:叶)?|双肺|两肺|肺内/g;
const DENSITY = /部分实性|混合(?:性)?磨玻璃(?:密度)?|磨玻璃(?:密度)?|非实性|实性|钙化(?:性)?/g;
const DIMENSION = /\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)?(?:\s*[×xX*]\s*\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)?){0,2}/g;
const UNIT = /mm|cm|毫米|厘米/i;
const HEADINGS = /检查所见|检查结论|影像所见|影像诊断/g;

function span(text, match, offset = 0) {
  return { evidence: match[0], start: offset + match.index, end: offset + match.index + match[0].length };
}

function dimensions(value) {
  const matches = [...value.matchAll(DIMENSION)].filter(match => UNIT.test(match[0]));
  return matches.filter(match => !/[\d.\-−]/.test(value[match.index - 1] || ''));
}

function normalized(value) {
  const parts = value.split(/\s*[×xX*]\s*/);
  const lastUnit = value.match(/(?:mm|cm|毫米|厘米)\s*$/i)?.[0].trim().toLowerCase();
  if (!lastUnit) return null;
  return parts.map(part => {
    const unit = (part.match(UNIT)?.[0] || lastUnit).toLowerCase();
    return Math.round(parseFloat(part) * (unit === 'cm' || unit === '厘米' ? 10 : 1) * 1000) / 1000;
  }).sort((a, b) => a - b);
}

/** Conservative text QC only, not diagnosis. Offsets are UTF-16, end-exclusive. */
export function analyzeReport(input) {
  const text = typeof input === 'string' ? input : '';
  const fields = [];
  const issues = [];
  const limitations = ['仅作胸部 CT 中文报告的有限正则质控，不作诊断；不推断病灶性质或随访要求', '证据偏移为原文 UTF-16 左闭右开区间；未识别不等于不存在'];
  const result = () => ({ fields, issues, coverage: limitations.join('；'), ruleVersion: 'prototype-1' });
  const emptyField = (id, label, status = '未提及') => ({ id, label, value: '', evidence: '', start: null, end: null, status });
  if (!text.trim()) {
    fields.push(emptyField('report', '报告文本'));
    limitations.push('报告为空，无法评估');
    return result();
  }
  const chest = /胸(?:部|腔)?\s*(?:CT|ＣＴ)|肺|胸部/i.test(text);
  if (!chest) {
    fields.push(emptyField('context', '胸部 CT 适用范围', '待确认'));
    limitations.push('未确认胸部/肺上下文；即使出现结节也不按肺结节提取或检查');
    return result();
  }
  if (!/(?:CT|ＣＴ)/i.test(text)) limitations.push('仅有肺/胸部文字上下文，CT 检查类型待确认');
  const headings = [...text.matchAll(HEADINGS)];
  const sectionAt = index => headings.filter(h => h.index < index).at(-1)?.[0] || '';
  const records = [];
  // Keep attribute-only comma clauses with their mention, but separate repeated mentions.
  for (const sentence of text.matchAll(/[^。；;\n\r]+/g)) {
    const clauses = [...sentence[0].matchAll(/[^，,]+[，,]?/g)];
    let group = null;
    const groups = [];
    for (const clause of clauses) {
      if (!group || (clause[0].includes('结节') && group.value.includes('结节'))) {
        group = { value: clause[0], offset: sentence.index + clause.index };
        groups.push(group);
      } else group.value += clause[0];
    }
    for (const { value, offset } of groups) {
      const mentions = [...value.matchAll(/结节/g)];
      if (!mentions.length) continue;
      const id = `nodule-${records.length + 1}`;
      const uncertain = /未(?:能)?除外|不能排除|不除外|可疑|疑似|可能|考虑|待排|\?|？/.test(value);
      const negative = !uncertain && /未见|未发现|未显示|无(?:明显)?|否认|不伴/.test(value.slice(0, mentions[0].index));
      const multiple = /多发|多个|数枚|数个|两枚|两处|双肺|两肺|[2-9二三四五六七八九十]\s*(?:枚|个|处)/.test(value) || mentions.length > 1;
      const state = uncertain ? '待确认' : '已提及';
      const evidence = { evidence: value, start: offset, end: offset + value.length };
      fields.push({ id: `${id}.presence`, label: `${id} 结节描述`, value: negative ? '否定描述' : uncertain ? '不确定描述' : multiple ? '多结节描述（未逐个归属）' : '结节描述', ...evidence, status: state });
      const record = { id, value, offset, negative, uncertain, multiple, section: sectionAt(offset + mentions[0].index), locations: [], sizes: [] };
      records.push(record);
      if (negative) continue;
      for (const [key, label, matches] of [
        ['location', '位置', [...value.matchAll(LOCATION)]],
        ['density', '密度', [...value.matchAll(DENSITY)]],
        ['dimensions', '尺寸', dimensions(value)],
      ]) {
        if (key === 'location') record.locations = matches.map(m => m[0]);
        if (key === 'dimensions') record.sizes = matches;
        if (!matches.length) {
          fields.push(emptyField(`${id}.${key}`, `${id} ${label}`, uncertain ? '待确认' : '未提及'));
          if (!uncertain) issues.push({ id: `${id}.missing-${key}`, title: `结节${label}未提及`, detail: `该结节描述未提取到明确${label}，请核对原文；不代表临床上不存在。`, ...evidence, severity: '提示' });
        } else {
          matches.forEach((match, index) => fields.push({ id: `${id}.${key}${index ? `-${index + 1}` : ''}`, label: `${id} ${label}`, value: match[0], ...span(text, match, offset), status: uncertain || multiple || matches.length > 1 ? '待确认' : '已提及' }));
        }
      }
      if (multiple) limitations.push(`${id} 包含多结节/多提及，属性仅为原文候选，不能安全逐个归属`);
    }
  }
  if (!records.length) {
    fields.push(emptyField('nodule', '结节描述'));
    limitations.push('未识别结节描述，不进行结节属性完整性检查');
  }
  limitations.push('结节编号为描述片段编号，不代表跨句或跨章节病灶身份；复杂并列、指代及否定范围需人工核对');
  const positives = records.filter(r => !r.negative);
  const pair = headings.length === 2 && (
    (headings[0][0] === '检查所见' && headings[1][0] === '检查结论') ||
    (headings[0][0] === '影像所见' && headings[1][0] === '影像诊断')
  );
  const [a, b] = positives;
  const eligible = pair && positives.length === 2 && a.section === headings[0][0] && b.section === headings[1][0]
    && records.length === 2 && !/多发|多枚|多个|另见|另有|其余|其他结节|既往|原为|此前|前次|上次|较前|增大|缩小|[~～至]|\d\s*[-—–]\s*\d/.test(text)
    && positives.every(r => !r.uncertain && !r.multiple && r.sizes.length === 1 && r.locations.length === 1)
    && a.locations[0] === b.locations[0] && !/^(?:肺内|双肺|两肺)$/.test(a.locations[0]);
  if (eligible) {
    const x = normalized(a.sizes[0][0]);
    const y = normalized(b.sizes[0][0]);
    if (x && y && x.length === y.length && x.some((n, i) => n !== y[i])) {
      const start = a.offset + a.sizes[0].index;
      const end = b.offset + b.sizes[0].index + b.sizes[0][0].length;
      issues.push({ id: 'dimension-conflict', title: '所见与结论尺寸不一致', detail: `单一结节同位置描述为 ${a.sizes[0][0]} 与 ${b.sizes[0][0]}；已统一 mm/cm 单位，请人工核对，不自动判断哪项正确。`, evidence: text.slice(start, end), start, end, severity: '待核对' });
    }
  }
  limitations.push('尺寸冲突仅检查标准所见/结论双章节、各一个明确结节、相同单一位置及相同维数；其他情况不比较，不跨病灶盲比');
  return result();
}
