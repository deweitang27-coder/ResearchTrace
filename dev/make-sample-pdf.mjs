// Generates a small two-page PDF with a real text layer for local parse tests.
import { writeFileSync } from 'node:fs';

function esc(text) { return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function stream(lines) {
  const body = 'BT /F1 11 Tf 14 TL 50 780 Td\n' + lines.map(line => '(' + esc(line) + ') Tj T*').join('\n') + '\nET';
  return '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream';
}
const page1 = stream([
  'MiniRocket: A Very Fast Transform for Time Series Classification',
  '',
  'Angus Dempster and Daniel F. Schmidt and Geoffrey I. Webb',
  'arXiv:2012.08791v2 [cs.LG] 2020',
  '',
  'Abstract',
  'We present MiniRocket, a fast deterministic transform for time series',
  'classification. It achieves state-of-the-art accuracy with linear',
  'complexity and a small fixed set of convolutional kernels.',
  '',
  '1 Introduction',
  'Time series classification is a fundamental task in machine learning.',
]);
const page2 = stream([
  'References',
  '[1] Dempster A. ROCKET: Exceptionally fast and accurate time series',
  'classification using random convolutional kernels. 2019.',
  '[2] Dau H A. The UCR Time Series Archive. 2018.',
  '[3] Wang Z. Time series classification from scratch. 2017.',
]);
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
  page1,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
  page2,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((obj, index) => {
  offsets.push(pdf.length);
  pdf += (index + 1) + ' 0 obj\n' + obj + '\nendobj\n';
});
const xref = pdf.length;
pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
for (const offset of offsets) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
writeFileSync(new URL('./sample.pdf', import.meta.url), Buffer.from(pdf, 'latin1'));
console.log('sample.pdf written:', pdf.length, 'bytes');