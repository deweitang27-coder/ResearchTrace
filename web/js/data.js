'use strict';

const storageKey = 'research-bench-v1';
const pages = [
  ['home', '课题总览', '⌂'], ['papers', '文献库', '▤'], ['hypotheses', '研究设计', '◇'],
  ['runs', '实验与数据', '⌗'], ['evidence', '对照与证据', '↔'], ['claims', '结论核对', '✓'], ['trace', '证据链', '⛓'], ['drafts', '论文写作', '¶'], ['notes', '科研日志', '≡']
];
const metricNames = { accuracy: '准确率', macro_f1: '宏平均 F1', rmse: 'RMSE', latency_ms: '延迟（ms）' };
const paperStatuses = ['待读', '阅读中', '已整理'];
const hypothesisStatuses = ['拟验证', '实验中', '待复核', '已复核'];
const taskStatuses = ['待完成', '已完成'];
const draftSections = ['引言', '相关工作', '方法', '实验结果', '讨论'];
const blankDrafts = () => Object.fromEntries(draftSections.map(name => [name, '']));

function id() {
  return globalThis.crypto?.randomUUID?.() ?? 'entry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}
function freshProject(title = '', question = '', goal = '') {
  return { id: id(), title, question, goal, demo: false, papers: [], hypotheses: [], tasks: [], datasets: [], runs: [],
    evidence: [], claimRule:null, notes: [], drafts: blankDrafts() };
}
function sampleProject() {
  const p = freshProject('UCR 时间序列分类', '选择性路由能否在相同测试条件下，用有限推理预算提升分类准确率？',
    '固定官方测试集，对照 MiniRocket 基线与不同升级预算下的路由结果。');
  p.demo = true;
  p.papers = [
    {id: 'paper-mini', key: 'dempster2020minirocket', title: 'MINIROCKET: A Very Fast (Almost) Deterministic Transform for Time Series Classification', authors: 'Angus Dempster and Daniel F. Schmidt and Geoffrey I. Webb', year: '2020', doi: '10.48550/arXiv.2012.08791', status: '已整理', method: 'MiniRocket 特征变换与线性分类器。', note: '用于建立快速基线。阅读笔记需标清论文评估条件与自己的划分。', target: 'h1'},
    {id: 'paper-rocket', key: 'dempster2019rocket', title: 'ROCKET: Exceptionally fast and accurate time series classification using random convolutional kernels', authors: 'Angus Dempster and François Petitjean and Geoffrey I. Webb', year: '2019', doi: '10.48550/arXiv.1910.13051', status: '阅读中', method: '随机卷积核变换。', note: '可作为升级分支的对照来源。', target: 'h2'},
    {id: 'paper-ucr', key: 'dau2018ucr', title: 'The UCR Time Series Archive', authors: 'Hoang Anh Dau and Anthony Bagnall and Kaveh Kamgar and Chin-Chia Michael Yeh and Yan Zhu and Shaghayegh Gharghabi and Chotirat Ann Ratanamahatana and Eamonn Keogh', year: '2018', doi: '10.48550/arXiv.1810.07758', status: '已整理', method: '时间序列分类档案与基准。', note: '记录每个数据集具体使用的划分和版本。', target: 'h1'}
  ];
  p.hypotheses = [
    {id: 'h1', title: '有限预算下的升级收益', claim: '与 MiniRocket 相比，25% 升级预算的选择性路由可能提升准确率。', metric: 'accuracy',
      controls: '同一数据集、测试样本和指标口径。按相同种子配对。', criterion: '逐数据集报告配对平均差和单次运行结果，并记录升级预算。', status: '实验中'},
    {id: 'h2', title: '跨数据集稳定性', claim: '升级收益可能随数据集而变。', metric: 'accuracy',
      controls: '固定路由规则和各组比较条件，分别汇报结果。', criterion: '保留所有数据集的结果和不确定性。', status: '拟验证'}
  ];
  p.tasks = [
    {id: 'task-splits', title: '核对官方测试集标识', target: 'h1', date: '', status: '待完成'},
    {id: 'task-table', title: '补齐各预算组的种子结果', target: 'h1', date: '', status: '待完成'},
    {id: 'task-base', title: '登记基线文献和参数', target: 'h1', date: '', status: '已完成'}
  ];
  p.datasets = [
    {id: 'data-gun', title: 'GunPoint', split: 'GunPoint_TEST_v1', source: 'https://zenodo.org/records/11198697', note: '示例使用统一的测试集标识。正式实验可用测试样本清单的哈希登记划分。'},
    {id: 'data-ford', title: 'FordA', split: 'FordA_TEST_v1', source: 'https://zenodo.org/records/11198697', note: '用于记录跨数据集比较。'}
  ];
  for (const [dataset, split, method, values, config] of [
    ['GunPoint','GunPoint_TEST_v1','MiniRocket',[140/150,138/150,140/150],'baseline.yaml'],
    ['GunPoint','GunPoint_TEST_v1','Router-25',[142/150,142/150,140/150],'router25.yaml'],
    ['GunPoint','GunPoint_TEST_v1','Router-50',[141/150,139/150,139/150],'router50.yaml'],
    ['GunPoint','resplit-v2','Router-25 重划分',[.95,.94,.945],'exploratory.yaml'],
    ['FordA','FordA_TEST_v1','MiniRocket',[.91,.905,.908],'baseline.yaml'],
    ['FordA','FordA_TEST_v1','Router-25',[.906,.904,.909],'router25.yaml']
  ]) {
    values.forEach((value, seed) => p.runs.push({id:'run-' + p.runs.length, dataset, split, method, seed: String(seed), metric:'accuracy', value, config,
      commit:'', source:'demo-results.csv', row:p.runs.length + 2, target:'h1', note:'内置演示数据'}));
  }
  p.notes = [
    {id: 'note-1', title: '明确比较口径', date: '2026-11-18', kind: '实验记录', target: 'h1', text: '不同随机种子的运行共用一个测试集。报告按种子配对的差值，并把结果用于描述运行波动。'},
    {id: 'note-2', title: '记录重划分来源', date: '2026-11-18', kind: '问题记录', target: 'h1', text: '重划分的探索性运行先单独保留。后续核对完整样本标识，再决定能否与已有基线对照。'}
  ];
  p.drafts['方法'] = '基线使用 MiniRocket [@dempster2020minirocket]。数据来自 UCR 档案 [@dau2018ucr]。\n\n补录各数据集版本、划分及路由配置。';
  p.drafts['实验结果'] = '先检验测试集与配对种子，再报告各预算组的差值。';
  const options = {dataset:'GunPoint',metric:'accuracy',base:'MiniRocket',test:'Router-25'};
  const result = comparison(p.runs,options);
  p.evidence = [{id:'demo-evidence-1', title:'GunPoint · 25% 路由预算', target:'h1', options, pairs:structuredClone(result.pairs), mean:result.mean,
    note:'同一测试集内按种子配对，差值只描述这几次运行。正式报告请替换为自己的实验记录。', demo:true}];
  return p;
}
class RequestError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}
async function requestBackend(path, init = {}) {
  let response;
  try { response = await fetch('/functions/v1/app' + path, { credentials: 'same-origin', signal: AbortSignal.timeout(20000), ...init }); }
  catch { throw new RequestError('network_error'); }
  let body;
  try { body = await response.json(); } catch { throw new RequestError('invalid_response', response.status); }
  if (!response.ok) {
    const failure = new RequestError(typeof body?.error === 'string' ? body.error : 'request_failed', response.status);
    failure.detail = typeof body?.detail === 'string' ? body.detail : '';
    throw failure;
  }
  return body;
}
function validState(value) {
  return value?.version === 1 && typeof value.active === 'string' && Array.isArray(value.projects) && value.projects.length > 0 &&
    value.projects.every(p => p && typeof p.id === 'string' && typeof p.title === 'string' && Array.isArray(p.runs));
}
const projectStore = {
  async load() {
    const body = await requestBackend('/api/state');
    if (!body || typeof body !== 'object' || !Number.isInteger(body.version) || (body.state !== null && !validState(body.state))) throw new RequestError('invalid_response');
    return body;
  },
  async save(snapshot, version) {
    const body = await requestBackend('/api/state', { method: 'PUT', headers: {'content-type': 'application/json'}, body: '{"version":' + version + ',"state":' + snapshot + '}' });
    if (!body || !Number.isInteger(body.version)) throw new RequestError('invalid_response');
    return body.version;
  }
};
function localMigrationState() {
  try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (validState(saved)) return saved; } catch {}
  return null;
}
const DEMO_SAMPLE_VERSION = 2;
const demoStorageKey = 'research-bench-demo-v1';
const demoSampleVersionKey = 'research-bench-demo-sample-v1';
const demoStore = {
  load() {
    try {
      if (localStorage.getItem(demoSampleVersionKey) !== String(DEMO_SAMPLE_VERSION)) {
        localStorage.removeItem(demoStorageKey);
        localStorage.removeItem(demoSampleVersionKey);
        return null;
      }
      const saved = JSON.parse(localStorage.getItem(demoStorageKey));
      if (validState(saved)) return saved;
    } catch {}
    return null;
  },
  save(snapshot) {
    try {
      localStorage.setItem(demoStorageKey, snapshot);
      localStorage.setItem(demoSampleVersionKey, String(DEMO_SAMPLE_VERSION));
      return true;
    } catch { return false; }
  }
};
const CSV_FILE_LIMIT = 2 * 1024 * 1024;
const BACKUP_FILE_LIMIT = 3 * 1024 * 1024;
const jsonPost = payload => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
function compactRun(run) {
  return { id: run.id, dataset: run.dataset, method: run.method, seed: run.seed, split: run.split, metric: run.metric,
    value: run.value, config: run.config || '', commit: run.commit || '', note: run.note || '', source: run.source || '', row: run.row ?? null };
}
async function importCsvRemote(projectId, csv, filename, version) {
  const body = await requestBackend('/api/import', jsonPost({ projectId, csv, filename, version }));
  if (!body || !Number.isInteger(body.version) || !Array.isArray(body.runs) || !Number.isInteger(body.added)) throw new RequestError('invalid_response');
  return body;
}
async function verifyClaimRemote(projectId, rule) {
  const body = await requestBackend('/api/verify', jsonPost({ projectId, rule }));
  if (!body || !Array.isArray(body.rows) || !body.rule) throw new RequestError('invalid_response');
  return body;
}
async function demoImportRemote(csv, filename, existing) {
  const body = await requestBackend('/api/demo/import', jsonPost({ csv, filename, existing: existing.map(compactRun) }));
  if (!body || !Array.isArray(body.runs) || !Number.isInteger(body.added)) throw new RequestError('invalid_response');
  return body;
}
async function demoVerifyRemote(runs, rule) {
  const body = await requestBackend('/api/demo/verify', jsonPost({ runs: runs.map(compactRun), rule }));
  if (!body || !Array.isArray(body.rows) || !body.rule) throw new RequestError('invalid_response');
  return body;
}
function defaultState() {
  const demo = sampleProject();
  return { version: 1, active: demo.id, projects: [demo] };
}
function syncErrorText(error) {
  const code = error instanceof RequestError ? error.code : '';
  return ({
    login_required: '请先登录站点，再访问云端课题。',
    write_conflict: '云端数据已在其他页面更新。请先备份课题，再重新加载。',
    invalid_input: '课题数据未通过服务端校验，请检查最近编辑的内容。',
    payload_too_large: '课题数据超过 4 MB，请拆分课题或清理运行记录。',
    database_not_configured: '数据服务尚未配置完成，请稍后再试。',
    database_credential_rejected: '数据服务暂不可用，请联系站点管理员。',
    network_error: '网络连接中断，尚无法确认本次保存的结果。',
    invalid_response: '服务返回了无法识别的结果，请重试。',
    invalid_csv: 'CSV 未通过服务端校验，未写入任何记录。',
    invalid_rule: '核对规则未通过服务端校验。',
    import_too_large: '导入后课题数据超过云端上限，请分批导入或清理运行记录。',
    no_workspace: '云端还没有保存的课题，请先保存一次。',
    save_failed: '保存未成功，未执行该操作。请先重试保存。',
    service_unavailable: '服务暂时不可用，请稍后重试。'
  })[code] || '暂时无法完成操作，请稍后重试。';
}
function parseCSV(raw) {
  const content = raw.replace(/^\uFEFF/,'');
  const rows = [];
  let line = 1, rowLine = 1;
  let row = [], cell = '', quoted = false, ended = false;
  function endCell() { row.push(cell.trim()); cell = ''; ended = false; }
  function endRow() {
    endCell();
    if (row.some(Boolean)) rows.push({fields: row, line: rowLine});
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
const runRequired = ['dataset','method','seed','split','metric','value'];
const runOptional = ['config','commit','note'];
const runKey = run => JSON.stringify(runRequired.slice(0, -1).map(key => run[key]));
function runError(run) {
  if (runRequired.some(key => String(run[key] ?? '').trim() === '')) return '请补齐数据集、方法、种子、测试集、指标和值。';
  if (!Object.hasOwn(metricNames, run.metric)) return '指标须为 accuracy、macro_f1、rmse 或 latency_ms。';
  const value = Number(run.value);
  if (!Number.isFinite(value) || value < 0) return '指标值须为有限的非负数字。';
  if (['accuracy','macro_f1'].includes(run.metric) && value > 1) return '准确率和 F1 请用 0 至 1 的小数。';
  return '';
}
function parseRuns(text, filename, existing) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('CSV 需要表头和至少一行数据。');
  const header = rows.shift().fields.map(field => field.toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('CSV 表头存在重复列名。');
  const missing = runRequired.filter(field => !header.includes(field));
  if (missing.length) throw new Error('缺少列 ' + missing.join('、') + '。');
  const known = new Map(existing.map(run => [runKey(run),run]));
  const groups = new Map();
  for (const row of rows) {
    if (row.fields.length !== header.length) throw new Error('CSV 第 ' + row.line + ' 行列数与表头不一致。');
    const raw = Object.fromEntries(header.map((field,index) => [field, row.fields[index]]));
    const run = Object.fromEntries([...runRequired, ...runOptional].map(field => [field, raw[field] || '']));
    const failure = runError(run);
    if (failure) throw new Error('CSV 第 ' + row.line + ' 行。' + failure);
    const candidate = {...run,value:Number(run.value),source:filename,row:row.line,target:''};
    const key = runKey(candidate);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(candidate);
  }
  const pending = [], duplicates = [], conflicts = [];
  const sameRun = (a,b) => a.value === b.value && (a.config || '') === (b.config || '') && (a.commit || '') === (b.commit || '');
  for (const [key,group] of groups) {
    const stored = known.get(key);
    if (stored) {
      for (const run of group) (sameRun(run,stored) ? duplicates : conflicts).push({run,reference:stored});
    } else if (group.every(run => sameRun(run,group[0]))) {
      pending.push({...group[0],id:id()});
      for (const run of group.slice(1)) duplicates.push({run,reference:group[0]});
    } else {
      const alternative = group.find(run => !sameRun(run,group[0]));
      for (const run of group) conflicts.push({run,reference:sameRun(run,group[0]) ? alternative : group[0]});
    }
  }
  duplicates.sort((a,b) => a.run.row-b.run.row);
  conflicts.sort((a,b) => a.run.row-b.run.row);
  return {pending,duplicates,conflicts};
}
function comparison(runs, options) {
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
  pairs.sort((a,b) => a.base.seed.localeCompare(b.base.seed, undefined, {numeric: true}) || a.base.split.localeCompare(b.base.split));
  const baseOnly = baseline.filter(run => !experiment.has(key(run)));
  const testOnly = treatment.filter(run => !control.has(key(run)));
  const sameTest = baseline.some(base => treatment.some(test => base.split === test.split));
  return { pairs, baseOnly, testOnly, sameTest,
    mean: pairs.length ? pairs.reduce((sum,pair) => sum + pair.delta,0) / pairs.length : null };
}
function formatValue(value, metric, delta = false) {
  const ratio = ['accuracy','macro_f1'].includes(metric);
  const display = ratio ? value * 100 : value;
  let number = (Math.abs(display) < .0000001 ? 0 : display).toFixed(ratio || metric === 'latency_ms' ? 2 : 4);
  if (delta && Number(number) > 0) number = '+' + number;
  return number + (ratio ? (delta ? ' pp' : '%') : (metric === 'latency_ms' ? ' ms' : ''));
}
const claimStates = {supported:'支持',counter:'反例',below:'未达阈值',missing:'待补证据'};

const tTable95 = [0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.197,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042];
function tCritical95(df) {
  if (df < 1) return null;
  if (df <= 30) return tTable95[df];
  return 1.96 + 2.5 / df;
}
function lgamma(x) {
  const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i += 1) a += c[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function logChoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}
function signTestP(positives, n) {
  if (!n) return null;
  const m = Math.min(positives, n - positives);
  if (n <= 1000) {
    let sum = 0;
    for (let i = 0; i <= m; i += 1) sum += Math.exp(logChoose(n, i) - n * Math.LN2);
    return Math.min(1, 2 * sum);
  }
  const z = (Math.abs(positives - n / 2) - 0.5) / Math.sqrt(n / 4);
  return Math.min(1, 2 * (1 - normalCdf(z)));
}
function pairStats(pairs, metric) {
  const n = pairs.length;
  if (!n) return null;
  const lower = ['rmse','latency_ms'].includes(metric);
  const ratio = ['accuracy','macro_f1'].includes(metric);
  const values = pairs.map(pair => (lower ? -pair.delta : pair.delta) * (ratio ? 100 : 1));
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let sd = null, se = null, ci = null, tCrit = null;
  if (n >= 2) {
    sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    se = sd / Math.sqrt(n);
    tCrit = tCritical95(n - 1);
    ci = [mean - tCrit * se, mean + tCrit * se];
  }
  const positives = values.filter(v => v > 1e-9).length;
  const negatives = values.filter(v => v < -1e-9).length;
  return { n, mean, sd, se, ci, tCrit, positives, negatives, zeros: n - positives - negatives, signP: signTestP(positives, positives + negatives), lower, ratio };
}
function statsText(stats, metric) {
  if (!stats) return '';
  const unit = stats.ratio ? 'pp' : metric === 'latency_ms' ? 'ms' : '';
  const fmt = (v, d = 2) => (v == null ? '—' : v.toFixed(stats.ratio || metric === 'latency_ms' ? d : 4) + (unit ? ' ' + unit : ''));
  const ci = stats.ci ? fmt(stats.ci[0]) + ' ~ ' + fmt(stats.ci[1]) : '样本不足（n<2）';
  const p = stats.signP == null ? '—' : stats.signP < 0.001 ? '<0.001' : stats.signP.toFixed(3);
  return { n: stats.n, mean: fmt(stats.mean), ci, sd: fmt(stats.sd), p, positives: stats.positives, negatives: stats.negatives, zeros: stats.zeros };
}

function normalizeClaimRule(raw) {
  const statement = typeof raw?.statement === 'string' ? raw.statement.trim() : '';
  if (!statement || statement.length > 600) throw new Error('请填写一条 600 字符以内的论文结论。');
  if (!Array.isArray(raw.datasets) || raw.datasets.length === 0 || raw.datasets.some(dataset => typeof dataset !== 'string' || !dataset.trim())) throw new Error('至少选择一个数据集。');
  if (typeof raw.base !== 'string' || typeof raw.test !== 'string' || !raw.base.trim() || !raw.test.trim() || raw.base === raw.test) throw new Error('请选择不同的基线和实验方法。');
  if (!Object.hasOwn(metricNames,raw.metric)) throw new Error('请选择指标。');
  if (!Number.isFinite(raw.threshold) || raw.threshold < 0) throw new Error('提升阈值须是非负数字。');
  if (!Number.isSafeInteger(raw.minPairs) || raw.minPairs < 1) throw new Error('最低配对数须是正整数。');
  return {statement,datasets:[...new Set(raw.datasets)],base:raw.base,test:raw.test,metric:raw.metric,threshold:raw.threshold,minPairs:raw.minPairs};
}

function claimThresholdUnit(metric) {
  if (metric === 'accuracy' || metric === 'macro_f1') return '百分点';
  return metric === 'latency_ms' ? 'ms' : 'RMSE 原单位';
}

function claimAssessment(runs,rule) {
  const ratio = rule.metric === 'accuracy' || rule.metric === 'macro_f1';
  const lowerIsBetter = rule.metric === 'rmse' || rule.metric === 'latency_ms';
  const threshold = ratio ? rule.threshold / 100 : rule.threshold;
  return rule.datasets.map(dataset => {
    const result = comparison(runs,{dataset,metric:rule.metric,base:rule.base,test:rule.test});
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
      const tolerance = Number.EPSILON * 8 * Math.max(1,Math.abs(improvement),threshold);
      const difference = improvement-threshold;
      if (difference > tolerance) { status = 'supported'; reason = '配对平均改善量超过设定阈值。'; }
      else if (improvement < -tolerance) { status = 'counter'; reason = '实验组在这个数据集上的配对结果更差。'; }
      else { status = 'below'; reason = '配对平均改善量未超过设定阈值。'; }
    }
    return {dataset,result,improvement,status,reason};
  });
}

const claimDemoCsv = ['dataset,method,seed,split,metric,value,config,note',
  ...[
    ['GunPoint','GunPoint_OFFICIAL','MiniRocket',[.92,.925,.93]],
    ['GunPoint','GunPoint_OFFICIAL','Router-50',[.94,.945,.95]],
    ['FordA','FordA_OFFICIAL','MiniRocket',[.91,.905,.908]],
    ['FordA','FordA_OFFICIAL','Router-50',[.90,.897,.903]],
    ['ItalyPowerDemand','Italy_OFFICIAL','MiniRocket',[.95,.952,.954]],
    ['ItalyPowerDemand','Italy_ALTERNATE','Router-50',[.961,.963,.965]]
  ].flatMap(([dataset,split,method,values]) => values.map((value,seed) =>
    [dataset,method,seed,split,'accuracy',value,method === 'MiniRocket' ? 'baseline.yaml' : 'router50.yaml','内置演示数据'].join(',')))
].join('\n') + '\n';
const claimDemoRule = {statement:'升级预算为 50% 时，选择性路由在 GunPoint、ItalyPowerDemand 和 FordA 上均提高了准确率。',
  datasets:['GunPoint','FordA','ItalyPowerDemand'],base:'MiniRocket',test:'Router-50',metric:'accuracy',threshold:0,minPairs:3};
function safeURL(link) {
  try { const url = new URL(link); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function validDOI(value) { return /^10\.\d{4,9}\/\S+$/i.test(value); }
function bibtex(papers) {
  const literal = value => String(value ?? '').replace(/[{}\\]/g, '').replace(/[\r\n]+/g,' ').trim();
  return papers.map(p => '@misc{' + p.key + ',\n  title = {' + literal(p.title) + '},\n  author = {' + literal(p.authors) + '},\n  year = {' + literal(p.year) + '}' + (p.doi ? ',\n  doi = {' + literal(p.doi) + '}' : '') + '\n}').join('\n\n') + '\n';
}
function markdownCell(value) {
  return String(value ?? '').replace(/[\r\n]+/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_\[\]|]/g,'\\$&');
}
function markdownEvidence(e) {
  return ['### ' + markdownCell(e.title), '',
    markdownCell(e.options.dataset) + ' · ' + (metricNames[e.options.metric] || e.options.metric) + ' · ' + markdownCell(e.options.base) + ' → ' + markdownCell(e.options.test),
    '', '| 随机种子 | 测试集 | 基线 | 实验组 | 差值 |', '| --- | --- | ---: | ---: | ---: |',
    ...e.pairs.map(({base,test,delta}) => '| ' + markdownCell(base.seed) + ' | ' + markdownCell(base.split) + ' | ' + formatValue(base.value,e.options.metric) + ' | ' + formatValue(test.value,e.options.metric) + ' | ' + formatValue(delta,e.options.metric,true) + ' |'),
    '', '配对平均差 ' + formatValue(e.mean,e.options.metric,true) + '。', e.note ? '\n备注：' + markdownCell(e.note) : '',
    e.demo ? '\n_本表为演示数据。_' : ''].join('\n').trim();
}
function reproductionRecord(p,evidence,unpaired) {
  const isCurrent = Boolean(unpaired);
  const hypothesis = p.hypotheses.find(item => item.id === evidence.target);
  const condition = isCurrent ? '另有基线 ' + unpaired.baseOnly.length + ' 条、实验组 ' + unpaired.testOnly.length + ' 条未配对。' : '';
  const report = [
    '# 实验复现记录','',
    '- 课题：' + markdownCell(p.title),
    '- 数据来源：' + (isCurrent ? '当前对照结果' : '已存证据中的运行快照'),
    '- 已配对运行：' + evidence.pairs.length + ' 组',
    ...(hypothesis ? ['- 关联假设：' + markdownCell(hypothesis.title)] : []),'',
    '## 配对结果','',markdownEvidence(evidence),'',
    '按同一数据集、指标、测试集标识及随机种子配对。共用测试集时，多种子结果仅用于描述运行波动。' + condition,'',
    '## 原始运行来源','',
    '| 种子 | 测试集 | 组别 | 方法 | 来源 | 行号 | 配置 | Git 提交 |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- |'
  ];
  for (const {base,test} of evidence.pairs) {
    for (const [group,run] of [['基线',base],['实验组',test]]) {
      const cells = [run.seed,run.split,group,run.method,run.source || '未记录',run.row ?? '—',run.config || '未记录',run.commit || '未记录'];
      report.push('| ' + cells.map(markdownCell).join(' | ') + ' |');
    }
  }
  return report.join('\n') + '\n';
}
function dateNow() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function improvementDisplay(value, metric) {
  const lower = ['rmse','latency_ms'].includes(metric);
  const ratio = ['accuracy','macro_f1'].includes(metric);
  return (lower ? -value : value) * (ratio ? 100 : 1);
}
function rawImprovement(value, metric) {
  return ['rmse','latency_ms'].includes(metric) ? -value : value;
}
function claimBasisText(report) {
  if (report.basis === 'saved') return '云端已保存的运行记录' + (Number.isInteger(report.version) ? '（版本 ' + report.version + '）' : '');
  return '演示运行记录';
}
function claimReportMarkdown(report) {
  const { rows, rule } = report;
  const supported = rows.filter(row => row.status === 'supported').length;
  const out = ['# 结论核对报告', '',
    '- 结论：' + markdownCell(rule.statement),
    '- 规则：' + markdownCell(rule.base + ' → ' + rule.test) + ' · ' + metricNames[rule.metric] + ' · 改善量 > ' + rule.threshold + ' ' + claimThresholdUnit(rule.metric) + ' · 最低配对 ' + rule.minPairs + ' 组',
    '- 判定依据：' + claimBasisText(report) + '（服务端确定性配对规则）',
    '- 核对时间：' + (report.verifiedAt ? new Date(report.verifiedAt).toLocaleString('zh-CN', {hour12: false}) : '—'),
    '- 总体：' + supported + ' / ' + rows.length + ' 个数据集达到规则', '',
    '> 统计量为基于已配对运行的描述性推断（t 分布 95% 置信区间与双侧符号检验），不改变服务端判定。', ''];
  for (const row of rows) {
    const metric = rule.metric;
    const stats = pairStats(row.result.pairs, metric);
    const st = statsText(stats, metric);
    out.push('## ' + markdownCell(row.dataset) + ' · ' + claimStates[row.status], '',
      '- 原因：' + markdownCell(row.reason),
      '- 配对：' + row.result.pairs.length + ' 组' + (row.improvement == null ? '' : ' · 平均改善 ' + formatValue(row.improvement, metric, true)),
      ...(stats ? ['- 均值 ' + st.mean + ' · 95% CI ' + st.ci + ' · 标准差 ' + st.sd + ' · 符号检验 p ' + st.p + '（改善 ' + st.positives + ' / 变差 ' + st.negatives + ' / 持平 ' + st.zeros + '）'] : []), '');
    if (row.result.pairs.length) {
      out.push('| 种子 | 测试集 | 基线 | 实验组 | 差值 | 改善量 |', '| --- | --- | ---: | ---: | ---: | ---: |',
        ...row.result.pairs.map(({base, test, delta}) => '| ' + [base.seed, base.split, formatValue(base.value, metric), formatValue(test.value, metric), formatValue(delta, metric, true), formatValue(rawImprovement(delta, metric), metric, true)].map(markdownCell).join(' | ') + ' |'), '',
        '| 种子 | 测试集 | 组别 | 方法 | 来源 | 行号 | 配置 | Git 提交 |', '| --- | --- | --- | --- | --- | ---: | --- | --- |');
      for (const {base, test} of row.result.pairs) for (const [group, run] of [['基线', base], ['实验组', test]])
        out.push('| ' + [run.seed, run.split, group, run.method, run.source || '未记录', run.row ?? '—', run.config || '未记录', run.commit || '未记录'].map(markdownCell).join(' | ') + ' |');
      out.push('');
    }
    const unpaired = [...row.result.baseOnly, ...row.result.testOnly];
    if (unpaired.length) out.push('未配对运行 ' + unpaired.length + ' 条：' + unpaired.slice(0, 30).map(run => markdownCell(run.method + ' · seed ' + run.seed + ' · ' + run.split + '（' + (run.source || '未记录') + (run.row ? ':' + run.row : '') + '）')).join('；') + (unpaired.length > 30 ? ' …' : ''), '');
  }
  return out.join('\n').trim() + '\n';
}
function claimReportCSV(report) {
  const { rows, rule } = report;
  const metric = rule.metric;
  const header = ['dataset','metric','status','seed','split','base_method','test_method','base_value','test_value','delta','improvement','threshold','base_config','base_commit','base_source','base_row','test_config','test_commit','test_source','test_row'];
  const lines = [header.join(',')];
  const round6 = v => Math.round(v * 1e6) / 1e6;
  for (const row of rows) for (const {base, test, delta} of row.result.pairs) {
    lines.push([row.dataset, metric, row.status, base.seed, base.split, base.method, test.method, base.value, test.value, round6(delta), round6(improvementDisplay(delta, metric)), rule.threshold, base.config || '', base.commit || '', base.source || '', base.row ?? '', test.config || '', test.commit || '', test.source || '', test.row ?? ''].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
function traceModel(p, anchor) {
  if (anchor === 'claim') {
    const rule = p.claimRule;
    if (!rule) return null;
    const assessment = claimAssessment(p.runs, rule);
    return { kind: 'claim', title: '结论核对规则', statement: rule.statement,
      meta: [rule.base + ' → ' + rule.test, metricNames[rule.metric], '改善量 > ' + rule.threshold + ' ' + claimThresholdUnit(rule.metric), '最低配对 ' + rule.minPairs + ' 组'],
      evidence: assessment.map(row => ({ title: row.dataset, subtitle: claimStates[row.status] + ' · ' + row.result.pairs.length + ' 组配对', status: row.status, mean: row.improvement, metric: rule.metric, pairs: row.result.pairs, reason: row.reason })),
      runs: [], materials: { papers: [], notes: [], tasks: [] },
      hint: '结论核对规则按数据集自动配对运行。如需把文献与日志纳入链路，请改用研究假设作为锚点。' };
  }
  if (anchor.startsWith('h:')) {
    const h = p.hypotheses.find(item => item.id === anchor.slice(2));
    if (!h) return null;
    return { kind: 'hypothesis', title: h.title, statement: h.claim,
      meta: [metricNames[h.metric], '进度 · ' + h.status, h.controls, h.criterion].filter(Boolean),
      evidence: p.evidence.filter(e => e.target === h.id).map(e => ({ title: e.title, subtitle: e.options.dataset + ' · ' + e.options.base + ' → ' + e.options.test, metric: e.options.metric, mean: e.mean, pairs: e.pairs, note: e.note, demo: e.demo })),
      runs: p.runs.filter(run => run.target === h.id),
      materials: { papers: p.papers.filter(item => item.target === h.id), notes: p.notes.filter(item => item.target === h.id), tasks: p.tasks.filter(item => item.target === h.id) }, hint: '' };
  }
  if (anchor.startsWith('e:')) {
    const e = p.evidence.find(item => item.id === anchor.slice(2));
    if (!e) return null;
    const h = p.hypotheses.find(item => item.id === e.target);
    const target = p.hypotheses.some(item => item.id === e.target) ? e.target : '';
    return { kind: 'evidence', title: e.title, statement: h ? h.claim : (e.note || '已存证据快照'),
      meta: [e.options.dataset, e.options.base + ' → ' + e.options.test, metricNames[e.options.metric], '配对平均差 ' + formatValue(e.mean, e.options.metric, true)],
      evidence: [{ title: e.title, subtitle: e.options.dataset + ' · ' + e.options.base + ' → ' + e.options.test, metric: e.options.metric, mean: e.mean, pairs: e.pairs, note: e.note, demo: e.demo }],
      runs: [], materials: target ? { papers: p.papers.filter(item => item.target === target), notes: p.notes.filter(item => item.target === target), tasks: p.tasks.filter(item => item.target === target) } : { papers: [], notes: [], tasks: [] },
      hint: target ? '' : '该证据未关联假设，文献与日志材料为空。可在证据编辑中设置「关联假设」。' };
  }
  return null;
}
function traceMarkdown(p, anchor) {
  const model = traceModel(p, anchor);
  if (!model) return '';
  const out = ['# 证据链 · ' + markdownCell(model.title), '', '- 课题：' + markdownCell(p.title), '', '## 结论', '', markdownCell(model.statement), '',
    ...(model.meta.length ? model.meta.map(m => '- ' + markdownCell(m)) : []), ''];
  out.push('## 证据与配对运行', '');
  if (!model.evidence.length) out.push('_暂无关联证据。_', '');
  for (const ev of model.evidence) {
    const stats = pairStats(ev.pairs, ev.metric);
    const st = statsText(stats, ev.metric);
    out.push('### ' + markdownCell(ev.title) + (ev.status ? ' · ' + claimStates[ev.status] : ''), '', markdownCell(ev.subtitle || ''), '');
    if (ev.reason) out.push('- 判定原因：' + markdownCell(ev.reason));
    if (stats) out.push('- 配对 ' + st.n + ' 组 · 均值 ' + st.mean + ' · 95% CI ' + st.ci + ' · 符号检验 p ' + st.p);
    out.push('', '| 种子 | 测试集 | 基线 | 实验组 | 差值 |', '| --- | --- | ---: | ---: | ---: |',
      ...ev.pairs.map(({base, test, delta}) => '| ' + [base.seed, base.split, formatValue(base.value, ev.metric), formatValue(test.value, ev.metric), formatValue(delta, ev.metric, true)].map(markdownCell).join(' | ') + ' |'), '',
      '| 种子 | 组别 | 方法 | 来源 | 行号 | 配置 | Git 提交 |', '| --- | --- | --- | --- | ---: | --- | --- |');
    for (const {base, test} of ev.pairs) for (const [group, run] of [['基线', base], ['实验组', test]])
      out.push('| ' + [run.seed, group, run.method, run.source || '未记录', run.row ?? '—', run.config || '未记录', run.commit || '未记录'].map(markdownCell).join(' | ') + ' |');
    out.push('');
  }
  if (model.runs.length) {
    out.push('## 直接关联的运行', '', '| 数据集 | 方法 | 种子 | 测试集 | 指标 | 值 | 来源 | 行号 |', '| --- | --- | --- | --- | --- | ---: | --- | ---: |',
      ...model.runs.map(run => '| ' + [run.dataset, run.method, run.seed, run.split, metricNames[run.metric], formatValue(run.value, run.metric), run.source || '未记录', run.row ?? '—'].map(markdownCell).join(' | ') + ' |'), '');
  }
  const m = model.materials;
  if (m.papers.length || m.notes.length || m.tasks.length) {
    out.push('## 关联材料', '');
    if (m.papers.length) out.push('### 文献', '', ...m.papers.map(item => '- [' + markdownCell(item.key) + '] ' + markdownCell(item.title) + (item.year ? '（' + item.year + '）' : '')), '');
    if (m.notes.length) out.push('### 科研日志', '', ...m.notes.map(item => '- ' + markdownCell(item.date + ' · ' + item.kind + ' · ' + item.title) + '\n  ' + markdownCell(item.text)), '');
    if (m.tasks.length) out.push('### 待办', '', ...m.tasks.map(item => '- [' + (item.status === '已完成' ? 'x' : ' ') + '] ' + markdownCell(item.title)), '');
  }
  if (model.hint) out.push('> ' + markdownCell(model.hint), '');
  out.push('_链路按 数据集 + 测试集划分 + 随机种子 + 配置 + CSV 行号 锚定，可还原到原始记录。_');
  return out.join('\n').trim() + '\n';
}
