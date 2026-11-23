// Importação de conjuntos de chamados para o Conjunto gerencial.
// Formatos: CSV, Excel (.xlsx), PDF (tabelas com texto) e JSON. Tudo é processado no navegador;
// nada é enviado nem salvo.

import { evaluateQuality } from './quality-engine.js';

export const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = s => fold(s).replace(/\b(de|da|do|dos|das|em)\b/g, ' ').replace(/[^a-z0-9]/g, '');

/* ---------------- CSV ---------------- */

export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = [';', ',', '\t'].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

/* ---------------- Excel (.xlsx) sem bibliotecas ---------------- */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir arquivos Excel. Atualize o navegador ou salve a planilha como CSV.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer, wanted) {
  const b = new Uint8Array(buffer), v = new DataView(buffer);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('O arquivo não é uma planilha .xlsx válida. Se for .xls antigo, salve como .xlsx ou CSV.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = {}, dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = b.subarray(start, start + size);
    out[name] = dec.decode(method === 0 ? data : await inflateRaw(data));
  }
  return out;
}

const xmlText = s => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const colIndex = ref => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export async function parseXlsx(buffer) {
  const files = await unzip(buffer, n => /^xl\/(sharedStrings|workbook)\.xml$|^xl\/_rels\/workbook\.xml\.rels$|^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = [...(files['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '')));
  let sheetPath = '';
  const rid = (files['xl/workbook.xml'] || '').match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  if (rid) {
    const target = (files['xl/_rels/workbook.xml.rels'] || '').match(new RegExp('Id="' + rid + '"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="' + rid + '"'));
    const t = target?.[1] || target?.[2];
    if (t) sheetPath = 'xl/' + t.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  if (!files[sheetPath]) sheetPath = Object.keys(files).filter(n => n.startsWith('xl/worksheets/')).sort()[0];
  if (!sheetPath) throw new Error('Nenhuma planilha encontrada no arquivo.');
  const rows = [];
  for (const r of files[sheetPath].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] || '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's') value = shared[+raw] ?? '';
      else if (type === 'inlineStr') value = xmlText(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '');
      else if (raw !== undefined) value = xmlText(raw);
      row[ref ? colIndex(ref) : row.length] = value;
    }
    const filled = Array.from(row, x => x ?? '');
    if (filled.some(x => String(x).trim())) rows.push(filled);
  }
  return rows;
}

/* ---------------- PDF (texto de tabelas) ---------------- */

let pdfjsPromise;
async function loadPdfJs() {
  pdfjsPromise ||= import('../assets/vendor/pdfjs/pdf.min.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../assets/vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return lib;
  });
  return pdfjsPromise;
}

// Agrupa os textos de cada página em linhas (mesma altura) e células (espaço horizontal).
export function itemsToRows(items) {
  const lines = [];
  for (const it of items) {
    const str = String(it.str || '').trim();
    if (!str) continue;
    const x = it.x, y = it.y, w = it.w || str.length * 4;
    let line = lines.find(l => Math.abs(l.y - y) <= 3);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, end: x + w, str });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map(l => {
    l.parts.sort((a, b) => a.x - b.x);
    const cells = [];
    for (const p of l.parts) {
      const last = cells[cells.length - 1];
      if (last && p.x - last.end < 6) { last.str += ' ' + p.str; last.end = p.end; } else cells.push({ ...p });
    }
    return cells;
  });
}

// Usa a posição horizontal do cabeçalho para encaixar cada célula na coluna certa.
export function alignPdfRows(lines) {
  const headerIdx = lines.findIndex(cells => cells.filter(c => matchField(c.str)).length >= 2);
  if (headerIdx < 0) throw new Error('Não encontrei uma tabela com cabeçalho (ex.: Chamado, Estado, Categoria) no PDF.');
  const header = lines[headerIdx];
  const out = [header.map(c => c.str)];
  for (const cells of lines.slice(headerIdx + 1)) {
    const headerTexts = new Set(header.map(h => key(h.str)));
    if (cells.filter(c => headerTexts.has(key(c.str))).length >= 2) continue; // cabeçalho repetido em outra página
    const row = new Array(header.length).fill('');
    for (const c of cells) {
      let best = 0, dist = Infinity;
      header.forEach((h, i) => { const d = Math.abs(h.x - c.x); if (d < dist) { dist = d; best = i; } });
      row[best] = row[best] ? row[best] + ' ' + c.str : c.str;
    }
    out.push(row);
  }
  return out;
}

export async function parsePdf(buffer) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const lines = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
    lines.push(...itemsToRows(items));
  }
  if (!lines.length) throw new Error('O PDF não tem texto selecionável (pode ser uma imagem escaneada). Exporte do sistema em CSV ou Excel.');
  return alignPdfRows(lines);
}

/* ---------------- Mapeamento de colunas ---------------- */

// A ordem importa: datas e tempos antes de campos de texto (ex.: "Data de solução" é data, não solução).
const FIELDS = [
  ['number', ['chamado', 'numero', 'ticket', 'requisicao', 'protocolo', 'codigo', 'id', 'n', 'no']],
  ['status', ['estado', 'status', 'situacao']],
  ['channel', ['tiporegistro', 'canal', 'origem', 'meioabertura']],
  ['ticketType', ['tipochamado', 'tiposolicitacao', 'natureza']],
  ['dueAt', ['dataatendimentoprevista', 'atendimentoprevisto', 'atendimentoprevista', 'prevista', 'prazo', 'vencimento']],
  ['attendedAt', ['datarealatendimento', 'realatendimento', 'dataatendimento', 'atendidoem']],
  ['openedAt', ['dataregistro', 'dataabertura', 'datasolicitacao', 'abertura', 'aberto', 'criado', 'datacriacao', 'criacao', 'registro']],
  ['closedAt', ['datafechamento', 'dataencerramento', 'encerramento', 'encerrado', 'fechamento', 'datasolucao', 'resolvido', 'conclusao']],
  ['progress', ['progresso']],
  ['duration', ['tempo', 'temposolucao', 'duracao', 'horas', 'tempogasto']],
  ['sla', ['sla', 'acordo', 'nivelservico']],
  ['impact', ['impacto']],
  ['priority', ['prioridade', 'urgencia']],
  ['category', ['categoria', 'servico', 'classificacao']],
  ['subject', ['assunto', 'titulo', 'resumo']],
  ['requester', ['solicitante', 'requerente', 'usuario', 'cliente']],
  ['tech', ['tecnico', 'responsavel', 'atendente', 'analista', 'executor']],
  ['building', ['predio', 'unidade', 'localidade', 'comarca', 'local']],
  ['sector', ['setor', 'departamento', 'lotacao']],
  ['room', ['sala']],
  ['description', ['descricao', 'solicitacao', 'detalhes', 'problema']],
  ['comments', ['comentarios', 'comentario', 'atualizacoes', 'historico', 'notas']],
  ['cause', ['causa']],
  ['test', ['teste', 'validacao', 'confirmacao']],
  ['notes', ['pendencias', 'pendencia', 'observacoes', 'observacao']],
  ['action', ['solucao', 'resolucao', 'acao', 'procedimento']]
];

export function matchField(header) {
  const h = key(header);
  if (!h) return null;
  for (const [field, aliases] of FIELDS) if (aliases.includes(h)) return field;
  for (const [field, aliases] of FIELDS) if (aliases.some(a => a.length >= 4 && h.includes(a))) return field;
  return null;
}

const excelDate = v => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return v;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString();
};
// Datas "M/D/AAAA h:mm:ss AM/PM" (exportação em inglês, como a do Aranda) ou "DD/MM/AAAA HH:MM".
export function parseDateText(v) {
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/);
  if (!m) return v;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  let h = +(m[4] || 0);
  const ampm = m[7]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const us = !!ampm || +m[2] > 12;
  const month = us ? +m[1] : +m[2], day = us ? +m[2] : +m[1];
  return new Date(y, month - 1, day, h, +(m[5] || 0), +(m[6] || 0)).toISOString();
}
const brDate = parseDateText;

// "0d:0h:4min", "1h 30min", "1:30" ou número → minutos
export function parseDuration(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(?:(\d+)\s*d)?[:\s]*(?:(\d+)\s*h)?[:\s]*(?:(\d+)\s*min)?$/);
  if (m && (m[1] || m[2] || m[3])) return (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  const hm = s.match(/^(\d+):(\d{2})$/);
  if (hm) return +hm[1] * 60 + +hm[2];
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Converte linhas (primeira = cabeçalho) em registros com os nomes de campo da Régua. */
export function rowsToRecords(rows) {
  if (!rows.length) return { records: [], mapping: [], ignored: [] };
  const header = rows[0].map(h => String(h ?? '').trim());
  const used = new Set(), mapping = [], ignored = [];
  const fields = header.map(h => {
    const f = matchField(h);
    if (f && !used.has(f)) { used.add(f); mapping.push({ column: h, field: f }); return f; }
    if (h) ignored.push(h);
    return null;
  });
  const records = [];
  for (const row of rows.slice(1)) {
    const rec = {};
    fields.forEach((f, i) => { if (f) rec[f] = String(row[i] ?? '').trim(); });
    if (!Object.values(rec).some(Boolean)) continue;
    for (const d of ['openedAt', 'closedAt', 'dueAt', 'attendedAt']) if (rec[d]) rec[d] = brDate(excelDate(rec[d]));
    records.push(rec);
  }
  return { records, mapping, ignored };
}

/** Lê um arquivo (File/Blob com nome) e devolve { records, mapping, ignored, format }. */
export async function readTicketFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Arquivo maior que 30 MB.');
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.json')) {
    const parsed = JSON.parse(await file.text());
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : null;
    if (!records || records.some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('O JSON precisa ser uma lista de chamados (ou ter o campo "data").');
    return { records, mapping: [], ignored: [], format: 'JSON' };
  }
  let rows, format;
  if (name.endsWith('.csv') || name.endsWith('.txt')) { rows = parseCsv(await file.text()); format = 'CSV'; }
  else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) { rows = await parseXlsx(await file.arrayBuffer()); format = 'Excel'; }
  else if (name.endsWith('.xls')) throw new Error('Formato .xls antigo não é suportado. No Excel, use "Salvar como" .xlsx ou CSV.');
  else if (name.endsWith('.pdf')) { rows = await parsePdf(await file.arrayBuffer()); format = 'PDF'; }
  else throw new Error('Formato não reconhecido. Use CSV, Excel (.xlsx), PDF ou JSON.');
  const out = rowsToRecords(rows);
  if (!out.mapping.length) throw new Error('Não reconheci nenhuma coluna. A primeira linha deve ter títulos como Chamado, Estado, Categoria, Solicitante.');
  return { ...out, format };
}

/* ---------------- Indicadores ---------------- */

const CLOSED = /(closed|fechad|encerrad|resolvid|conclu|finaliz|cancel|solucionad)/i;
const median = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const round = (n, d = 1) => n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d;
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const TEXT_FIELDS = ['description', 'comments', 'action', 'cause', 'test'];

export function summarizeTickets(records, { progressLabel = 'Progresso' } = {}) {
  const total = records.length;
  const hasStatus = records.some(r => r.status);
  const closed = records.filter(r => hasStatus ? CLOSED.test(r.status || '') : !!r.closedAt).length;
  const progress = records.map(r => num(r.progress)).filter(n => n !== null);
  const p90 = pct(progress, 0.9);
  const byCat = {};
  for (const r of records) {
    const c = r.category || r.subject || 'Não informado';
    (byCat[c] ||= { name: c, count: 0, progress: [] }).count++;
    const n = num(r.progress); if (n !== null) byCat[c].progress.push(n);
  }
  const categories = Object.values(byCat).sort((a, b) => b.count - a.count).map(c => ({ name: c.name, count: c.count, share: total ? c.count / total : 0, median: round(median(c.progress)), mean: c.progress.length ? round(c.progress.reduce((a, b) => a + b, 0) / c.progress.length) : null }));
  const req = {};
  for (const r of records) if (r.requester) { const k = fold(r.requester).trim(); req[k] = (req[k] || 0) + 1; }
  const reqCounts = Object.values(req);
  const recurring = reqCounts.filter(n => n >= 2);
  const withText = records.filter(r => TEXT_FIELDS.some(f => String(r[f] || '').trim()));
  const scores = withText.map(r => evaluateQuality(r).score).filter(s => typeof s === 'number');
  const date = v => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
  const minutes = records.map(r => parseDuration(r.duration)).filter(n => n !== null);
  const sla = records.filter(r => date(r.dueAt) && date(r.attendedAt));
  const onTime = sla.filter(r => date(r.attendedAt) <= date(r.dueAt)).length;
  const days = (a, b) => (b - a) / 86400000;
  const toAttend = records.map(r => date(r.openedAt) && date(r.attendedAt) ? days(date(r.openedAt), date(r.attendedAt)) : null).filter(n => n !== null && n >= 0);
  const toClose = records.map(r => date(r.attendedAt) && date(r.closedAt) ? days(date(r.attendedAt), date(r.closedAt)) : null).filter(n => n !== null && n >= 0);
  const countBy = (f, list = records) => { const o = {}; for (const r of list) { const v = String(r[f] || '').trim(); if (v) o[v] = (o[v] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const batch = countBy('_d', sla.map(r => ({ _d: date(r.attendedAt).toLocaleDateString('pt-BR') })))[0];
  const subjects = countBy('_s', records.filter(r => r.subject).map(r => ({ _s: fold(r.subject).replace(/\s+/g, ' ').trim() })));
  const generic = records.filter(r => /criado via chatbot|^\s*(suporte|chamado|solicitacao)\s*$/i.test(fold(r.subject || ''))).length;
  const spread = [];
  for (const [label, re] of [['impressora', /impress/], ['computador', /computador|\bpc\b/], ['sistemas', /projudi|\bsei\b|e-?mail|malote|serp|sistema|login|scriba/]]) {
    const hit = records.filter(r => r.category && re.test(fold(r.subject || '')));
    const cats = new Set(hit.map(r => r.category));
    if (hit.length >= 3 && cats.size >= 2) spread.push({ label, count: hit.length, categories: cats.size });
  }
  return {
    total, closed, open: total - closed, hasStatus,
    duration: minutes.length ? { count: minutes.length, mean: round(minutes.reduce((a, b) => a + b, 0) / minutes.length), median: round(median(minutes)), p90: round(pct(minutes, 0.9)), max: Math.max(...minutes), total: minutes.reduce((a, b) => a + b, 0) } : null,
    sla: sla.length ? { evaluated: sla.length, onTime, late: sla.length - onTime } : null,
    daysToAttend: toAttend.length ? { median: round(median(toAttend)), max: round(Math.max(...toAttend)) } : null,
    daysToClose: toClose.length ? { median: round(median(toClose)), min: round(Math.min(...toClose)), max: round(Math.max(...toClose)) } : null,
    attendedBatch: batch && sla.length ? { day: batch[0], count: batch[1], share: batch[1] / sla.length } : null,
    channels: countBy('channel'), slaLevels: countBy('sla'), priorities: countBy('priority'),
    subjects: subjects.length ? { distinct: subjects.length, generic } : null,
    categorySpread: spread,
    progress: progress.length ? { label: progressLabel, count: progress.length, mean: round(progress.reduce((a, b) => a + b, 0) / progress.length), median: round(median(progress)), p90: round(p90), max: round(Math.max(...progress)), outliers: progress.filter(n => n > p90).length } : null,
    categories,
    requesters: reqCounts.length ? { distinct: reqCounts.length, recurring: recurring.length, recurringTickets: recurring.reduce((a, b) => a + b, 0), top: Math.max(...reqCounts) } : null,
    quality: scores.length ? { evaluated: scores.length, average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), below80: scores.filter(s => s < 80).length } : null
  };
}

/* ---------------- Métricas por chamado ---------------- */

export const MIN_CRITERIA_FOR_SCORE = 3;

// Colunas do arquivo que alimentam cada critério da pré-auditoria.
const CRITERIA_SOURCES = {
  location: ['building', 'location', 'sector', 'room'], subject: ['subject'], symptom: ['description'],
  asset: ['assetType', 'asset'], updates: ['comments'], cause: ['cause'], action: ['action'],
  validation: ['test'], pending: ['notes', 'comments']
};
const EQUIPMENT = /impress|computador|\bpc\b|monitor|nobreak|scanner|scaner|notebook|teclado|mouse|fone|data ?show/;
const SYSTEMS = /projudi|\bsei\b|login|senha|malote|serp|scriba|sistema|e-?mail|gemini|acesso/;

/**
 * Aplica os critérios da pré-auditoria e indicadores operacionais a um chamado importado.
 * Critérios sem coluna correspondente no arquivo ficam "não exportado" e saem da nota.
 */
export function ticketMetrics(record, { fields = new Set(Object.keys(record)), batchDay = null, progressIsSla = false } = {}) {
  const data = { ...record, location: record.location || [record.sector, record.room && 'Sala ' + record.room].filter(Boolean).join(' · ') };
  const ev = evaluateQuality(data);
  const criteria = ev.criteria.map(c => {
    const exported = CRITERIA_SOURCES[c.id].some(f => fields.has(f));
    return { id: c.id, label: c.label, weight: c.weight, status: exported ? c.status : 'not_exported', recommendation: c.recommendation };
  });
  const scored = criteria.filter(c => c.status !== 'not_exported' && c.status !== 'not_applicable');
  const w = scored.reduce((a, c) => a + c.weight, 0);
  // Com menos de 3 critérios avaliáveis a nota seria enganosa (ex.: só o assunto): não é calculada.
  const score = w && scored.length >= MIN_CRITERIA_FOR_SCORE ? Math.round(scored.filter(c => c.status === 'met').reduce((a, c) => a + c.weight, 0) / w * 100) : null;

  const date = v => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
  const fmt = d => d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const ops = [];
  const mins = parseDuration(record.duration);
  if (mins !== null) ops.push({ label: 'Tempo registrado', value: mins + ' min', flag: null });
  const prog = num(record.progress);
  if (prog !== null) ops.push({ label: progressIsSla ? '% do prazo do SLA usado' : 'Progresso', value: String(prog).replace('.', ',') + (progressIsSla ? '%' : ''), flag: progressIsSla ? (prog > 100 ? 'bad' : prog > 50 ? 'warn' : 'ok') : null });
  if (record.sla) ops.push({ label: 'SLA', value: record.sla, flag: null });
  const opened = date(record.openedAt), due = date(record.dueAt), att = date(record.attendedAt), closed = date(record.closedAt);
  if (due && opened) ops.push({ label: 'Prazo previsto', value: fmt(due) + ' (' + Math.round((due - opened) / 60000) + ' min após o registro)', flag: null });
  if (att) {
    const late = due ? att > due : null;
    ops.push({ label: 'Atendimento registrado', value: fmt(att) + (late === null ? '' : late ? ' — fora do prazo' : ' — dentro do prazo'), flag: late === null ? null : late ? 'bad' : 'ok' });
  }
  if (opened && att && att >= opened) ops.push({ label: 'Do registro ao atendimento', value: String(Math.round((att - opened) / 86400000 * 10) / 10).replace('.', ',') + ' dia(s)', flag: null });
  if (att && closed && closed >= att) ops.push({ label: 'Do atendimento ao fechamento', value: String(Math.round((closed - att) / 86400000 * 10) / 10).replace('.', ',') + ' dia(s)', flag: null });
  if (record.channel) ops.push({ label: 'Canal', value: record.channel, flag: null });

  const flags = [];
  if (att && batchDay && att.toLocaleDateString('pt-BR') === batchDay) flags.push('Data de atendimento igual à do registro em lote (' + batchDay + '): o atendimento real pode ter ocorrido antes; confira se o prazo foi de fato perdido.');
  const subj = fold(record.subject || '');
  if (/criado via chatbot/.test(subj) || /^\s*(suporte|chamado|solicitacao)\s*$/.test(subj)) flags.push('Assunto genérico: use "EQUIPAMENTO/SISTEMA - PROBLEMA".');
  const cat = fold(record.category || '');
  if (cat && EQUIPMENT.test(subj) && /sistemas e aplicativos/.test(cat)) flags.push('Assunto de equipamento classificado como "uso dos sistemas": confira a categoria (muda o prazo do SLA).');
  if (cat && SYSTEMS.test(subj) && !EQUIPMENT.test(subj) && /computador e outros/.test(cat)) flags.push('Assunto de sistema classificado como "Computador e outros": confira a categoria.');
  if (scored.length < MIN_CRITERIA_FOR_SCORE) flags.push('O arquivo não traz descrição, comentários nem solução: a qualidade do registro não pode ser medida. Abra na pré-auditoria para completar.');

  return { score, evaluated: scored.length, exported: criteria.filter(c => c.status !== 'not_exported').length, criteria, ops, flags };
}
