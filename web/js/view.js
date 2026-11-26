const $ = selector => document.querySelector(selector);
const root = $('#content');
let state = null;
let serverVersion = 0;
let page = 'home';
let compare = {};
let chosenPair = 0;
let overviewPair = 0;
let compareMode = 'plot';
let draftSection = '方法';
let draftMode = 'edit';
let runPage = 0;
let searchPaper = '';
let searchRun = '';
let hypothesisFilter = '';
let claimDemo = false;
let demoClaimRule = claimDemoRule;
let claimDatasetIndex = 0;
let claimReport = null;
let claimBusy = false;
let demoMode = false;
let accountName = '';
let migrationPending = null;
let traceAnchor = '';
let messageTimer;
const project = () => state ? (state.projects.find(item => item.id === state.active) || state.projects[0]) : null;
const svgIcon = paths => '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
const ICONS = {
  home: svgIcon('<path d="M3.8 9.3 10 4l6.2 5.3"/><path d="M5.6 8.6V16h8.8V8.6"/><path d="M8.4 16v-4.2h3.2V16"/>'),
  papers: svgIcon('<path d="M6.2 3.5h5.6L15.4 7v9.5H6.2z"/><path d="M11.6 3.5V7h3.8"/><path d="M8.6 10.2h4.4M8.6 13h3"/>'),
  hypotheses: svgIcon('<circle cx="10" cy="10" r="6.4"/><circle cx="10" cy="10" r="2.7"/>'),
  runs: svgIcon('<path d="M3.8 16h12.4"/><path d="M6.3 16v-4.6"/><path d="M10 16V7.4"/><path d="M13.7 16v-6.2"/>'),
  evidence: svgIcon('<path d="M3.8 7.2h10.4"/><path d="m11.6 4.6 2.6 2.6-2.6 2.6"/><path d="M16.2 12.8H5.8"/><path d="m8.4 10.2-2.6 2.6 2.6 2.6"/>'),
  claims: svgIcon('<circle cx="10" cy="10" r="6.4"/><path d="m7.3 10.3 1.9 1.9 3.5-3.9"/>'),
  trace: svgIcon('<path d="m8.4 11.6 3.2-3.2"/><path d="m9.7 5.9 1.3-1.3a2.75 2.75 0 0 1 3.9 3.9l-1.3 1.3"/><path d="m10.3 14.1-1.3 1.3a2.75 2.75 0 0 1-3.9-3.9l1.3-1.3"/>'),
  drafts: svgIcon('<path d="M4.6 15.4h10.8"/><path d="M13.6 4.4a1.75 1.75 0 0 1 2 2L9.3 12.7l-2.9.9.9-2.9z"/>'),
  notes: svgIcon('<rect x="4.6" y="3.5" width="10.8" height="13" rx="1.6"/><path d="M7.6 7.2h4.8M7.6 10h4.8M7.6 12.8h3"/>'),
};

function html(value) {
  const entities = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}
function action(label, key, value = '', style = 'ghost') {
  const cls = style.startsWith('text') ? 'text-button' + style.slice(4) : 'button ' + style;
  return '<button class="' + cls + '" type="button" data-action="' + key + '" data-value="' + html(value) + '">' + html(label) + '</button>';
}
function segmented(label, key, choices, current) {
  return '<div class="segmented" role="group" aria-label="' + html(label) + '">' + choices.map(([value,text]) =>
    '<button type="button" data-action="' + key + '" data-value="' + value + '" aria-pressed="' + (current === value) + '">' + html(text) + '</button>'
  ).join('') + '</div>';
}
function actions(...items) { return '<div class="actions">' + items.join('') + '</div>'; }
function badge(value, open = false) { return '<span class="status' + (open ? ' open' : '') + '">' + html(value) + '</span>'; }
function heading(title, note, buttons = '') {
  return '<header class="page-heading"><div><h1>' + html(title) + '</h1>' + (note ? '<p>' + html(note) + '</p>' : '') + '</div>' + buttons + '</header>';
}
function section(title, buttons = '') { return '<div class="section-heading"><h2>' + html(title) + '</h2>' + buttons + '</div>'; }
function list(items, renderItem, emptyText) {
  return items.length ? '<ul class="list">' + items.map(renderItem).join('') + '</ul>' : '<p class="empty">' + html(emptyText) + '</p>';
}
function entityActions(kind, item) { return actions(action('编辑', 'edit', kind + ':' + item.id, 'text'), action('删除', 'delete', kind + ':' + item.id, 'text danger')); }
function safeLink(value, label) {
  const href = safeURL(value);
  return href ? '<a href="' + html(href) + '" target="_blank" rel="noopener noreferrer">' + html(label) + '</a>' : '';
}
function lookupTitle(p, target) { return p.hypotheses.find(item => item.id === target)?.title || ''; }
function filterLabel(p) {
  return hypothesisFilter ? '<div class="toolbar"><p class="meta">关联假设 · ' + html(lookupTitle(p,hypothesisFilter)) + '</p>' + action('清除筛选','clear-hypothesis','','text') + '</div>' : '';
}
function renderMeta(p) {
  $('#project-choice').innerHTML = state.projects.map(item => '<option value="' + html(item.id) + '"' + (p.id === item.id ? ' selected' : '') + '>' + html(item.title) + '</option>').join('');
  const navigation = $('#navigation');
  if (!navigation.children.length) {
    navigation.innerHTML = pages.map(([key,label]) => '<button class="nav-button" type="button" data-action="page" data-value="' + key + '"><span class="nav-icon" aria-hidden="true">' + (ICONS[key] || '') + '</span><span>' + label + '</span></button>').join('');
  }
  for (const button of navigation.children) {
    if (button.dataset.value === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  $('#project-crumb').textContent = p.title;
  $('#section-crumb').textContent = pages.find(([key]) => key === page)[1];
}
function render() {
  const p = project();
  if (!p) return;
  renderMeta(p);
  $('#demo-banner').hidden = !demoMode;
  root.innerHTML = views[page](p);
}
let syncMode = 'boot';
let saveTimer = null;
let saving = false;
let dirty = false;
function timeNow() {
  const date = new Date();
  return String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
}
function setSyncStatus(mode, text) {
  syncMode = mode;
  $('#storage-state').textContent = text;
  const dot = $('.storage-dot');
  dot.classList.toggle('is-busy', mode === 'boot' || mode === 'saving' || mode === 'pending');
  dot.classList.toggle('is-error', mode === 'failed' || mode === 'conflict' || mode === 'login');
  dot.classList.toggle('is-demo', mode === 'demo');
  $('#storage-retry').hidden = mode !== 'failed';
  $('#storage-reload').hidden = mode !== 'conflict';
  $('#storage-login').hidden = mode !== 'login' && mode !== 'demo';
}
function save() {
  if (!state) return false;
  if (demoMode) {
    const ok = demoStore.save(JSON.stringify(state));
    setSyncStatus('demo', ok ? '演示已保存 · ' + timeNow() : '演示保存失败');
    if (!ok) notice('浏览器存储不可用，演示改动仅保留在当前页面。');
    return ok;
  }
  dirty = true;
  if (syncMode === 'conflict' || syncMode === 'login') return true;
  if (syncMode !== 'saving') setSyncStatus('pending', '有改动待保存');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
  return true;
}
async function flushSave() {
  if (saving || !state || syncMode === 'conflict' || syncMode === 'login') return false;
  if (!dirty) return true;
  saving = true;
  dirty = false;
  setSyncStatus('saving', '正在保存到云端…');
  const payload = JSON.stringify(state);
  const baseVersion = serverVersion;
  try {
    serverVersion = await projectStore.save(payload, baseVersion);
    saving = false;
    if (dirty) {
      setSyncStatus('pending', '有改动待保存');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 300);
    } else setSyncStatus('ready', '已保存到云端 · ' + timeNow());
    return true;
  } catch (error) {
    saving = false;
    dirty = true;
    if (error.code === 'write_conflict') {
      setSyncStatus('conflict', '云端已有更新');
      notice(syncErrorText(error));
    } else if (error.status === 401 || error.code === 'login_required') {
      setSyncStatus('login', '未登录，改动暂存本页');
      notice('登录状态已失效。改动仍在当前页面，请登录后重试保存。');
    } else {
      setSyncStatus('failed', '保存失败');
      notice(syncErrorText(error) + ' 改动仍在当前页面，可重试或先备份课题。');
    }
    return false;
  }
}
// Server-side import/verify act on the saved workspace; pending edits must be
// persisted first so the verdict and the stored records cannot diverge.
async function ensureSaved() {
  if (demoMode) return true;
  let guard = 0;
  while (saving && guard < 200) { await new Promise(resolve => setTimeout(resolve, 50)); guard += 1; }
  if (dirty) return flushSave();
  return syncMode === 'ready' || syncMode === 'pending';
}
async function reloadCloud() {
  if (dirty && !window.confirm('重新加载会丢弃本页未保存的改动。建议先点击「备份课题」。仍要重新加载？')) return;
  setSyncStatus('boot', '正在重新加载…');
  try {
    const {state: saved, version} = await projectStore.load();
    if (!saved) { location.reload(); return; }
    state = saved;
    serverVersion = version;
    dirty = false;
    selectProject(state.projects.some(item => item.id === state.active) ? state.active : state.projects[0].id);
    setSyncStatus('ready', '已加载云端最新数据');
    render();
    notice('已重新加载云端数据。');
  } catch (error) {
    if (error.status === 401 || error.code === 'login_required') {
      setSyncStatus('login', '未登录');
      notice('请先登录站点。');
    } else {
      setSyncStatus('conflict', '重新加载失败');
      notice(syncErrorText(error));
    }
  }
}
function bootLoadingView() {
  return '<div class="boot-screen" role="status"><span class="boot-spinner" aria-hidden="true"></span><h1>正在加载云端课题</h1><p>正在从服务端读取你的研究数据…</p></div>';
}
function bootLoginView() {
  return '<div class="boot-screen"><span class="boot-glyph" aria-hidden="true">◇</span><h1>有据 · 可追溯科研工作台</h1><p class="meta">ResearchTrace · 让每一句科研结论都有据可查</p><p>管理课题、文献、实验运行、对照证据与论文草稿。可以先用独立样例课题免登录体验：导入 CSV、核对结论、查看证据都能实际操作；登录后的课题按账号保存在云端。</p><div class="actions"><button class="button primary" type="button" data-action="start-demo">免登录体验</button><button class="button ghost" type="button" data-action="goto-login">登录保存我的课题</button></div><p class="meta">演示数据只保存在本浏览器，不会进入任何账号。</p></div>';
}
function bootMigrationView(local) {
  const account = accountName ? '「' + html(accountName) + '」' : '当前登录账号';
  return '<div class="boot-screen"><span class="boot-glyph" aria-hidden="true">⇪</span><h1>发现本浏览器保存的旧课题</h1><p>云端工作区还是空的。是否把下面 ' + local.projects.length + ' 个课题上传到账号 ' + account + '？上传成功前不会改动云端数据，旧数据也会继续保留在本浏览器。</p><ul class="migration-list">' + local.projects.map(item => '<li><strong>' + html(item.title || '未命名课题') + '</strong><span class="meta">' + item.runs.length + ' 条运行 · ' + (item.papers?.length ?? 0) + ' 篇文献 · ' + (item.evidence?.length ?? 0) + ' 组证据</span></li>').join('') + '</ul><div class="actions"><button class="button primary" type="button" data-action="confirm-migration">上传到该账号</button><button class="button ghost" type="button" data-action="decline-migration">暂不上传，新建空白课题</button></div></div>';
}
function bootErrorView(error) {
  return '<div class="boot-screen" role="alert"><span class="boot-glyph is-error" aria-hidden="true">!</span><h1>暂时无法加载课题</h1><p>' + html(syncErrorText(error)) + '</p><div class="actions"><button class="button primary" type="button" data-action="retry-boot">重试</button><button class="button ghost" type="button" data-action="start-demo">免登录体验</button></div></div>';
}
function startDemo() {
  demoMode = true;
  migrationPending = null;
  claimReport = null;
  state = demoStore.load() || defaultState();
  serverVersion = 0;
  dirty = false;
  selectProject(state.projects.some(item => item.id === state.active) ? state.active : state.projects[0].id);
  setSyncStatus('demo', '演示模式 · 保存在本浏览器');
  render();
  notice('已进入演示模式：独立样例课题，改动只保存在本浏览器。');
}
async function confirmMigration() {
  if (!migrationPending || saving) return;
  state = migrationPending;
  migrationPending = null;
  selectProject(state.projects.some(item => item.id === state.active) ? state.active : state.projects[0].id);
  render();
  dirty = true;
  const ok = await flushSave();
  if (ok) {
    try { localStorage.removeItem(storageKey); } catch {}
    notice('已把 ' + state.projects.length + ' 个课题同步到云端。');
  } else {
    notice('上传未成功，旧数据仍保留在本浏览器，可点击「重试」。');
  }
}
function declineMigration() {
  migrationPending = null;
  try { sessionStorage.setItem('research-bench-migrate-declined', '1'); } catch {}
  state = defaultState();
  selectProject(state.active);
  setSyncStatus('ready', '正在初始化云端课题…');
  render();
  dirty = true;
  flushSave();
}
async function boot() {
  demoMode = false;
  migrationPending = null;
  claimReport = null;
  setSyncStatus('boot', '正在连接云端…');
  $('#demo-banner').hidden = true;
  root.innerHTML = bootLoadingView();
  try {
    const {state: saved, version, account} = await projectStore.load();
    serverVersion = version;
    accountName = typeof account?.name === 'string' ? account.name : '';
    if (saved) {
      state = saved;
      setSyncStatus('ready', '已同步云端数据');
      render();
      return;
    }
    let declined = false;
    try { declined = sessionStorage.getItem('research-bench-migrate-declined') === '1'; } catch {}
    const local = declined ? null : localMigrationState();
    if (local) {
      migrationPending = local;
      setSyncStatus('pending', '发现待迁移的旧数据');
      root.innerHTML = bootMigrationView(local);
      return;
    }
    state = defaultState();
    setSyncStatus('ready', '正在初始化云端课题…');
    render();
    dirty = true;
    await flushSave();
  } catch (error) {
    if (error.status === 401 || error.code === 'login_required') {
      setSyncStatus('login', '未登录');
      root.innerHTML = bootLoginView();
    } else {
      setSyncStatus('failed', '连接失败');
      root.innerHTML = bootErrorView(error);
    }
  }
}
window.addEventListener('beforeunload', event => {
  if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
});
function notice(message) {
  const item = $('#notice');
  item.textContent = message;
  item.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { item.hidden = true; }, 3800);
}

function homeView(p) {
  const open = p.tasks.filter(task => task.status !== '已完成');
  const counts = [['papers',p.papers.length,'文献记录'],['hypotheses',p.hypotheses.length,'研究假设'],['runs',p.runs.length,'实验运行'],['evidence',p.evidence.length,'已存证据']];
  const completed = p.tasks.length - open.length;
  return '<header class="hero"><div class="hero-graphic" aria-hidden="true"><i></i></div><div class="hero-main"><span class="hero-label"><i></i>' + (p.demo ? '内置演示课题' : '当前研究课题') + '</span><h1>' + html(p.title) + '</h1><p>' + html(p.goal || '在课题设置中填写阶段目标。') + '</p>' + actions(action('导入实验 CSV','import-csv','','hero-primary'),action('课题设置','edit','project','hero-button')) + '</div><div class="hero-aside"><small>研究问题</small><strong>' + html(p.question || '待填写') + '</strong></div></header>' +
    '<div class="milestones">' + counts.map(([key,count,label]) => '<button class="milestone" type="button" data-action="page" data-value="' + key + '"><span class="metric-icon" aria-hidden="true">' + (ICONS[key] || '') + '</span><span class="metric-copy"><span class="metric-title">' + label + '</span><strong>' + count + '</strong></span><span class="metric-arrow" aria-hidden="true">↗</span></button>').join('') + '</div>' +
    '<div class="overview"><section class="panel overview-result">' + section('最近的实验对照') + overviewEvidence(p.evidence.at(-1)) + '</section>' +
    '<div class="overview-side"><section class="panel overview-tasks">' + section('研究待办', action('＋ 新建','new','tasks','text')) +
    (p.tasks.length ? '<div class="task-progress"><span><strong>' + completed + ' / ' + p.tasks.length + '</strong> 已完成</span><progress max="' + p.tasks.length + '" value="' + completed + '" aria-label="研究待办完成进度"></progress></div>' : '') +
    list(open, task => '<li><div><span class="list-title">' + html(task.title) + '</span><span class="meta">' + html([lookupTitle(p,task.target),task.date].filter(Boolean).join(' · ')) + '</span></div>' + actions(action('完成','complete',task.id),action('编辑','edit','tasks:' + task.id,'text')) + '</li>', '暂无待完成项。') +
    (completed ? '<details class="task-completed"><summary>已完成待办</summary>' + list(p.tasks.filter(task => task.status === '已完成'), task => '<li><span>' + html(task.title) + '</span>' + action('重新打开','complete',task.id,'text') + '</li>', '') + '</details>' : '') + '</section>' +
    '<section class="panel overview-log">' + section('研究日志', action('查看全部','page','notes','text')) +
    list([...p.notes].sort((a,b) => b.date.localeCompare(a.date)).slice(0,2), note => '<li><div><span class="list-title">' + html(note.title) + '</span><span class="meta">' + html(note.date + ' · ' + note.kind) + '</span></div></li>', '还没有研究日志。') + '</section></div></div>';
}

function overviewEvidence(evidence) {
  if (!evidence) return '<p class="empty">保存一组实验对照后，这里会显示配对结果。</p>' + action('打开对照','page','evidence','ghost');
  const {options,pairs,mean,demo} = evidence;
  if (overviewPair >= Math.min(5,pairs.length)) overviewPair = 0;
  return '<div class="evidence-heading"><div><h3>' + html(evidence.title) + '</h3><span class="mono meta">' + html(options.dataset + ' / ' + metricNames[options.metric]) + '</span></div>' + (demo ? '<span class="status">演示数据</span>' : '') + '</div>' +
    '<div class="score-band"><strong>' + html(formatValue(mean,options.metric,true)) + '</strong><span>配对平均差<br><small>' + pairs.length + ' 组可配对运行</small></span></div>' +
    '<div class="legend"><span>○ ' + html(options.base) + '</span><span>● ' + html(options.test) + '</span></div>' +
    pairChart(pairs,options.metric,{key:'overview-pair',selected:overviewPair,limit:5}) +
    '<div class="pair-preview" id="overview-pair-preview" aria-live="polite">' + overviewPairPreview(pairs[overviewPair],options.metric) + '</div>' +
    '<div class="evidence-footer">' + action('打开实验对照 ↗','open-overview-evidence',evidence.id,'ghost') + '</div>';
}

function overviewPairPreview(pair, metric) {
  if (!pair) return '';
  const source = run => run.source + (run.row ? ':' + run.row : '');
  return '<div class="pair-preview-title"><strong>seed ' + html(pair.base.seed) + '</strong><code>' + html(pair.base.split) + '</code></div>' +
    [pair.base,pair.test].map((run,index) => '<div class="pair-preview-run"><span class="meta">' + (index ? '实验组' : '基线') + '</span><strong>' + html(formatValue(run.value,metric)) + '</strong><code>' + html(source(run) || '来源未记录') + '</code></div>').join('');
}

function matchingItems(p, query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = text => terms.every(term => text.toLowerCase().includes(term));
  const routes = pages.filter(([,label]) => matches(label)).map(([key,label]) => ({key,label,icon:ICONS[key] || '',kind:'模块',page:key}));
  if (!terms.length) return routes;
  const papers = p.papers.filter(paper => matches([paper.title,paper.authors,paper.key].join(' ')))
    .slice(0,5).map(paper => ({key:paper.id,label:paper.title,icon:ICONS.papers,kind:'文献',page:'papers'}));
  const evidence = p.evidence.filter(item => matches([item.title,item.options.dataset,item.options.test].join(' ')))
    .slice(0,5).map(item => ({key:item.id,label:item.title,icon:ICONS.evidence,kind:'证据',page:'evidence'}));
  return [...routes,...papers,...evidence].slice(0,10);
}
function papersList(p) {
  const query = searchPaper.toLowerCase().trim();
  const papers = p.papers.filter(item => [item.title,item.authors,item.key,item.method].some(value => value.toLowerCase().includes(query)));
  return list(papers, item => '<li><div><span class="list-title">' + html(item.title) + '</span><span class="meta">' + html([item.authors,item.year].filter(Boolean).join(' · ')) + '</span>' +
    '<p>' + html(item.method) + '</p>' + (item.note ? '<details><summary>阅读笔记</summary><p class="note-article">' + html(item.note) + '</p></details>' : '') +
    (item.abstract || item.refs?.length ? '<details class="parse-paper"><summary>解析内容' + (item.source ? ' · ' + html(item.source) : '') + (item.pages ? ' · ' + item.pages + ' 页' : '') + '</summary>' +
      (item.abstract ? '<p class="note-article">' + html(item.abstract) + '</p>' : '') +
      (item.refs?.length ? '<ol class="parse-refs">' + item.refs.map(ref => '<li><span class="parse-page">第 ' + ref.page + ' 页</span>' + html(ref.text) + '</li>').join('') + '</ol>' : '') + '</details>' : '') +
    '<p class="meta"><code>' + html(item.key) + '</code> ' + (item.doi ? safeLink('https://doi.org/' + encodeURIComponent(item.doi).replace(/%2F/gi, '/'), 'DOI ↗') : '') + '</p></div><div class="stack">' +
    badge(item.status,item.status !== '已整理') + entityActions('papers',item) + '</div></li>', query ? '没有匹配的文献。' : '添加第一篇参考文献。');
}
function papersView(p) {
  return heading('文献库','登记出处、提炼方法与证据，写作时用引用键插入文献。也可解析 PDF 自动入库（带页码锚点）。', actions(action('导出 BibTeX','export-bib'),action('解析文本','parse-text'),action('解析 PDF','parse-pdf'),action('添加文献','new','papers','primary'))) +
    '<section class="panel"><input type="search" id="paper-search" autocomplete="off" placeholder="搜索题名、作者或引用键" aria-label="搜索文献" value="' + html(searchPaper) + '"><div id="paper-results">' + papersList(p) + '</div></section>';
}
function hypothesesView(p) {
  return heading('研究设计',p.question || '把研究问题拆成可以检验的假设和验收条件。', actions(action('新建假设','new','hypotheses','primary'))) +
    '<section class="panel">' + list(p.hypotheses, item => '<li><div><span class="list-title">' + html(item.title) + '</span><p>' + html(item.claim) + '</p>' +
      '<dl class="detail-pairs"><dt>主指标</dt><dd>' + html(metricNames[item.metric]) + '</dd><dt>控制条件</dt><dd>' + html(item.controls || '待补充') + '</dd><dt>判定标准</dt><dd>' + html(item.criterion || '待补充') + '</dd><dt>关联材料</dt><dd>' +
      actions(action('运行 ' + p.runs.filter(run => run.target === item.id).length,'linked','runs:' + item.id,'text'),
        action('证据 ' + p.evidence.filter(e => e.target === item.id).length,'linked','evidence:' + item.id,'text'),action('日志 ' + p.notes.filter(n => n.target === item.id).length,'linked','notes:' + item.id,'text')) +
      '</dd></dl></div><div class="stack">' + badge(item.status,item.status !== '已复核') + entityActions('hypotheses',item) + '</div></li>', '新建一项可检验的研究假设。') + '</section>';
}
const pageSize = 20;
function runTable(p) {
  const query = searchRun.trim().toLowerCase();
  const rows = p.runs.filter(run => (!hypothesisFilter || run.target === hypothesisFilter) && [run.dataset,run.method,run.seed,run.split,run.source,lookupTitle(p,run.target)].some(value => String(value).toLowerCase().includes(query)));
  const totalPages = Math.max(1,Math.ceil(rows.length/pageSize));
  runPage = Math.min(runPage,totalPages-1);
  if (!rows.length) return '<p class="empty">' + (query ? '没有匹配的运行。' : '导入 CSV 或手动登记一次运行。') + '</p>';
  return '<div class="table-area"><table><thead><tr><th>数据集 / 方法</th><th>种子</th><th>指标</th><th class="num">值</th><th>测试集</th><th>来源 / 编辑</th></tr></thead><tbody>' +
    rows.slice(runPage*pageSize,(runPage+1)*pageSize).map(run => '<tr><td><strong>' + html(run.dataset) + '</strong><br>' + html(run.method) + '</td><td class="mono">' + html(run.seed) + '</td><td>' + html(metricNames[run.metric]) + '</td><td class="num mono">' + html(formatValue(run.value,run.metric)) + '</td><td><code>' + html(run.split) + '</code></td><td><span class="meta">' + html(run.source + (run.row ? ' #' + run.row : '')) + '</span><br>' +
      action('查看运行','edit','runs:' + run.id,'text') + '</td></tr>').join('') + '</tbody></table></div><div class="toolbar" style="margin-top:8px"><span class="meta">' + rows.length + ' 条 · 第 ' + (runPage+1) + ' / ' + totalPages + ' 页</span><div class="actions">' +
    (runPage > 0 ? action('上一页','run-page','-1') : '') + (runPage < totalPages-1 ? action('下一页','run-page','1') : '') + '</div></div>';
}
function runsView(p) {
  return heading('实验与数据','每行记录一次运行。用明确的测试集标识，建议填入测试样本清单哈希。',actions(action('下载 CSV 模板','csv-template'),action('导入 CSV','import-csv'),action('登记运行','new','runs','primary'))) +
    '<div class="grid"><section class="panel">' + section('运行记录') + filterLabel(p) + '<input type="search" id="run-search" aria-label="搜索运行记录" placeholder="搜索数据集、方法、测试集或假设" value="' + html(searchRun) + '"><div id="run-results">' + runTable(p) + '</div></section>' +
    '<section class="panel">' + section('数据集登记',action('添加','new','datasets','text')) +
    list(p.datasets, item => '<li><div><span class="list-title">' + html(item.title) + '</span><span class="meta">测试集 <code>' + html(item.split) + '</code></span><p>' + html(item.note) + '</p>' +
      safeLink(item.source,'数据来源 ↗') + '</div>' + entityActions('datasets',item) + '</li>', '记录数据版本、划分标识和来源。') + '</section></div>';
}
function csvPreviewView(result, tab) {
  const labels = {pending:'可导入',duplicates:'重复',conflicts:'冲突'};
  const options = Object.entries(labels).map(([key,label]) => [key,label + ' ' + result[key].length]);
  const entries = result[tab].slice(0,30).map(entry => tab === 'pending' ? {run:entry} : entry);
  const hasReferences = tab !== 'pending';
  const row = ({run,reference}) => '<tr><td class="mono">' + html(run.row) + '</td><td><strong>' + html(run.dataset) + '</strong><br>' + html(run.method) + '</td><td><code>' + html(run.split) + '</code><br><span class="meta">seed ' + html(run.seed) + '</span></td><td>' + csvRunPreview(run) + '</td>' +
    (reference ? '<td>' + csvRunPreview(reference) + '<small class="meta">' + html(reference.source || '来源未记录') + (reference.row ? ':' + html(reference.row) : '') + '</small></td>' : '') + '</tr>';
  return '<div class="csv-summary">' + segmented('预览记录类型','csv-tab',options,tab) + '</div>' +
    (result.conflicts.length ? '<p class="warn">同一运行的数值、配置或 Git 提交有差异。冲突行会跳过，已保存的记录继续保留。</p>' : '') +
    (entries.length ? '<div class="table-area"><table class="csv-table"><thead><tr><th scope="col">CSV 行</th><th scope="col">数据集 / 方法</th><th scope="col">测试集 / 种子</th><th scope="col">文件里的值</th>' + (hasReferences ? '<th scope="col">对照记录</th>' : '') + '</tr></thead><tbody>' + entries.map(row).join('') + '</tbody></table></div>' : '<p class="empty">此分类没有记录。</p>') +
    (result[tab].length > entries.length ? '<p class="meta csv-limit">显示前 ' + entries.length + ' 条，共 ' + result[tab].length + ' 条。</p>' : '');
}
function csvRunPreview(run) {
  return '<strong>' + html(formatValue(run.value,run.metric)) + '</strong><span class="meta"> · ' + html(metricNames[run.metric]) + '</span>' +
    (run.config ? '<code>配置 ' + html(run.config) + '</code>' : '') + (run.commit ? '<code>提交 ' + html(run.commit) + '</code>' : '');
}
function distinct(items) { return [...new Set(items)]; }
function option(value,label,selected) { return '<option value="' + html(value) + '"' + (selected ? ' selected' : '') + '>' + html(label) + '</option>'; }
function chooseValid(value, options, defaultValue) { return options.includes(value) ? value : defaultValue; }
function compareOptions(p) {
  const datasets = distinct(p.runs.map(run => run.dataset));
  compare.dataset = chooseValid(compare.dataset,datasets,datasets[0] || '');
  const subset = p.runs.filter(run => run.dataset === compare.dataset);
  const metrics = distinct(subset.map(run => run.metric));
  compare.metric = chooseValid(compare.metric,metrics,metrics[0] || '');
  const methods = distinct(subset.filter(run => run.metric === compare.metric).map(run => run.method));
  compare.base = chooseValid(compare.base,methods,methods[0] || '');
  const candidate = methods.filter(name => name !== compare.base);
  compare.test = chooseValid(compare.test,candidate,candidate[0] || '');
  return { datasets, metrics, methods, candidate };
}
function comparisonControls(p) {
  const {datasets, metrics, methods, candidate} = compareOptions(p);
  return '<div class="controls">' + [['dataset','数据集',datasets],['metric','指标',metrics],['base','基线',methods],['test','实验组',candidate]].map(([key,label,options]) =>
    '<label class="field"><span>' + label + '</span><select data-compare="' + key + '">' + (options.length ? options.map(v => option(v,key === 'metric' ? metricNames[v] : v,compare[key] === v)).join('') : option('','暂无',true)) + '</select></label>').join('') + '</div>';
}
function pairDetails(pair, metric) {
  if (!pair) return '<p class="empty">选中配对记录后，可查看两次运行的来源。</p>';
  const [base,test] = [pair.base,pair.test];
  return '<div class="record-key"><code>seed ' + html(base.seed) + '</code><code>' + html(base.split) + '</code></div>' +
    [base,test].map((run,i) => '<article class="record-entry' + (i ? ' record-test' : '') + '"><div class="record-title"><span class="meta">' + (i ? '实验组' : '基线组') + '</span><strong>' + html(formatValue(run.value,metric)) + '</strong></div><h3>' + html(run.method) + '</h3>' +
      '<dl class="detail-pairs"><dt>配置</dt><dd><code>' + html(run.config || '未记录') + '</code></dd><dt>提交</dt><dd><code>' + html(run.commit || '未记录') + '</code></dd><dt>源记录</dt><dd><code>' + html(run.source + (run.row ? ':' + run.row : '')) + '</code></dd></dl></article>').join('');
}
function comparisonPlot(result, metric) {
  const {pairs,mean,baseOnly,testOnly,sameTest} = result;
  const missing = baseOnly.length + testOnly.length;
  if (!compare.test) return '<p class="empty">同一数据集和指标下至少需要两种方法。</p>';
  if (!pairs.length) return '<p class="warn">' + (sameTest ? '测试集相同，但没有能按种子配对的运行。' : '两组记录没有共同的测试集标识，未计算配对差值。') + '</p>';
  const rule = project()?.claimRule;
  const matched = rule && rule.datasets.includes(compare.dataset) && rule.metric === metric && rule.base === compare.base && rule.test === compare.test;
  const meanDisp = mean == null ? null : deltaDisplay(deltaLower(metric) ? -mean : mean, metric);
  const plot = compareMode === 'table' ? pairTable(pairs, metric)
    : compareMode === 'delta' ? deltaChart(pairs, metric, { key: 'pair', selected: chosenPair, mean: meanDisp, threshold: matched ? rule.threshold : null }) + statsPanel(pairStats(pairs, metric), metric)
    : pairChart(pairs, metric, { key: 'pair', selected: chosenPair });
  return '<div class="score-band"><strong>' + html(formatValue(mean,metric,true)) + '</strong><span>配对平均差<br><small>' + pairs.length + ' 组可配对运行</small></span></div>' +
    (missing ? '<div class="warn">另有基线 ' + baseOnly.length + ' 条、实验组 ' + testOnly.length + ' 条未配对。</div>' : '') +
    '<div class="comparison-toolbar">' + (compareMode === 'plot' ? '<div class="legend"><span>○ 基线</span><span>● 实验组</span></div>' : '<span class="meta">' + (compareMode === 'delta' ? '正值＝实验组更优' : '') + '</span>') + segmented('对照显示方式','compare-mode',[['plot','配对图'],['delta','改善量'],['table','数据表']],compareMode) + '</div>' +
    plot +
    '<div class="evidence-footer"><p class="meta">共用测试集时，多种子结果用于描述运行波动。</p>' + actions(action('导出当前复现记录','export-reproduction'),action('保存这组证据','new','evidence','primary')) + '</div>';
}
function pairLabel(pair,metric) {
  return '种子 ' + pair.base.seed + '，测试集 ' + pair.base.split + '，基线 ' + formatValue(pair.base.value,metric) + '，实验组 ' + formatValue(pair.test.value,metric) + '，差值 ' + formatValue(pair.delta,metric,true);
}
function pairTable(pairs,metric) {
  return '<div class="table-area pair-table"><table><thead><tr><th scope="col">随机种子</th><th scope="col" class="num">基线</th><th scope="col" class="num">实验组</th><th scope="col" class="num">配对差值</th></tr></thead><tbody>' + pairs.map((pair,index) =>
    '<tr class="' + (chosenPair === index ? 'selected' : '') + '"><th scope="row"><button class="pair-select" type="button" data-action="pair" data-value="' + index + '" aria-pressed="' + (chosenPair === index) + '" aria-label="' + html(pairLabel(pair,metric)) + '">seed ' + html(pair.base.seed) + '</button><code>' + html(pair.base.split) + '</code></th><td class="num mono">' + html(formatValue(pair.base.value,metric)) + '</td><td class="num mono">' + html(formatValue(pair.test.value,metric)) + '</td><td class="num mono">' + html(formatValue(pair.delta,metric,true)) + '</td></tr>'
  ).join('') + '</tbody></table></div>';
}
function pairChart(pairs, metric, {key,selected,limit=pairs.length}) {
  const percent = ['accuracy','macro_f1'].includes(metric);
  const values = pairs.flatMap(pair => [pair.base.value,pair.test.value]);
  let low = values[0];
  let high = values[0];
  for (const point of values) {
    low = Math.min(low,point);
    high = Math.max(high,point);
  }
  const pad = (high-low)*.12 || (percent ? .01 : Math.abs(high)*.05 || .1);
  const min = Math.max(0, low-pad);
  const max = percent ? Math.min(1, high+pad) : high+pad;
  const x = value => 100*(value-min)/(max-min);
  const displayed = pairs.slice(0,limit);
  return '<div class="plot" role="group" aria-label="按随机种子对比 ' + html(metricNames[metric]) + '">' + displayed.map((pair,index) => {
      const a = x(pair.base.value), b = x(pair.test.value);
      const delta = formatValue(pair.delta,metric,true);
      return '<button class="plot-row" type="button" aria-pressed="' + (selected === index) + '" data-action="' + key + '" data-value="' + index + '" aria-label="' + html(pairLabel(pair,metric)) + '"><span>seed ' + html(pair.base.seed) + '</span><span class="plot-track" aria-hidden="true"><i class="join" style="left:' + Math.min(a,b) + '%;width:' + Math.abs(a-b) + '%"></i><i class="point base" style="left:' + a + '%"></i><i class="point test" style="left:' + b + '%"></i></span><span>' + html(delta) + '</span></button>';
    }).join('') + '<div class="plot-axis"><span></span><span class="plot-ticks">' + Array.from({length:5},(_,i) => '<span>' + html(formatValue(min+(max-min)*i/4,metric)) + '</span>').join('') + '</span><span></span></div></div>' +
    (displayed.length < pairs.length ? '<p class="meta">显示前 ' + displayed.length + ' 组，完整结果见对照页。</p>' : '');
}
const deltaRatio = metric => ['accuracy','macro_f1'].includes(metric);
const deltaLower = metric => ['rmse','latency_ms'].includes(metric);
function deltaDisplay(value, metric) { return deltaRatio(metric) ? value * 100 : value; }
function deltaImprovement(pair, metric) { return deltaDisplay(deltaLower(metric) ? -pair.delta : pair.delta, metric); }
function deltaUnit(metric) { return deltaRatio(metric) ? 'pp' : metric === 'latency_ms' ? 'ms' : ''; }
function deltaSigned(value, metric) {
  const n = Math.abs(value) < 1e-9 ? 0 : value;
  const digits = deltaRatio(metric) || metric === 'latency_ms' ? 2 : 4;
  return (n > 0 ? '+' : '') + n.toFixed(digits) + (deltaUnit(metric) ? ' ' + deltaUnit(metric) : '');
}
function deltaTickText(value, metric) {
  const n = Math.abs(value) < 1e-9 ? 0 : value;
  const digits = deltaRatio(metric) || metric === 'latency_ms' ? 1 : 3;
  return n.toFixed(digits) + (deltaUnit(metric) ? ' ' + deltaUnit(metric) : '');
}
function deltaDomain(values, threshold, mean, metric, ci = null) {
  let lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  if (threshold != null) { lo = Math.min(lo, threshold); hi = Math.max(hi, threshold); }
  if (mean != null) { lo = Math.min(lo, mean); hi = Math.max(hi, mean); }
  if (ci) { lo = Math.min(lo, ci[0]); hi = Math.max(hi, ci[1]); }
  const pad = (hi - lo) * .16 || (deltaRatio(metric) ? .5 : Math.abs(hi) * .12 || .1);
  const dMin = lo - pad, dMax = hi + pad;
  return { dMin, dMax, x: v => 100 * (v - dMin) / (dMax - dMin) };
}
function deltaTicks(dMin, dMax, metric) {
  return '<div class="delta-axis"><span></span><span class="delta-ticks">' +
    Array.from({length: 5}, (_, i) => '<span style="--tick:' + (i * 25) + '%">' + html(deltaTickText(dMin + (dMax - dMin) * i / 4, metric)) + '</span>').join('') +
    '</span><span></span></div>';
}
function deltaChart(pairs, metric, {key, selected, threshold = null, mean = null, limit = pairs.length}) {
  if (!pairs.length) return '';
  const displayed = pairs.slice(0, limit);
  const imps = displayed.map(pair => deltaImprovement(pair, metric));
  const stats = pairStats(displayed, metric);
  const ci = stats && stats.ci ? stats.ci : null;
  const { dMin, dMax, x } = deltaDomain(imps, threshold, mean, metric, ci);
  const zero = x(0);
  const guides = '<i class="delta-zero" style="left:' + zero + '%"></i>' +
    (ci ? '<i class="delta-ci" style="left:' + x(ci[0]) + '%;width:' + (x(ci[1]) - x(ci[0])) + '%" title="95% 置信区间 ' + html(deltaSigned(ci[0], metric)) + ' ~ ' + html(deltaSigned(ci[1], metric)) + '"></i>' : '') +
    (mean != null ? '<i class="delta-mean" style="left:' + x(mean) + '%"><span>均值 ' + html(deltaSigned(mean, metric)) + '</span></i>' : '') +
    (threshold != null && threshold > 0 ? '<i class="delta-threshold" style="left:' + x(threshold) + '%"><span>阈值 ' + html(deltaTickText(threshold, metric)) + '</span></i>' : '');
  const rows = displayed.map((pair, index) => {
    const v = imps[index], vp = x(v);
    const cls = v > 1e-9 ? 'good' : v < -1e-9 ? 'bad' : 'flat';
    return '<button class="delta-row" type="button" data-action="' + key + '" data-value="' + index + '" aria-pressed="' + (selected === index) + '" aria-label="' + html(pairLabel(pair, metric)) + '">' +
      '<span class="delta-seed">seed ' + html(pair.base.seed) + '</span>' +
      '<span class="delta-track" aria-hidden="true"><i class="delta-bar ' + cls + '" style="left:' + Math.min(zero, vp) + '%;width:' + Math.abs(vp - zero) + '%"></i></span>' +
      '<span class="delta-val ' + cls + '">' + html(deltaSigned(v, metric)) + '</span></button>';
  }).join('');
  return '<div class="delta" role="group" aria-label="按随机种子展示' + html(metricNames[metric]) + '改善量，正值表示实验组更优">' +
    '<div class="delta-legend"><span class="lg-good">改善</span><span class="lg-bad">变差</span>' +
    (mean != null ? '<span class="lg-mean">均值</span>' : '') +
    (ci ? '<span class="lg-ci">95% CI</span>' : '') +
    (threshold != null && threshold > 0 ? '<span class="lg-threshold">阈值</span>' : '') +
    '<span class="lg-zero">无变化</span></div>' +
    '<div class="delta-body"><div class="delta-guides" aria-hidden="true">' + guides + '</div>' + rows + deltaTicks(dMin, dMax, metric) + '</div>' +
    (displayed.length < pairs.length ? '<p class="meta">显示前 ' + displayed.length + ' 组，完整结果见对照页。</p>' : '') + '</div>';
}
function claimOverview(rows, rule) {
  const metric = rule.metric;
  const shown = rows.slice(0, 12);
  const items = shown.map(row => ({ value: row.improvement == null ? null : deltaDisplay(row.improvement, metric), status: row.status }));
  const values = items.map(item => item.value).filter(value => value != null);
  const { dMin, dMax, x } = deltaDomain(values, rule.threshold, null, metric);
  const zero = x(0);
  const guides = '<i class="delta-zero" style="left:' + zero + '%"></i>' +
    (rule.threshold > 0 ? '<i class="delta-threshold" style="left:' + x(rule.threshold) + '%"><span>阈值 ' + html(deltaTickText(rule.threshold, metric)) + '</span></i>' : '');
  const bars = shown.map((row, index) => {
    const value = items[index].value;
    const cls = 'st-' + row.status;
    const bar = value == null ? '' : '<i class="delta-bar ' + cls + '" style="left:' + Math.min(zero, x(value)) + '%;width:' + Math.abs(x(value) - zero) + '%"></i>';
    return '<button class="delta-row overview-row" type="button" data-action="claim-select" data-value="' + index + '" aria-pressed="' + (index === claimDatasetIndex) + '" aria-label="' + html(row.dataset + '，' + claimStates[row.status] + (value == null ? '，暂无配对改善量' : '，平均改善 ' + deltaSigned(value, metric))) + '">' +
      '<span class="delta-seed">' + html(row.dataset) + '</span>' +
      '<span class="delta-track" aria-hidden="true">' + bar + '</span>' +
      '<span class="delta-val ' + cls + '">' + (value == null ? '待补' : html(deltaSigned(value, metric))) + '</span></button>';
  }).join('');
  return '<div class="delta claim-overview" role="group" aria-label="各数据集平均改善量与阈值对比">' +
    '<div class="delta-legend"><span class="lg-good">支持</span><span class="lg-threshold">未达阈值</span><span class="lg-bad">反例</span><span class="lg-zero">待补证据</span></div>' +
    '<div class="delta-body"><div class="delta-guides" aria-hidden="true">' + guides + '</div>' + bars + deltaTicks(dMin, dMax, metric) + '</div>' +
    (rows.length > shown.length ? '<p class="meta">显示前 ' + shown.length + ' 个数据集。</p>' : '') + '</div>';
}
function statsPanel(stats, metric) {
  if (!stats) return '';
  const st = statsText(stats, metric);
  return '<div class="stats-panel" role="group" aria-label="配对描述性统计">' +
    '<div class="stats-head"><strong>描述性统计</strong><span class="meta">基于已配对运行 · 不改变服务端判定</span></div>' +
    '<dl class="stats-grid">' +
    '<div><dt>配对数</dt><dd>' + st.n + '</dd></div>' +
    '<div><dt>平均改善</dt><dd>' + html(st.mean) + '</dd></div>' +
    '<div><dt>95% 置信区间</dt><dd>' + html(st.ci) + '</dd></div>' +
    '<div><dt>标准差</dt><dd>' + html(st.sd) + '</dd></div>' +
    '<div><dt>符号检验 p</dt><dd>' + html(st.p) + '</dd></div>' +
    '<div><dt>改善 / 变差 / 持平</dt><dd>' + st.positives + ' / ' + st.negatives + ' / ' + st.zeros + '</dd></div>' +
    '</dl>' +
    (stats.ci ? '<p class="meta stats-note">t 分布 95% CI（df=' + (stats.n - 1) + '）；符号检验为双侧精确二项，忽略持平组。</p>' : '<p class="meta stats-note">样本不足（n&lt;2），仅给出均值与符号计数，不估计区间。</p>') +
    '</div>';
}
function tracePairTable(pairs, metric) {
  return '<div class="table-area"><table><thead><tr><th scope="col">种子</th><th scope="col">测试集</th><th scope="col" class="num">基线</th><th scope="col" class="num">实验组</th><th scope="col" class="num">差值</th><th scope="col" class="num">改善量</th></tr></thead><tbody>' +
    pairs.map(({base, test, delta}) => '<tr><th scope="row" class="mono">' + html(base.seed) + '</th><td><code>' + html(base.split) + '</code></td><td class="num mono">' + html(formatValue(base.value, metric)) + '</td><td class="num mono">' + html(formatValue(test.value, metric)) + '</td><td class="num mono">' + html(formatValue(delta, metric, true)) + '</td><td class="num mono">' + html(formatValue(deltaLower(metric) ? -delta : delta, metric, true)) + '</td></tr>').join('') +
    '</tbody></table></div>';
}
function traceProvenance(pairs) {
  const rows = [];
  for (const {base, test} of pairs) for (const [group, run] of [['基线', base], ['实验组', test]])
    rows.push('<tr><th scope="row" class="mono">' + html(run.seed) + '</th><td>' + html(group) + '</td><td>' + html(run.method) + '</td><td>' + html(run.source || '未记录') + '</td><td class="num mono">' + (run.row ?? '—') + '</td><td><code>' + html(run.config || '未记录') + '</code></td><td><code>' + html(run.commit || '未记录') + '</code></td></tr>');
  return '<div class="table-area"><table><thead><tr><th scope="col">种子</th><th scope="col">组别</th><th scope="col">方法</th><th scope="col">来源</th><th scope="col" class="num">行号</th><th scope="col">配置</th><th scope="col">Git 提交</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}
function traceLayer(title, marker, body) {
  return '<section class="trace-layer"><div class="trace-node" aria-hidden="true">' + marker + '</div><div class="trace-layer-body"><h3>' + html(title) + '</h3>' + body + '</div></section>';
}
function traceView(p) {
  const anchors = [];
  if (p.claimRule) anchors.push(['claim', '结论核对规则']);
  p.hypotheses.forEach(h => anchors.push(['h:' + h.id, h.title]));
  p.evidence.forEach(e => anchors.push(['e:' + e.id, e.title]));
  const head = heading('证据链', '从一条结论或假设出发，逐层追溯到配对运行与原始 CSV 行号。');
  if (!anchors.length) return head + '<p class="empty">先登记一条研究假设或保存一组证据，即可在此查看完整证据链。</p>';
  const anchor = anchors.some(([value]) => value === traceAnchor) ? traceAnchor : anchors[0][0];
  const model = traceModel(p, anchor);
  const controls = '<div class="trace-controls"><label class="field trace-anchor-field"><span>追溯锚点</span><select id="trace-anchor">' +
    anchors.map(([value, label]) => option(value, label, value === anchor)).join('') + '</select></label>' +
    actions(action('导出证据链', 'export-trace'), action('复制 Markdown', 'copy-trace')) + '</div>';
  if (!model) return head + controls + '<p class="empty">该锚点已不存在，请重新选择。</p>';
  const evidence = model.evidence.length ? model.evidence.map(ev => {
    const stats = pairStats(ev.pairs, ev.metric);
    return '<article class="trace-evidence' + (ev.status ? ' st-' + ev.status : '') + '">' +
      '<header><strong>' + html(ev.title) + '</strong>' + (ev.status ? '<span class="claim-tag claim-' + ev.status + '">' + claimStates[ev.status] + '</span>' : '') + (ev.demo ? '<span class="status">演示</span>' : '') + '</header>' +
      '<p class="meta">' + html(ev.subtitle || '') + '</p>' +
      (ev.reason ? '<p class="meta">' + html(ev.reason) + '</p>' : '') +
      (ev.mean != null ? '<p class="trace-mean">平均改善 <strong>' + html(formatValue(ev.mean, ev.metric, true)) + '</strong></p>' : '') +
      statsPanel(stats, ev.metric) +
      (ev.pairs.length ? '<details class="trace-pairs"><summary>配对运行与来源锚点（' + ev.pairs.length + ' 组）</summary>' + tracePairTable(ev.pairs, ev.metric) + traceProvenance(ev.pairs) + '</details>' : '<p class="meta">暂无可配对运行。</p>') +
      (ev.note ? '<p class="meta trace-note">' + html(ev.note) + '</p>' : '') +
      '</article>';
  }).join('') : '<p class="empty">该锚点暂无关联证据。可在证据编辑中设置「关联假设」。</p>';
  const runsTable = model.runs.length ? '<div class="table-area"><table><thead><tr><th scope="col">数据集</th><th scope="col">方法</th><th scope="col">种子</th><th scope="col">测试集</th><th scope="col">指标</th><th scope="col" class="num">值</th><th scope="col">来源</th><th scope="col" class="num">行号</th></tr></thead><tbody>' +
    model.runs.map(run => '<tr><td>' + html(run.dataset) + '</td><td>' + html(run.method) + '</td><td class="mono">' + html(run.seed) + '</td><td><code>' + html(run.split) + '</code></td><td>' + html(metricNames[run.metric]) + '</td><td class="num mono">' + html(formatValue(run.value, run.metric)) + '</td><td>' + html(run.source || '未记录') + '</td><td class="num mono">' + (run.row ?? '—') + '</td></tr>').join('') + '</tbody></table></div>' : '';
  const m = model.materials;
  const materials = (m.papers.length || m.notes.length || m.tasks.length) ?
    (m.papers.length ? '<div class="trace-material"><h4>文献</h4><ul>' + m.papers.map(item => '<li><code>' + html(item.key) + '</code> ' + html(item.title) + (item.year ? ' <span class="meta">(' + html(item.year) + ')</span>' : '') + '</li>').join('') + '</ul></div>' : '') +
    (m.notes.length ? '<div class="trace-material"><h4>科研日志</h4><ul>' + m.notes.map(item => '<li><strong>' + html(item.title) + '</strong> <span class="meta">' + html(item.date + ' · ' + item.kind) + '</span><p>' + html(item.text) + '</p></li>').join('') + '</ul></div>' : '') +
    (m.tasks.length ? '<div class="trace-material"><h4>待办</h4><ul>' + m.tasks.map(item => '<li><span class="status' + (item.status === '已完成' ? ' open' : '') + '">' + html(item.status) + '</span> ' + html(item.title) + '</li>').join('') + '</ul></div>' : '')
    : '<p class="meta">暂无关联文献、日志或待办。可在各条目编辑中设置「关联假设」。</p>';
  return head + controls +
    (model.hint ? '<p class="meta trace-hint">' + html(model.hint) + '</p>' : '') +
    '<div class="trace-chain">' +
    traceLayer('结论', '①', '<div class="trace-statement"><p>' + html(model.statement) + '</p>' + (model.meta.length ? '<div class="trace-meta">' + model.meta.map(item => '<span class="chip">' + html(item) + '</span>').join('') + '</div>' : '') + '</div>') +
    traceLayer('证据与配对运行', '②', evidence) +
    (model.runs.length ? traceLayer('直接关联的运行', '③', runsTable) : '') +
    traceLayer('关联材料', model.runs.length ? '④' : '③', materials) +
    '</div>';
}
function evidenceView(p) {
  const controls = comparisonControls(p);
  const result = comparison(p.runs,compare);
  if (chosenPair >= result.pairs.length) chosenPair = 0;
  return heading('对照与证据','匹配测试集标识和随机种子，查看逐次差异，再把核对过的结果写入论文。',actions(action('核对论文结论','page','claims'))) +
    '<div class="grid evidence-grid"><section class="panel compare-panel">' + section('实验对照',result.pairs.some(pair => [pair.base,pair.test].some(run => run.note === '内置演示数据')) ? badge('演示数据') : '') + controls + comparisonPlot(result,compare.metric) + '</section>' +
    '<section class="panel record-panel">' + section('原始运行记录') + '<div id="pair-details" aria-live="polite">' + pairDetails(result.pairs[chosenPair],compare.metric) + '</div></section></div>' +
    '<section class="panel evidence-library">' + section('已存证据') + filterLabel(p) + list(p.evidence.filter(e => !hypothesisFilter || e.target === hypothesisFilter), e => '<li><div><span class="list-title">' + html(e.title) + '</span><span class="meta">' +
    html([e.options.dataset,e.options.base + ' → ' + e.options.test,formatValue(e.mean,e.options.metric,true),lookupTitle(p,e.target)].filter(Boolean).join(' · ')) + '</span>' +
    (e.note ? '<p>' + html(e.note) + '</p>' : '') + '<details><summary>查看论文结果表及源记录</summary><pre>' + html(markdownEvidence(e)) + '</pre>' +
    e.pairs.map(pair => pairDetails(pair,e.options.metric)).join('') + '</details></div>' +
    actions(action('插入结果章节','insert-evidence',e.id,'text'),action('导出复现记录','export-reproduction',e.id,'text'),action('删除','delete','evidence:' + e.id,'text danger')) + '</li>', '核对结果后保存一组证据。') + '</section>';
}
function draftsView(p) {
  const draft = p.drafts[draftSection];
  return heading('论文写作','按章节保存 Markdown。插入文献引用键和已存证据，再导出草稿与参考文献。',actions(action('导出 Markdown','export-draft'),action('导出 BibTeX','export-bib'))) +
    '<div class="grid writing-grid"><section class="panel writing-panel"><div class="writing-choice" role="group" aria-label="论文草稿章节">' +
    draftSections.map(name => '<button class="button ghost" type="button" aria-pressed="' + (name === draftSection) + '" data-action="draft-section" data-value="' + html(name) + '">' + html(name) + '</button>').join('') +
    '</div><div class="writing-sheet"><div class="writing-toolbar"><h2>' + html(draftSection) + '</h2>' + segmented('写作显示方式','draft-mode',[['edit','编辑'],['preview','预览']],draftMode) + '</div><textarea class="markdown-input" id="draft-input" aria-label="' + html(draftSection) + '草稿" spellcheck="false" placeholder="在此写下本章节内容"' + (draftMode === 'preview' ? ' hidden' : '') + '>' + html(draft) + '</textarea><div id="draft-preview" class="draft-preview" aria-label="Markdown 排版预览"' + (draftMode === 'edit' ? ' hidden' : '') + '>' + (draftMode === 'preview' ? renderMarkdown(draft) : '') + '</div></div>' +
    '<div class="writing-footer"><span>Markdown</span><span id="draft-count">' + draftCount(draft) + '</span></div></section>' +
    '<section class="panel insertion-panel">' + section('插入材料') + '<h3>参考文献</h3>' + list(p.papers, item => '<li><div><span class="list-title">' + html(item.title) + '</span><span class="meta"><code>' + html(item.key) + '</code></span></div>' + action('引用','insert-citation',item.id,'text') + '</li>','先在文献库登记来源。') +
    '<h3>实验结果表</h3>' + list(p.evidence, e => '<li><span>' + html(e.title) + '</span>' + action('插入','insert-evidence',e.id,'text') + '</li>','先在对照页保存证据。') + '</section></div>';
}

const markdownRenderer = new marked.Renderer();
markdownRenderer.html = ({text}) => html(text);
markdownRenderer.image = ({text}) => html(text);
markdownRenderer.link = function ({href,tokens}) {
  const text = this.parser.parseInline(tokens);
  const url = safeURL(href);
  return url ? '<a href="' + html(url) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>' : text;
};
function renderMarkdown(draft) {
  if (!draft.trim()) return '<p class="empty">此章节还没有内容。</p>';
  return marked.parse(draft,{renderer:markdownRenderer,gfm:true});
}
function draftCount(text) {
  return Array.from(text.replace(/\s/g,'')).length + ' 个非空白字符';
}
function notesView(p) {
  return heading('科研日志','记录实验决策、失败尝试和下一步，留住论文正文之外的实验上下文。',actions(action('新建日志','new','notes','primary'))) +
    '<section class="panel">' + filterLabel(p) + list(p.notes.filter(n => !hypothesisFilter || n.target === hypothesisFilter).sort((a,b) => b.date.localeCompare(a.date)), item => '<li><div><span class="meta">' +
    html([item.date,item.kind,lookupTitle(p,item.target)].filter(Boolean).join(' · ')) + '</span><span class="list-title">' + html(item.title) + '</span><p class="note-article">' + html(item.text) + '</p></div>' +
    entityActions('notes',item) + '</li>','添加第一篇研究日志。') + '</section>';
}
const claimDemoRuns = parseRuns(claimDemoCsv,'claim-demo.csv',[]).pending;

function claimContext(p) {
  return {runs:claimDemo ? claimDemoRuns : p.runs,rule:claimDemo ? demoClaimRule : (p.claimRule || null)};
}

function claimOptionField(label,name,options,selected) {
  return '<label class="field"><span>' + html(label) + '</span><select name="' + name + '" required>' +
    option('','请选择',!selected) + options.map(([key,text]) => option(key,text,selected === key)).join('') + '</select></label>';
}

function claimsView(p) {
  const {runs,rule} = claimContext(p);
  const datasets = distinct([...runs.map(run => run.dataset),...(claimDemo ? [] : p.datasets.map(dataset => dataset.title)),...(rule?.datasets || [])]);
  const methods = distinct([...runs.map(run => run.method),...[rule?.base,rule?.test].filter(Boolean)]);
  const methodOptions = methods.map(method => [method,method]);
  const metric = rule?.metric || 'accuracy';
  const controls = claimDemo ? actions(action('下载演示 CSV','claim-demo-csv'),action('返回当前课题','claim-demo','off')) : actions(action('体验演示','claim-demo','on','primary'));
  return heading('结论核对','选择一句论文结论要覆盖的实验条件，逐个查看支持、反例和证据缺口。',controls) +
    (claimDemo ? '<p class="claim-demo-note">演示数据 · 用同一条结论查看三种核对结果。</p>' : '') +
    '<div class="claim-layout"><section class="panel claim-form-panel">' + section('结论与判定规则') +
    '<form id="claim-form" class="claim-form"><label class="field"><span>论文结论</span><textarea name="statement" rows="3" maxlength="600" required placeholder="例：在选定数据集上，实验组均提高了准确率。">' + html(rule?.statement || '') + '</textarea></label>' +
    '<div class="claim-methods">' + claimOptionField('基线','base',methodOptions,rule?.base || '') + claimOptionField('实验组','test',methodOptions,rule?.test || '') +
    claimOptionField('指标','metric',Object.entries(metricNames),metric) + '</div>' +
    '<fieldset class="claim-dataset-pick"><legend>结论覆盖的数据集</legend>' + (datasets.length ? '<div class="claim-checks">' + datasets.map(dataset => '<label><input type="checkbox" name="dataset" value="' + html(dataset) + '"' + ((rule ? rule.datasets.includes(dataset) : true) ? ' checked' : '') + '><span>' + html(dataset) + '</span></label>').join('') + '</div>' : '<p class="meta">导入运行记录后可选择数据集。</p>') + '</fieldset>' +
    '<div class="claim-methods claim-numbers"><label class="field"><span>改善量须超过 <small id="claim-unit">（' + html(claimThresholdUnit(metric)) + '）</small></span><input name="threshold" type="number" min="0" step="any" required value="' + html(rule?.threshold ?? 0) + '"></label><label class="field"><span>每个数据集最低配对数</span><input name="minPairs" type="number" min="1" step="1" required value="' + html(rule?.minPairs ?? 1) + '"></label></div>' +
    '<p class="meta">按数据集、测试集标识和随机种子配对。结论文字用于记录，判定由服务端基于' + (demoMode || claimDemo ? '演示' : '已保存的') + '运行记录执行。</p><p id="claim-form-message" role="status" class="meta"></p><div class="actions">' +
    (methods.length >= 2 && datasets.length ? '<button class="button primary" type="submit">核对结论</button>' : action('导入实验 CSV','import-csv','','primary')) + '</div></form></section>' +
    '<section class="panel claim-result-panel">' + claimPanelContent() + '</section></div>';
}

function claimPanelContent() {
  if (claimBusy) return section('核对结果') + '<div class="claim-loading" role="status"><span class="boot-spinner" aria-hidden="true"></span><p>服务端正在核对配对结果…</p></div>';
  if (claimReport) return section('核对结果') + claimResults(claimReport.rows, claimReport.rule, claimReport);
  return section('核对结果') + '<p class="empty">填写左侧的结论及规则后点击「核对结论」，服务端会基于运行记录返回支持、反例与证据缺口，并附 CSV 行号、随机种子和配置。</p>';
}
function renderClaimPanel() {
  const panel = $('.claim-result-panel');
  if (panel) panel.innerHTML = claimPanelContent();
}

function claimResults(rows,rule,report) {
  const supported = rows.filter(row => row.status === 'supported');
  const counters = rows.filter(row => row.status === 'counter');
  if (claimDatasetIndex >= rows.length) claimDatasetIndex = 0;
  const headline = supported.length === rows.length ? '全部数据集达到规则' : counters.length ? '所选范围内存在反例' : '部分数据集需要复核';
  const basis = report ? (report.basis === 'saved' ? '服务端核对 · 基于云端已保存的运行记录' + (Number.isInteger(report.version) ? '（版本 ' + report.version + '）' : '') : '服务端核对 · 基于演示运行记录') : '';
  const verifiedAt = report?.verifiedAt ? new Date(report.verifiedAt).toLocaleTimeString('zh-CN', {hour12: false}) : '';
  return '<div class="claim-judgment' + (counters.length ? ' claim-has-counter' : '') + '"><strong>' + headline + '</strong><span>' + supported.length + ' / ' + rows.length + ' 个数据集达到规则</span></div>' +
    (basis ? '<p class="meta claim-basis">' + html(basis + (verifiedAt ? ' · ' + verifiedAt : '')) + '</p>' : '') +
    '<p class="claim-statement">' + html(rule.statement) + '</p><p class="meta claim-tested-rule">' + html(rule.base + ' → ' + rule.test + ' · ' + metricNames[rule.metric] + ' · 改善量 > ' + rule.threshold + ' ' + claimThresholdUnit(rule.metric)) + '</p>' +
    claimOverview(rows, rule) +
    '<div class="claim-export">' + actions(action('导出 Markdown 报告', 'export-claim-md'), action('导出配对 CSV', 'export-claim-csv')) + '<span class="meta">报告含来源行号、配置、Git 提交与描述性统计</span></div>' +
    '<div class="claim-result-list" role="group" aria-label="按数据集查看核对详情">' + rows.map((row,index) => '<button class="claim-result-row" type="button" data-action="claim-select" data-value="' + index + '" aria-pressed="' + (index === claimDatasetIndex) + '"><span><strong>' + html(row.dataset) + '</strong><small>' + row.result.pairs.length + ' 组配对' + (row.improvement === null ? '' : ' · ' + html(formatValue(row.improvement,rule.metric,true))) + '</small></span><span class="claim-tag claim-' + row.status + '">' + claimStates[row.status] + '</span></button>').join('') + '</div>' +
    '<div id="claim-detail" class="claim-detail" aria-live="polite">' + claimDetail(rows[claimDatasetIndex],rule) + '</div>' +
    (supported.length && supported.length < rows.length ? '<div class="claim-reword"><strong>可收窄的表述</strong><p>在 ' + html(supported.map(row => row.dataset).join('、')) + ' 的已配对运行中，' + html(rule.test) + ' 相对 ' + html(rule.base) + ' 的' + html(metricNames[rule.metric]) + '平均改善量超过 ' + html(rule.threshold + ' ' + claimThresholdUnit(rule.metric)) + '。</p></div>' : '') +
    '<p class="meta claim-policy">准确率和 F1 越高越好，RMSE 和延迟越低越好。多种子结果用于描述这些运行的变化。</p>';
}

function claimDetail(row,rule) {
  const {result} = row;
  const unpaired = [...result.baseOnly,...result.testOnly];
  return '<div class="section-heading"><h3>' + html(row.dataset) + ' · 运行来源</h3></div><p class="meta">' + html(row.reason) + '</p>' +
    (result.pairs.length ? deltaChart(result.pairs, rule.metric, { key: 'claim-pair', selected: 0, mean: row.improvement == null ? null : deltaDisplay(row.improvement, rule.metric), threshold: rule.threshold }) + statsPanel(pairStats(result.pairs, rule.metric), rule.metric) : '') +
    (result.pairs.length ? '<label class="field claim-pair-picker"><span>查看配对</span><select id="claim-pair-choice">' + result.pairs.map((pair,index) => option(index,'seed ' + pair.base.seed + ' · ' + pair.base.split,index === 0)).join('') + '</select></label><div id="claim-pair-detail">' + pairDetails(result.pairs[0],rule.metric) + '</div>' : '') +
    (unpaired.length ? '<details class="claim-unpaired"' + (!result.pairs.length ? ' open' : '') + '><summary>查看 ' + unpaired.length + ' 条未配对运行</summary>' + list(unpaired.slice(0,20),run => '<li><div><span class="list-title">' + html(run.method + ' · seed ' + run.seed) + '</span><code>' + html(run.split) + '</code><br><span class="meta">配置 ' + html(run.config || '未记录') + ' · 来源 ' + html(run.source || '未记录') + (run.row ? ':' + run.row : '') + '</span></div></li>','') +
      (unpaired.length > 20 ? '<p class="meta">显示前 20 条。</p>' : '') + '</details>' : '');
}

const views = {home:homeView,papers:papersView,hypotheses:hypothesesView,runs:runsView,evidence:evidenceView,claims:claimsView,trace:traceView,drafts:draftsView,notes:notesView};
