'use strict';
// Browser-side file parsing. PDF text extraction uses pdf.js (Apache-2.0);
// results are persisted through the existing server-validated state save,
// so both demo and account modes work without a new backend endpoint.

const PDF_PARSE_LIMIT = 20 * 1024 * 1024;
const TEXT_PARSE_LIMIT = 1 * 1024 * 1024;
const NOTE_TEXT_CAP = 20000;

if (globalThis.pdfjsLib) {
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
}

function pdfItemsToText(items) {
  const sorted = items.filter(item => item.str).sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
  const lines = [];
  let line = '';
  let lastY = null;
  for (const item of sorted) {
    const y = Math.round(item.transform[5]);
    if (lastY === null || Math.abs(y - lastY) <= 2) {
      line += (line && !/\s$/.test(line) && !/^\s/.test(item.str) ? ' ' : '') + item.str;
    } else {
      if (line.trim()) lines.push(line.trim());
      line = item.str;
    }
    lastY = y;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
}

async function parsePdfFile(file, onProgress) {
  if (!globalThis.pdfjsLib) throw new Error('PDF 解析组件未加载，请刷新页面重试。');
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await globalThis.pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const pageCount = doc.numPages;
  const pages = [];
  try {
    for (let number = 1; number <= pageCount; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      pages.push({ page: number, text: pdfItemsToText(content.items) });
      page.cleanup();
      onProgress?.(number, pageCount);
    }
  } finally {
    await doc.destroy();
  }
  if (!pages.some(page => page.text.trim())) throw new Error('这份 PDF 没有可提取的文本层（可能是扫描件）。暂不支持 OCR，请改用带文本层的 PDF。');
  return { kind: 'pdf', filename: file.name, pageCount, pages, meta: extractPdfMeta(pages, file.name) };
}

function extractPdfMeta(pages, filename) {
  const lineIndex = [];
  for (const page of pages) for (const text of page.text.split('\n')) lineIndex.push({ text: text.trim(), page: page.page });
  const firstPage = lineIndex.filter(line => line.page === 1 && line.text);
  const stopAuthor = /abstract|摘要|arxiv:|预印本|@|university|department|institute|laboratory|^\d{4}\b/i;
  let title = '';
  let cursor = 0;
  while (cursor < firstPage.length && cursor < 4) {
    const line = firstPage[cursor].text;
    if (/^arxiv:/i.test(line)) { cursor += 1; continue; }
    if (stopAuthor.test(line) && title) break;
    title += (title ? ' ' : '') + line;
    cursor += 1;
    if (title.length > 20) break;
  }
  title = title.trim().slice(0, 300) || filename.replace(/\.pdf$/i, '');
  const authors = [];
  for (let i = cursor; i < firstPage.length && authors.join(' ').length < 300; i += 1) {
    const line = firstPage[i].text;
    if (stopAuthor.test(line)) break;
    if (line.length > 2 && !/^\d+$/.test(line)) authors.push(line);
  }
  const headText = firstPage.map(line => line.text).join('\n');
  const years = headText.match(/(?:19|20)\d{2}(?![.\d])/g);
  const year = years ? years[years.length - 1] : '';
  const doiMatch = lineIndex.map(line => line.text).join('\n').match(/10\.\d{4,9}\/[^\s"'<>]+/);
  const abstractStart = lineIndex.findIndex(line => /^(abstract|摘要)\b/i.test(line.text));
  let abstract = '';
  let abstractPage = null;
  if (abstractStart >= 0) {
    abstractPage = lineIndex[abstractStart].page;
    const collected = [];
    for (let i = abstractStart + 1; i < lineIndex.length && collected.join(' ').length < 2000; i += 1) {
      const line = lineIndex[i];
      if (/^(keywords|key words|1\s*\.?\s*introduction|i\.\s*introduction|引言|索引词)\b/i.test(line.text)) break;
      if (line.text) collected.push(line.text);
    }
    abstract = collected.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  }
  const refStart = lineIndex.findIndex(line => /^(references|参考文献|bibliography)\s*$/i.test(line.text));
  const refs = [];
  if (refStart >= 0) {
    let current = null;
    for (let i = refStart + 1; i < lineIndex.length && refs.length < 200; i += 1) {
      const line = lineIndex[i];
      if (!line.text) continue;
      const isNew = /^\[\d+\]/.test(line.text) || /^\d+\.\s/.test(line.text) || /^[A-Z][\w'’-]+,\s/.test(line.text) || /^[A-Z]\.\s/.test(line.text);
      if (isNew) {
        if (current) refs.push(current);
        current = { text: line.text.slice(0, 300), page: line.page };
      } else if (current && current.text.length < 300) {
        current.text += ' ' + line.text;
      }
    }
    if (current) refs.push(current);
  }
  const firstAuthor = (authors[0] || '').split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z]/g, '') || 'paper';
  const firstWord = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).find(Boolean) || 'ref';
  const key = (firstAuthor + (year || '') + firstWord).slice(0, 60);
  return { title, authors: authors.join(' ').replace(/\s+/g, ' ').slice(0, 300), year, doi: doiMatch ? doiMatch[0].replace(/[.,;]$/, '') : '', key, abstract, abstractPage, refs };
}

async function parseTextFile(file) {
  const text = await file.text();
  if (!text.trim()) throw new Error('文件内容为空。');
  return { kind: 'text', filename: file.name, text, chars: text.length, lines: text.split(/\r\n|\r|\n/).length };
}

function parsePreviewView(result) {
  if (result.kind === 'pdf') {
    const meta = result.meta;
    const field = (name, label, value, wide) => '<label class="field' + (wide ? ' wide' : '') + '"><span>' + html(label) + '</span><input name="' + name + '" value="' + html(value) + '"></label>';
    const refs = meta.refs.length
      ? '<ol class="parse-refs">' + meta.refs.map(ref => '<li><span class="parse-page">第 ' + ref.page + ' 页</span>' + html(ref.text) + '</li>').join('') + '</ol>'
      : '<p class="meta">未识别到参考文献段落，可入库后手动补充。</p>';
    const pageText = result.pages.slice(0, 5).map(page =>
      '<details class="parse-page-block"><summary>第 ' + page.page + ' 页文本</summary><pre>' + html(page.text.slice(0, 4000)) + '</pre></details>').join('');
    return '<div class="parse-grid">' +
      field('parse-title', '题名', meta.title, true) +
      field('parse-key', '引用键', meta.key) +
      field('parse-year', '年份', meta.year) +
      field('parse-authors', '作者', meta.authors, true) +
      field('parse-doi', 'DOI', meta.doi, true) +
      '</div>' +
      '<p class="meta">共 ' + result.pageCount + ' 页 · 文本提取在浏览器完成，页码即原文锚点。以下字段为启发式识别，请核对后入库。</p>' +
      (meta.abstract ? '<section class="parse-section"><h3>摘要' + (meta.abstractPage ? ' · 第 ' + meta.abstractPage + ' 页' : '') + '</h3><p class="parse-abstract">' + html(meta.abstract) + '</p></section>' : '') +
      '<section class="parse-section"><h3>参考文献（' + meta.refs.length + ' 条）</h3>' + refs + '</section>' +
      '<section class="parse-section"><h3>逐页文本</h3>' + pageText + (result.pageCount > 5 ? '<p class="meta">仅预览前 5 页，其余页码已记录。</p>' : '') + '</section>';
  }
  const preview = result.text.slice(0, 6000);
  return '<p class="meta">' + result.lines + ' 行 · ' + result.chars + ' 字符。确认后将作为一条科研日志保存（最多 ' + NOTE_TEXT_CAP + ' 字符）。</p>' +
    '<label class="field wide"><span>日志类型</span><select name="parse-note-kind"><option>讨论纪要</option><option>实验记录</option><option>问题记录</option><option>研究决策</option></select></label>' +
    '<pre class="parse-text">' + html(preview) + (result.chars > preview.length ? '\n…（预览截断，保存时保留全文至上限）' : '') + '</pre>';
}