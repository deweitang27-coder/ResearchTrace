// Authoritative business rules: run validation, CSV parsing and claim pairing.
// The browser preview mirrors these rules; the server decides what is stored
// and what a claim verdict is.
export const metricNames = { accuracy: '准确率', macro_f1: '宏平均 F1', rmse: 'RMSE', latency_ms: '延迟（ms）' };
export const runRequired = ['dataset', 'method', 'seed', 'split', 'metric', 'value'];
export const runOptional = ['config', 'commit', 'note'];
export const runKey = run => JSON.stringify(runRequired.slice(0, -1).map(key => run[key]));

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? 'entry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export function runError(run) {
  if (!run || typeof run !== 'object') return '运行记录格式不正确。';
  if (runRequired.some(key => String(run[key] ?? '').trim() === '')) return '请补齐数据集、方法、种子、测试集、指标和值。';
  if (!Object.hasOwn(metricNames, run.metric)) return '指标须为 accuracy、macro_f1、rmse 或 latency_ms。';
  const value = Number(run.value);
  if (!Number.isFinite(value) || value < 0) return '指标值须为有限的非负数字。';
  if (['accuracy', 'macro_f1'].includes(run.metric) && value > 1) return '准确率和 F1 请用 0 至 1 的小数。';
  return '';
}
export function validRun(run) {
  return !runError(run) && typeof run.value === 'number';
}

export function parseCSV(raw) {
  const content = raw.replace(/^\uFEFF/, '');
  const rows = [];
  let line = 1, rowLine = 1;
  let row = [], cell = '', quoted = false, ended = false;
  function endCell() { row.push(cell.trim()); cell = ''; ended = false; }
  function endRow() {
    endCell();
    if (row.some(Boolean)) rows.push({ fields: row, line: rowLine });
    row = [];
    line += 1;
    rowLine = line;
  }
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') { quoted = false; ended = true; }
      else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && content[i + 1] === '\n') i += 1;
        cell += '\n'; line += 1;
      } else cell += ch;
    } else if (ch === ',') endCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i += 1;
      endRow();
    } else if (ch === '"' && !cell.trim() && !ended) { quoted = true; cell = ''; }
    else if (ch === '"' || (ended && !/\s/.test(ch))) throw new Error('CSV 第 ' + line + ' 行引号格式有误。');
    else if (!ended) cell += ch;
  }
  if (quoted) throw new Error('CSV 第 ' + rowLine + ' 行引号未闭合。');
  if (cell || row.length) endRow();
  return rows;
}

export function parseRuns(text, filename, existing) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV 需要表头和至少一行数据。');
  const header = rows.shift().fields.map(field => field.toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('CSV 表头存在重复列名。');
  const missing = runRequired.filter(field => !header.includes(field));
  if (missing.length) throw new Error('缺少列 ' + missing.join('、') + '。');
  const known = new Map(existing.map(run => [runKey(run), run]));
  const groups = new Map();
  for (const row of rows) {
    if (row.fields.length !== header.length) throw new Error('CSV 第 ' + row.line + ' 行列数与表头不一致。');
    const raw = Object.fromEntries(header.map((field, index) => [field, row.fields[index]]));
    const run = Object.fromEntries([...runRequired, ...runOptional].map(field => [field, raw[field] || '']));
    const failure = runError(run);
    if (failure) throw new Error('CSV 第 ' + row.line + ' 行。' + failure);
    const candidate = { ...run, value: Number(run.value), source: filename, row: row.line, target: '' };
    const key = runKey(candidate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  const pending = [], duplicates = [], conflicts = [];
  const sameRun = (a, b) => a.value === b.value && (a.config || '') === (b.config || '') && (a.commit || '') === (b.commit || '');
  for (const [key, group] of groups) {
    const stored = known.get(key);
    if (stored) {
      for (const run of group) (sameRun(run, stored) ? duplicates : conflicts).push({ run, reference: stored });
    } else if (group.every(run => sameRun(run, group[0]))) {
      pending.push({ ...group[0], id: newId() });
      for (const run of group.slice(1)) duplicates.push({ run, reference: group[0] });
    } else {
      const alternative = group.find(run => !sameRun(run, group[0]));
      for (const run of group) conflicts.push({ run, reference: sameRun(run, group[0]) ? alternative : group[0] });
    }
  }
  duplicates.sort((a, b) => a.run.row - b.run.row);
  conflicts.sort((a, b) => a.run.row - b.run.row);
  return { pending, duplicates, conflicts };
}

export function comparison(runs, options) {
  const eligible = runs.filter(run => run.dataset === options.dataset && run.metric === options.metric);
  const baseline = eligible.filter(run => run.method === options.base);
  const treatment = eligible.filter(run => run.method === options.test);
  const key = run => JSON.stringify([run.seed, run.split]);
  const control = new Map(baseline.map(run => [key(run), run]));
  const experiment = new Map(treatment.map(run => [key(run), run]));
  const pairs = options.base === options.test ? [] : baseline.flatMap(base => {
    const test = experiment.get(key(base));
    return test ? [{ base, test, delta: test.value - base.value }] : [];
  });
  pairs.sort((a, b) => a.base.seed.localeCompare(b.base.seed, undefined, { numeric: true }) || a.base.split.localeCompare(b.base.split));
  const baseOnly = baseline.filter(run => !experiment.has(key(run)));
  const testOnly = treatment.filter(run => !control.has(key(run)));
  const sameTest = baseline.some(base => treatment.some(test => base.split === test.split));
  return { pairs, baseOnly, testOnly, sameTest,
    mean: pairs.length ? pairs.reduce((sum, pair) => sum + pair.delta, 0) / pairs.length : null };
}

export function normalizeClaimRule(raw) {
  const statement = typeof raw?.statement === 'string' ? raw.statement.trim() : '';
  if (!statement || statement.length > 600) throw new Error('请填写一条 600 字符以内的论文结论。');
  if (!Array.isArray(raw.datasets) || raw.datasets.length === 0 || raw.datasets.length > 100 || raw.datasets.some(dataset => typeof dataset !== 'string' || !dataset.trim() || dataset.length > 200)) throw new Error('至少选择一个数据集。');
  if (typeof raw.base !== 'string' || typeof raw.test !== 'string' || !raw.base.trim() || !raw.test.trim() || raw.base.length > 200 || raw.test.length > 200 || raw.base === raw.test) throw new Error('请选择不同的基线和实验方法。');
  if (!Object.hasOwn(metricNames, raw.metric)) throw new Error('请选择指标。');
  if (!Number.isFinite(raw.threshold) || raw.threshold < 0) throw new Error('提升阈值须是非负数字。');
  if (!Number.isSafeInteger(raw.minPairs) || raw.minPairs < 1 || raw.minPairs > 10000) throw new Error('最低配对数须是正整数。');
  return { statement, datasets: [...new Set(raw.datasets)], base: raw.base, test: raw.test, metric: raw.metric, threshold: raw.threshold, minPairs: raw.minPairs };
}

export function claimAssessment(runs, rule) {
  const ratio = rule.metric === 'accuracy' || rule.metric === 'macro_f1';
  const lowerIsBetter = rule.metric === 'rmse' || rule.metric === 'latency_ms';
  const threshold = ratio ? rule.threshold / 100 : rule.threshold;
  return rule.datasets.map(dataset => {
    const result = comparison(runs, { dataset, metric: rule.metric, base: rule.base, test: rule.test });
    const improvement = result.mean === null ? null : (lowerIsBetter ? -result.mean : result.mean);
    const splitCount = new Set(result.pairs.map(pair => pair.base.split)).size;
    const missingCount = result.baseOnly.length + result.testOnly.length;
    let status = 'missing';
    let reason;
    if (!result.pairs.length) {
      if (!result.baseOnly.length || !result.testOnly.length) {
        reason = !result.baseOnly.length && !result.testOnly.length ? '基线和实验组都缺少该指标的运行。' : (!result.baseOnly.length ? '基线' : '实验组') + '缺少该指标的运行。';
      } else reason = result.sameTest ? '有同名测试集，但随机种子未能配对。' : '基线与实验组的测试集标识不一致。';
    } else if (splitCount > 1) reason = '已配对记录跨多个测试集，需先明确结论适用的测试集。';
    else if (missingCount) reason = '还有 ' + missingCount + ' 条运行未配对，先核对测试集标识和种子。';
    else if (result.pairs.length < rule.minPairs) reason = '已配对 ' + result.pairs.length + ' 组，低于要求的 ' + rule.minPairs + ' 组。';
    else {
      const tolerance = Number.EPSILON * 8 * Math.max(1, Math.abs(improvement), threshold);
      const difference = improvement - threshold;
      if (difference > tolerance) { status = 'supported'; reason = '配对平均改善量超过设定阈值。'; }
      else if (improvement < -tolerance) { status = 'counter'; reason = '实验组在这个数据集上的配对结果更差。'; }
      else { status = 'below'; reason = '配对平均改善量未超过设定阈值。'; }
    }
    return { dataset, result, improvement, status, reason };
  });
}

const projectLists = ['papers', 'hypotheses', 'tasks', 'datasets', 'runs', 'evidence', 'notes'];
export function validState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || typeof value.active !== 'string' ||
      !Array.isArray(value.projects) || !value.projects.length || value.projects.length > 100) return false;
  return value.projects.every(p => p && typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 100 &&
    typeof p.title === 'string' && p.title.length <= 300 &&
    projectLists.every(key => Array.isArray(p[key])) && p.drafts && typeof p.drafts === 'object' &&
    p.runs.every(validRun) &&
    p.evidence.every(e => e && Array.isArray(e.pairs) && e.pairs.every(pair => pair && validRun(pair.base) && validRun(pair.test))));
}