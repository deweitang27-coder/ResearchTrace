const dialog = $('#editor');
const form = $('#editor-form');
const filePicker = $('#file-picker');
const quickDialog = $('#quick-search');
const quickQuery = $('#quick-query');
const quickResults = $('#quick-results');
const csvDialog = $('#csv-preview');
let quickMatches = [];
const themeKey = 'research-bench-theme';
const metricOptions = Object.entries(metricNames);
const fields = {
  project: [
    ['title','课题名称','text',true],['question','研究问题','area'],['goal','当前阶段目标','area']
  ],
  papers: [
    ['title','题名','text',true,true],['key','引用键','text',true],['year','年份','text'],['authors','作者（BibTeX 中用 and 分隔）','text',false,true],
    ['doi','DOI','text'],['status','阅读进度','select',true,paperStatuses],['method','主要方法 / 可复用设计','area'],['note','阅读笔记 / 局限','area']
  ],
  hypotheses: [
    ['title','假设名称','text',true,true],['claim','假设陈述','area',true],['metric','主指标','select',true,metricOptions],
    ['status','进度','select',true,hypothesisStatuses],['controls','控制条件','area'],['criterion','观察指标与判定标准','area']
  ],
  tasks: [
    ['title','待办事项','text',true,true],['date','目标日期','date'],['target','关联假设','target'],['status','状态','select',true,taskStatuses]
  ],
  datasets: [
    ['title','数据集名称','text',true],['split','测试集标识','text',true],['source','来源链接','url',false,true],['note','版本、划分和预处理说明','area']
  ],
  runs: [
    ['dataset','数据集','text',true],['method','方法','text',true],['seed','随机种子','text',true],['split','测试集标识（可填样本清单哈希）','text',true],
    ['metric','指标','select',true,metricOptions],['value','指标值（准确率和 F1 用 0–1）','number',true],['config','配置路径或摘要','text'],
    ['commit','Git 提交','text'],['target','关联假设','target'],['note','运行备注','area']
  ],
  evidence: [
    ['title','证据名称','text',true,true],['target','关联假设','target'],['note','适用范围和解释','area']
  ],
  notes: [
    ['title','日志标题','text',true,true],['date','记录日期','date',true],['kind','类型','select',true,['实验记录','问题记录','研究决策','讨论纪要']],
    ['target','关联假设','target'],['text','记录内容','area',true]
  ]
};
const labels = {project:'课题',papers:'文献',hypotheses:'假设',tasks:'待办',datasets:'数据集',runs:'运行',evidence:'证据',notes:'日志'};
let currentForm;
let fileAction;
let fileReadGeneration = 0;
let stagedCsv;
let csvTab = 'pending';
function editorField([key,label,type,required,spec], values, p) {
  const value = values[key] ?? '';
  const attrs = ' name="' + key + '"' + (required ? ' required' : '');
  let control;
  if (type === 'area') control = '<textarea' + attrs + '>' + html(value) + '</textarea>';
  else if (type === 'select' || type === 'target') {
    const choices = type === 'target' ? [['','暂不关联'], ...p.hypotheses.map(h => [h.id,h.title])] : spec;
    control = '<select' + attrs + '>' + choices.map(entry => {
      const [key,title] = Array.isArray(entry) ? entry : [entry,entry];
      return option(key,title,String(value) === String(key));
    }).join('') + '</select>';
  } else control = '<input type="' + type + '"' + attrs + ' value="' + html(value) + '"' + (type === 'number' ? ' step="any" min="0"' : '') + '>';
  return '<label class="field' + (type === 'area' || spec === true || key === 'target' ? ' wide' : '') + '"><span>' + html(label) + (required ? ' *' : '') + '</span>' + control + '</label>';
}
function openEditor(kind, itemId, creating = false) {
  const p = project();
  if (!Object.hasOwn(fields,kind)) return;
  const existing = kind === 'project' ? (creating ? null : p) : itemId ? p[kind].find(item => item.id === itemId) : null;
  const values = existing || (kind === 'notes' ? {date:dateNow()} : kind === 'evidence' ? {
    title: compare.dataset + ' · ' + compare.test + ' 对照', note: '按相同测试集标识和随机种子配对，结果用于描述已记录的运行。', target:hypothesisFilter
  } : {target:hypothesisFilter});
  const evidenceResult = kind === 'evidence' && !existing ? comparison(p.runs,compare) : null;
  if (evidenceResult && !evidenceResult.pairs.length) return;
  currentForm = {kind, existing, p, creating, evidenceResult, options:{...compare}};
  $('#editor-title').textContent = (existing ? '编辑' : '新建') + labels[kind];
  $('#editor-fields').innerHTML = fields[kind].map(field => editorField(field,values,p)).join('') +
    (kind === 'runs' && existing ? '<p class="wide meta">来源 ' + html(existing.source + (existing.row ? ' #' + existing.row : '')) + '</p>' : '');
  $('#form-error').textContent = '';
  dialog.showModal();
}
function fieldError(kind, data, p, existing) {
  for (const [key,label,,required] of fields[kind]) {
    if (required && !String(data[key] ?? '').trim()) return '请填写' + label + '。';
  }
  if (kind === 'papers') {
    if (!/^[a-zA-Z][a-zA-Z0-9_:\-]*$/.test(data.key)) return '引用键以英文字母开头，只用字母、数字、下划线、连字符或冒号。';
    if (data.year && !/^\d{4}$/.test(data.year)) return '年份请用 4 位数字。';
    if (data.doi && !validDOI(data.doi)) return '请填写 DOI 编号，例如 10.xxxx/xxxx。';
    if (p.papers.some(item => item !== existing && item.key === data.key)) return '这个引用键已经使用。';
  }
  if (kind === 'runs') {
    const error = runError(data);
    if (error) return error;
    if (p.runs.some(run => run !== existing && runKey(run) === runKey(data))) return '相同数据集、方法、种子、测试集和指标已有记录。';
  }
  if (kind === 'datasets' && data.source && !safeURL(data.source)) return '来源链接使用 HTTP 或 HTTPS。';
  return '';
}
function saveEditor(event) {
  event.preventDefault();
  const {kind,existing,p,creating,evidenceResult,options} = currentForm;
  const data = Object.fromEntries([...new FormData(form)].map(([key,value]) => [key,value.trim()]));
  const error = fieldError(kind,data,p,existing);
  if (error) { $('#form-error').textContent = error; return; }
  if (kind === 'project') {
    if (creating) {
      const created = freshProject(data.title,data.question,data.goal);
      state.projects.push(created);
      selectProject(created.id);
    } else Object.assign(p,data);
  } else {
    if (kind === 'runs') {
      data.value = Number(data.value);
      const dataChanged = existing && [...runRequired,...runOptional].some(key => data[key] !== existing[key]);
      if (!existing || dataChanged) Object.assign(data, {source: '手动登记',row:null});
    }
    if (kind === 'papers' && existing && existing.key !== data.key) {
      const old = new RegExp('@' + existing.key + '(?![A-Za-z0-9_:\\-])','g');
      for (const section of draftSections) p.drafts[section] = p.drafts[section].replace(old,'@' + data.key);
    }
    if (kind === 'evidence' && evidenceResult) Object.assign(data,{pairs:structuredClone(evidenceResult.pairs),
      mean:evidenceResult.mean,options,demo:evidenceResult.pairs.some(pair => [pair.base,pair.test].some(run => run.note === '内置演示数据'))});
    if (existing) Object.assign(existing,data);
    else p[kind].push({id:id(),...data});
  }
  dialog.close();
  save();
  render();
  notice(labels[kind] + '已保存。');
}
function selectProject(projectID) {
  state.active = projectID;
  page = 'home';
  compare = {};
  chosenPair = 0;
  overviewPair = 0;
  compareMode = 'plot';
  draftSection = '方法';
  draftMode = 'edit';
  searchPaper = '';
  searchRun = '';
  hypothesisFilter = '';
  claimDemo = false;
  demoClaimRule = claimDemoRule;
  claimDatasetIndex = 0;
  claimReport = null;
  claimBusy = false;
  runPage = 0;
}
function remove(kind, itemId) {
  const p = project();
  const data = p[kind];
  const item = data?.find(row => row.id === itemId);
  if (!item) return;
  if (!window.confirm('删除这条' + labels[kind] + '记录？')) return;
  data.splice(data.indexOf(item),1);
  if (kind === 'hypotheses') for (const key of ['runs','evidence','notes','tasks']) p[key].forEach(row => { if (row.target === itemId) row.target = ''; });
  save();
  render();
  notice('已删除。');
}
function download(filename, text, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text],{type:mime + ';charset=utf-8'}));
  const anchor = Object.assign(document.createElement('a'),{href:url,download:filename});
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function loadFile(kind) {
  fileReadGeneration += 1;
  fileAction = kind;
  filePicker.accept = kind === 'csv' ? '.csv,text/csv' : '.json,application/json';
  filePicker.value = '';
  filePicker.click();
}
function refreshCsvPreview() {
  const {fileName,project:destination,result,error} = stagedCsv;
  $('#csv-filename').textContent = fileName + ' · ' + destination.title;
  $('#csv-content').innerHTML = result ? csvPreviewView(result,csvTab) : '<p class="warn" role="alert">' + html(error) + '</p>';
  $('#csv-confirm').disabled = !result?.pending.length;
  $('#csv-message').textContent = result
    ? (result.pending.length ? '将导入 ' + result.pending.length + ' 条到当前课题，确认时由服务端重新校验并写入。'
      : '没有可导入的新记录：重复 ' + result.duplicates.length + ' 条、冲突 ' + result.conflicts.length + ' 条。重复提交同一份 CSV 不会新增记录。')
    : '请修改 CSV 后重新选择。';
}
function stageCsvImport(fileName,destination,text,error='') {
  const existing = destination.runs;
  let result;
  if (!error) {
    try { result = parseRuns(text,fileName,existing); }
    catch (failure) { error = failure.message; }
  }
  stagedCsv = {fileName,project:destination,existing,result,error,text};
  csvTab = result?.pending.length ? 'pending' : result?.conflicts.length ? 'conflicts' : 'duplicates';
  refreshCsvPreview();
  if (!csvDialog.open) csvDialog.showModal();
}
let csvBusy = false;
async function confirmCsvImport() {
  if (!csvDialog.open || csvBusy || !stagedCsv?.result?.pending.length) return;
  const {fileName,project:destination,existing,text} = stagedCsv;
  if (project() !== destination || destination.runs !== existing) {
    $('#csv-confirm').disabled = true;
    $('#csv-message').textContent = '课题或运行列表已经变化，请重新选择 CSV 核对。';
    return;
  }
  csvBusy = true;
  const confirmButton = $('#csv-confirm');
  confirmButton.disabled = true;
  confirmButton.textContent = '服务端写入中…';
  $('#csv-message').textContent = '服务端正在重新校验、去重并写入…';
  try {
    let report;
    if (demoMode) {
      report = await demoImportRemote(text,fileName,existing);
      destination.runs = existing.concat(report.runs);
      save();
    } else {
      if (!(await ensureSaved())) throw new RequestError('save_failed');
      report = await importCsvRemote(destination.id,text,fileName,serverVersion);
      destination.runs = report.runs;
      serverVersion = report.version;
      dirty = false;
      setSyncStatus('ready', '已保存到云端 · ' + timeNow());
    }
    csvDialog.close();
    stagedCsv = undefined;
    page = 'runs';
    searchRun = fileName;
    hypothesisFilter = '';
    runPage = 0;
    render();
    window.scrollTo(0,0);
    notice('已导入 ' + report.added + ' 条，跳过 ' + report.duplicates + ' 条重复和 ' + report.conflicts + ' 条冲突。');
  } catch (error) {
    $('#csv-message').textContent = (error.detail || syncErrorText(error)) + ' 未写入任何记录，可修改后重试。';
    confirmButton.disabled = false;
  } finally {
    csvBusy = false;
    confirmButton.textContent = '确认导入';
  }
}
function requireProjectFile(raw) {
  const p = raw?.project;
  if (raw?.version !== 1 || !p || typeof p.title !== 'string' || !p.title.trim() || typeof p.question !== 'string' || typeof p.goal !== 'string') throw new Error('请选择由有据导出的课题备份。');
  const copy = freshProject(p.title,p.question,p.goal);
  copy.demo = p.demo === true;
  for (const kind of Object.keys(fields).filter(key => key !== 'project')) {
    if (!Array.isArray(p[kind])) throw new Error('备份缺少' + labels[kind] + '记录。');
    const ids = new Set();
    for (const data of p[kind]) {
      if (!data || typeof data.id !== 'string' || ids.has(data.id)) throw new Error('备份内' + labels[kind] + '的记录 ID 无效。');
      ids.add(data.id);
      const item = {id:data.id};
      for (const [key,label,type,,spec] of fields[kind]) {
        if (type === 'number' ? typeof data[key] !== 'number' : typeof (data[key] ?? '') !== 'string') throw new Error('备份中的' + label + '格式不正确。');
        item[key] = data[key] ?? '';
        if (type === 'select' && !spec.some(option => (Array.isArray(option) ? option[0] : option) === item[key])) throw new Error('备份中的' + label + '选项无效。');
      }
      const failure = fieldError(kind,item,copy,null);
      if (failure) throw new Error('备份中的' + labels[kind] + '记录无效。' + failure);
      if (kind === 'runs') Object.assign(item,{source:String(data.source ?? ''),row:Number.isInteger(data.row) ? data.row : null});
      if (kind === 'evidence') {
        if (!data.options || !Array.isArray(data.pairs) || !data.pairs.length) throw new Error('备份中的证据没有运行记录。');
        const pairs = data.pairs.map(pair => {
          const base = pair?.base, test = pair?.test;
          if (!base || !test || runError(base) || runError(test) || base.split !== test.split || base.seed !== test.seed ||
              base.dataset !== test.dataset || base.metric !== test.metric || base.dataset !== data.options.dataset ||
              base.metric !== data.options.metric || base.method !== data.options.base || test.method !== data.options.test ||
              base.method === test.method) throw new Error('备份中的证据配对无效。');
          return {base,test,delta:Number(test.value)-Number(base.value)};
        });
        Object.assign(item,{pairs,options:data.options,mean:pairs.reduce((a,b) => a+b.delta,0)/pairs.length,demo:data.demo === true});
      }
      copy[kind].push(item);
    }
  }
  for (const section of draftSections) copy.drafts[section] = typeof p.drafts?.[section] === 'string' ? p.drafts[section] : '';
  if (p.claimRule != null) copy.claimRule = normalizeClaimRule(p.claimRule);
  return copy;
}
async function importFile() {
  const file = filePicker.files[0];
  if (!file) return;
  const p = project();
  const kind = fileAction;
  const readGeneration = fileReadGeneration;
  try {
    if (kind === 'csv' && file.size > CSV_FILE_LIMIT) throw new Error('CSV 超过 2 MB。云端工作区上限为 4 MB，请分批导入。');
    if (kind === 'backup' && file.size > BACKUP_FILE_LIMIT) throw new Error('备份超过 3 MB。云端工作区上限为 4 MB，请拆分课题。');
    const text = await file.text();
    if (readGeneration !== fileReadGeneration) return;
    if (kind === 'csv') {
      stageCsvImport(file.name,p,text);
    } else if (kind === 'backup') {
      let raw;
      try { raw = JSON.parse(text); } catch { throw new Error('备份文件不是有效的 JSON。'); }
      const imported = requireProjectFile(raw);
      state.projects.push(imported);
      selectProject(imported.id);
      save();
      render();
      notice('已作为新课题导入。');
    }
  } catch (error) {
    if (readGeneration !== fileReadGeneration) return;
    if (kind === 'csv') stageCsvImport(file.name,p,'',error.message);
    else notice(error.message);
  }
}
function draftExport(p) {
  const yamlTitle = JSON.stringify(p.title);
  const sections = draftSections.map(section => '## ' + section + '\n\n' + p.drafts[section].trim()).join('\n\n');
  return '---\ntitle: ' + yamlTitle + '\nbibliography: references.bib\n---\n\n' + sections + '\n';
}
function insertDraft(text) {
  const p = project();
  const input = $('#draft-input');
  if (!input) return;
  const start = input.hidden ? input.value.length : input.selectionStart;
  const end = input.hidden ? start : input.selectionEnd;
  input.setRangeText(text,start,end,'end');
  p.drafts[draftSection] = input.value;
  $('#draft-count').textContent = draftCount(input.value);
  save();
  if (input.hidden) $('#draft-preview').innerHTML = renderMarkdown(input.value);
  else input.focus();
}

function setDraftMode(mode) {
  draftMode = mode;
  const input = $('#draft-input');
  const preview = $('#draft-preview');
  input.hidden = mode === 'preview';
  preview.hidden = !input.hidden;
  if (input.hidden) preview.innerHTML = renderMarkdown(input.value);
  for (const button of root.querySelectorAll('[data-action="draft-mode"]')) button.setAttribute('aria-pressed',String(button.dataset.value === mode));
}

function setTheme(theme, remember=false) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const button = $('#theme-button');
  button.setAttribute('aria-pressed',String(isDark));
  button.lastElementChild.textContent = isDark ? '浅色' : '深色';
  if (remember) {
    try { localStorage.setItem(themeKey,theme); } catch { /* The current page can still switch modes. */ }
  }
}
function editRunDelete() {
  const {kind,existing} = currentForm;
  if (kind !== 'runs' || !existing) return;
  dialog.close();
  remove('runs',existing.id);
}

function updateQuickResults() {
  quickMatches = matchingItems(project(),quickQuery.value);
  quickResults.innerHTML = quickMatches.length ? quickMatches.map((item,index) =>
    '<button class="quick-result" type="button" data-action="quick-pick" data-value="' + index + '"><span class="quick-result-icon" aria-hidden="true">' + html(item.icon) + '</span><span>' + html(item.label) + '</span><small>' + html(item.kind) + '</small></button>'
  ).join('') : '<p class="empty" role="status">没有找到匹配项。</p>';
}

function openQuickSearch() {
  if (!state || quickDialog.open || dialog.open || csvDialog.open) return;
  quickQuery.value = '';
  updateQuickResults();
  quickDialog.showModal();
  quickQuery.focus();
}

function exportReproduction(p,evidenceId) {
  if (evidenceId) {
    const evidence = p.evidence.find(item => item.id === evidenceId);
    if (evidence) download('reproduction-snapshot.md',reproductionRecord(p,evidence),'text/markdown');
    return;
  }
  const result = comparison(p.runs,compare);
  if (!result.pairs.length) return;
  const evidence = {title:compare.dataset + ' · ' + compare.test + ' 对照',options:compare,pairs:result.pairs,mean:result.mean,
    demo:result.pairs.some(pair => [pair.base,pair.test].some(run => run.note === '内置演示数据'))};
  download('reproduction-current.md',reproductionRecord(p,evidence,result),'text/markdown');
}

function openEvidence(item,selectedPair) {
  if (!item) return;
  hypothesisFilter = '';
  compare = {...item.options};
  chosenPair = 0;
  if (selectedPair) {
    const pairs = comparison(project().runs,compare).pairs;
    chosenPair = Math.max(0,pairs.findIndex(pair => pair.base.seed === selectedPair.base.seed && pair.base.split === selectedPair.base.split));
  }
  page = 'evidence';
  render();
  window.scrollTo(0,0);
}

function markPairSelected(actionKey, selected) {
  for (const button of root.querySelectorAll('[data-action="' + actionKey + '"]')) {
    const isSelected = button === selected;
    button.setAttribute('aria-pressed',String(isSelected));
    button.closest('tr')?.classList.toggle('selected',isSelected);
  }
}

function chooseQuickResult(index) {
  const item = quickMatches[index];
  if (!item) return;
  quickDialog.close();
  if (item.kind === '证据') {
    openEvidence(project().evidence.find(evidence => evidence.id === item.key));
  } else {
    hypothesisFilter = '';
    if (item.kind === '文献') searchPaper = item.label;
    page = item.page;
    render();
    window.scrollTo(0,0);
  }
  $('#main').focus({preventScroll:true});
}

document.addEventListener('click',event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const {action:key,value} = button.dataset;
  if (key === 'retry-boot') { boot(); return; }
  if (key === 'retry-save') { flushSave(); return; }
  if (key === 'reload-cloud') { reloadCloud(); return; }
  if (key === 'goto-login') { location.href = '/__qoder_auth/start?return_path=' + encodeURIComponent('/'); return; }
  if (key === 'start-demo') { startDemo(); return; }
  if (key === 'confirm-migration') { confirmMigration(); return; }
  if (key === 'decline-migration') { declineMigration(); return; }
  const p = project();
  if (!p) return;
  const [kind,itemId] = (value || '').split(':',2);
  switch (key) {
    case 'page':
      hypothesisFilter = ''; page = value; render(); window.scrollTo(0,0); break;
    case 'open-evidence': {
      openEvidence(p.evidence.find(item => item.id === value)); break;
    }
    case 'open-overview-evidence': {
      const evidence = p.evidence.find(item => item.id === value);
      openEvidence(evidence,evidence?.pairs[overviewPair]); break;
    }
    case 'open-search': openQuickSearch(); break;
    case 'close-search': quickDialog.close(); break;
    case 'quick-pick': chooseQuickResult(Number(value)); break;
    case 'claim-demo':
      claimDemo = value === 'on'; demoClaimRule = claimDemoRule; claimDatasetIndex = 0; claimReport = null; render(); break;
    case 'claim-demo-csv': download('claim-demo.csv',claimDemoCsv,'text/csv'); break;
    case 'claim-select': {
      if (!claimReport) break;
      claimDatasetIndex = Number(value);
      markPairSelected('claim-select',button);
      $('#claim-detail').innerHTML = claimDetail(claimReport.rows[claimDatasetIndex],claimReport.rule);
      break;
    }
    case 'toggle-theme': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',true); break;
    case 'linked':
      hypothesisFilter = itemId; searchRun = ''; runPage = 0; page = kind; render(); break;
    case 'clear-hypothesis':
      hypothesisFilter = ''; render(); break;
    case 'new-project': openEditor('project','',true); break;
    case 'edit':
      openEditor(kind,itemId);
      if (kind === 'runs' && itemId) $('#editor-fields').insertAdjacentHTML('beforeend',action('删除这条运行','delete-run-in-editor','','text danger'));
      break;
    case 'new': openEditor(kind); break;
    case 'delete': remove(kind,itemId); break;
    case 'delete-run-in-editor': editRunDelete(); break;
    case 'close-dialog': dialog.close(); break;
    case 'complete': {
      const task = p.tasks.find(item => item.id === value);
      if (!task) break;
      task.status = task.status === '已完成' ? '待完成' : '已完成';
      save(); render(); break;
    }
    case 'run-page':
      runPage += Number(value); $('#run-results').innerHTML = runTable(p); break;
    case 'pair': {
      chosenPair = Number(value);
      markPairSelected('pair',button);
      $('#pair-details').innerHTML = pairDetails(comparison(p.runs,compare).pairs[chosenPair],compare.metric);
      break;
    }
    case 'overview-pair': {
      overviewPair = Number(value);
      const evidence = p.evidence.at(-1);
      markPairSelected('overview-pair',button);
      $('#overview-pair-preview').innerHTML = overviewPairPreview(evidence.pairs[overviewPair],evidence.options.metric);
      break;
    }
    case 'compare-mode':
      compareMode = value; render(); root.querySelector('[data-action="compare-mode"][aria-pressed="true"]')?.focus(); break;
    case 'draft-mode': setDraftMode(value); break;
    case 'draft-section': {
      draftSection = value; render();
      if (draftMode === 'edit') $('#draft-input').focus();
      else root.querySelector('[data-action="draft-section"][aria-pressed="true"]')?.focus();
      break;
    }
    case 'insert-citation': {
      const paper = p.papers.find(item => item.id === value);
      if (paper) insertDraft(' [@' + paper.key + ']');
      break;
    }
    case 'insert-evidence': {
      const evidence = p.evidence.find(item => item.id === value);
      if (!evidence) break;
      if (page === 'evidence') {
        p.drafts['实验结果'] = p.drafts['实验结果'].trimEnd() + '\n\n' + markdownEvidence(evidence) + '\n';
        draftSection = '实验结果';
        page = 'drafts'; save(); render();
      } else insertDraft('\n\n' + markdownEvidence(evidence) + '\n');
      notice('已插入草稿。');
      break;
    }
    case 'export-bib': download('references.bib',bibtex(p.papers)); break;
    case 'export-draft': download('manuscript.md',draftExport(p),'text/markdown'); break;
    case 'export-reproduction': exportReproduction(p,value); break;
    case 'backup-project': download('research-project.json',JSON.stringify({version:1,project:p},null,2),'application/json'); break;
    case 'restore-project': loadFile('backup'); break;
    case 'import-csv': loadFile('csv'); break;
    case 'close-csv': csvDialog.close(); break;
    case 'confirm-csv': confirmCsvImport(); break;
    case 'csv-tab': {
      if (!stagedCsv?.result) break;
      csvTab = value;
      refreshCsvPreview();
      csvDialog.querySelector('[data-action="csv-tab"][aria-pressed="true"]')?.focus();
      break;
    }
    case 'csv-template':
      download('run-template.csv','dataset,method,seed,split,metric,value,config,commit,note\nExample,baseline,0,TEST-v1,accuracy,0.90,baseline.yaml,,\nExample,treatment,0,TEST-v1,accuracy,0.92,experiment.yaml,,\n','text/csv'); break;
  }
});
document.addEventListener('change',event => {
  if (!state) return;
  if (event.target.id === 'claim-pair-choice') {
    if (!claimReport) return;
    const row = claimReport.rows[claimDatasetIndex];
    $('#claim-pair-detail').innerHTML = pairDetails(row.result.pairs[Number(event.target.value)],claimReport.rule.metric);
  }
  if (event.target.id === 'project-choice') {
    selectProject(event.target.value); save(); render();
  }
  const key = event.target.dataset.compare;
  if (key) {
    compare[key] = event.target.value; chosenPair = 0; render();
    root.querySelector('[data-compare="' + key + '"]')?.focus();
  }
});
document.addEventListener('input',event => {
  if (!state) return;
  const {id,value} = event.target;
  if (id === 'paper-search') { searchPaper = value; $('#paper-results').innerHTML = papersList(project()); }
  if (id === 'run-search') { searchRun = value; runPage = 0; $('#run-results').innerHTML = runTable(project()); }
  if (id === 'draft-input') { project().drafts[draftSection] = value; $('#draft-count').textContent = draftCount(value); save(); }
  if (event.target.form?.id === 'claim-form') {
    if (event.target.name === 'metric') $('#claim-unit').textContent = '（' + claimThresholdUnit(value) + '）';
    $('#claim-form-message').textContent = '条件已编辑，点击「核对结论」更新结果。';
  }
});
document.addEventListener('submit',async event => {
  if (event.target.id !== 'claim-form' || !state || claimBusy) return;
  event.preventDefault();
  const formData = new FormData(event.target);
  let rule;
  try {
    rule = normalizeClaimRule({statement:formData.get('statement'),datasets:formData.getAll('dataset'),base:formData.get('base'),test:formData.get('test'),metric:formData.get('metric'),threshold:Number(formData.get('threshold')),minPairs:Number(formData.get('minPairs'))});
  } catch (error) { $('#claim-form-message').textContent = error.message; return; }
  claimBusy = true;
  renderClaimPanel();
  $('#claim-form-message').textContent = '服务端核对中…';
  try {
    let report;
    if (claimDemo) report = await demoVerifyRemote(claimDemoRuns,rule);
    else if (demoMode) report = await demoVerifyRemote(project().runs,rule);
    else {
      if (!(await ensureSaved())) throw new RequestError('save_failed');
      report = await verifyClaimRemote(project().id,rule);
    }
    claimReport = report;
    claimDatasetIndex = 0;
    claimBusy = false;
    if (claimDemo) demoClaimRule = rule;
    else { project().claimRule = rule; save(); }
    render();
    $('#claim-form-message').textContent = '服务端核对完成。';
    $('#claim-form button[type="submit"]')?.focus({preventScroll:true});
  } catch (error) {
    claimBusy = false;
    renderClaimPanel();
    $('#claim-form-message').textContent = error.detail || syncErrorText(error);
  }
});
quickQuery.addEventListener('input',updateQuickResults);
quickQuery.addEventListener('keydown',event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    chooseQuickResult(0);
  } else if (event.key === 'ArrowDown') {
    const first = quickResults.querySelector('button');
    if (first) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('keydown',event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !dialog.open && !csvDialog.open) {
    event.preventDefault();
    openQuickSearch();
  }
  const actionKey = event.target.dataset?.action;
  if (!['pair','overview-pair','claim-select'].includes(actionKey) || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
  const items = [...root.querySelectorAll('[data-action="' + actionKey + '"]')];
  const current = items.indexOf(event.target);
  const next = {ArrowUp:current-1,ArrowDown:current+1,Home:0,End:items.length-1}[event.key];
  if (items[next]) {
    event.preventDefault();
    items[next].focus();
    items[next].click();
  }
});
if (/mac|iphone|ipad/i.test(navigator.platform)) $('#search-shortcut').textContent = '⌘ K';
form.addEventListener('submit',saveEditor);
filePicker.addEventListener('change',importFile);
csvDialog.addEventListener('close',() => { if (!csvDialog.open) stagedCsv = undefined; });
try { setTheme(localStorage.getItem(themeKey)); } catch { setTheme('light'); }
boot();
