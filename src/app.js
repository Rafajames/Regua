// Régua — lógica da interface.
import { evaluateQuality, DEFAULT_CRITERIA, DIMENSION_LABELS, STATUS_LABELS, scoreBand, CRITERIA_VERSION } from './quality-engine.js';
import { PROVIDERS, AIError, testProviderConnection, generateResolutionDraft, reviewTicketWithProvider, proposeCriteriaConfiguration, normalizeModelId } from './ai-provider.js';
import { extractFromComments } from './comment-parser.js';
import { readTicketFile, summarizeTickets, ticketMetrics } from './ticket-import.js';
import { buildStandardDraft, checkClosureClaims, DEFAULT_SIGNATURE } from './draft-template.js';
import * as store from './storage.js';

export const APP_VERSION = '2026.11.23.11';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
const scoreText = s => typeof s === 'number' ? s + '%' : '—';
const FORM_FIELDS = store.RECORD_TEXT_FIELDS;

const state = {
  db: null,
  items: [],
  currentId: null,
  dirty: false,
  lastEvaluation: null,
  lastLocationMatch: null,
  maptec: [],
  managerRecords: [],
  localFolder: null,
  signature: DEFAULT_SIGNATURE,
  draftManual: false,
  detailId: null,
  ai: { provider: 'gemini', key: '', models: [], model: '', manualModel: '', customBase: '', connected: false, prefs: {} }
};

/* ================= Utilidades de interface ================= */

let toastTimer;
function toast(message, type = 'info') {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), type === 'error' ? 5200 : 2800);
}

function setStatus(el, stateName, message, detail = '') {
  el.dataset.state = stateName;
  el.innerHTML = '<span>' + esc(message) + (detail ? '<small>Detalhe técnico: ' + esc(detail) + '</small>' : '') + '</span>';
}

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.classList.toggle('busy', busy);
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
}

function describeError(err) {
  if (err instanceof AIError || err?.code) {
    let message = err.message;
    if (err.code === 'network' && navigator.onLine === false) message = 'Sem conexão com a internet. As funções locais continuam disponíveis; a IA precisa de internet.';
    return { message, detail: err.detail || '', code: err.code };
  }
  return { message: 'Erro inesperado: ' + String(err?.message || err).slice(0, 200), detail: '', code: 'unknown' };
}

function confirmDialog(text, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) {
  const dlg = $('confirmDialog');
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  const okBtn = $('confirmOk');
  okBtn.textContent = ok;
  okBtn.classList.toggle('danger', danger);
  okBtn.classList.toggle('primary', !danger);
  if (typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(text));
  return new Promise(resolve => {
    const done = value => { dlg.close(); okBtn.onclick = null; $('confirmCancel').onclick = null; resolve(value); };
    okBtn.onclick = () => done(true);
    $('confirmCancel').onclick = () => done(false);
    dlg.oncancel = e => { e.preventDefault(); done(false); };
    dlg.showModal();
    $('confirmCancel').focus();
  });
}

function emptyState(title, text, action) {
  return '<div class="empty"><strong>' + esc(title) + '</strong>' + esc(text) + (action ? '<br><button class="btn primary" type="button" data-go="' + action.page + '">' + esc(action.label) + '</button>' : '') + '</div>';
}

/* ================= Navegação ================= */

const PAGE_TITLES = { home: 'Visão geral', audit: 'Pré-auditoria', history: 'Histórico', reports: 'Relatórios', manager: 'Conjunto gerencial', settings: 'Configurações' };

function go(id, { focus = true } = {}) {
  if (!PAGE_TITLES[id]) id = 'home';
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('[data-page]').forEach(b => {
    const active = b.dataset.page === id;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('crumb').textContent = PAGE_TITLES[id];
  document.title = PAGE_TITLES[id] + ' · Régua';
  if (id === 'history') renderHistory();
  if (id === 'reports') renderReports();
  if (id === 'settings') renderSettingsInfo();
  if (focus) { window.scrollTo({ top: 0 }); $('content').focus({ preventScroll: true }); }
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-page]');
  if (nav) { go(nav.dataset.page); return; }
  const link = e.target.closest('[data-go]');
  if (link) go(link.dataset.go);
});

/* ================= Tema e rede ================= */

function applyTheme(mode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeMode').value = mode;
  $('themeToggle').innerHTML = '<svg class="ico"><use href="#' + (dark ? 'i-sun' : 'i-moon') + '"/></svg>';
  $('themeToggle').setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#081a36' : '#0a2c63');
}
const themePref = () => { try { return localStorage.getItem('regua-theme') || 'system'; } catch { return 'system'; } };
const saveTheme = m => { try { localStorage.setItem('regua-theme', m); } catch { /* ignora */ } applyTheme(m); };
$('themeMode').addEventListener('change', () => saveTheme($('themeMode').value));
$('themeToggle').addEventListener('click', () => saveTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'system') applyTheme('system'); });

function updateNetwork() {
  const pill = $('netPill');
  const online = navigator.onLine !== false;
  pill.classList.toggle('offline', !online);
  pill.textContent = online ? 'Neste dispositivo' : 'Offline';
}
window.addEventListener('online', updateNetwork);
window.addEventListener('offline', updateNetwork);

/* ================= Service Worker e atualização ================= */

let waitingWorker = null, reloadRequested = false;
function showUpdate(worker) { waitingWorker = worker; $('updateBar').classList.remove('hidden'); }
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadRequested) location.reload(); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (err) {
    console.warn('Cache offline indisponível:', err?.message);
  }
}
$('applyUpdate').addEventListener('click', async () => {
  if (state.dirty && !(await confirmDialog('Há alterações não salvas na pré-auditoria. Atualizar agora vai recarregar a página e descartá-las. Continuar?', { title: 'Atualizar a Régua', ok: 'Atualizar mesmo assim' }))) return;
  reloadRequested = true;
  state.dirty = false; // o usuário já confirmou; evita o segundo alerta do navegador ao recarregar
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
});
$('dismissUpdate').addEventListener('click', () => $('updateBar').classList.add('hidden'));
window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ================= MapTec e WhatsApp ================= */

const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function loadMaptec() {
  try {
    const r = await fetch('data/maptec-locations.json');
    if (!r.ok) return;
    const j = await r.json();
    state.maptec = Array.isArray(j.locations) ? j.locations : [];
    const buildings = [...new Set(state.maptec.map(x => x.building).filter(Boolean))].sort();
    $('buildingList').innerHTML = buildings.map(b => '<option value="' + esc(b) + '">').join('');
  } catch (err) { console.warn('Catálogo MapTec indisponível:', err?.message); }
}

function waField(raw, label) {
  const m = raw.match(new RegExp('(?:^|\\n)\\s*[*_]?' + label + '[*_]?\\s*:\\s*([^\\n]*)', 'i'));
  return m ? m[1].replace(/^\*+|\*+$/g, '').trim() : '';
}

function findMaptecLocation(sector, room, description) {
  const sec = norm(sector), desc = norm(description), rm = String(room || '').trim();
  let c = state.maptec.filter(x => sec && norm(x.sector) === sec);
  if (rm) c = c.filter(x => String(x.room) === rm);
  if (!c.length && sec) c = state.maptec.filter(x => norm(x.sector).includes(sec) || sec.includes(norm(x.sector)));
  if (c.length > 1 && rm) c = c.filter(x => String(x.room) === rm);
  if (!c.length && rm && desc.includes('sala ' + norm(rm))) c = state.maptec.filter(x => String(x.room) === rm && norm(x.sector).includes('concilia'));
  return c.length === 1 ? c[0] : null;
}

function showLocationMatch(match) {
  const wrap = $('maptecMatchWrap');
  if (!match) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  $('maptecMatch').innerHTML = '<b>Local identificado no MapTec</b><br>' + [match.building, match.block, match.room ? 'Sala ' + match.room : '', match.sector].filter(Boolean).map(esc).join(' · ')
    + (match.unitCode ? '<br><span class="muted small">Código: ' + esc(match.unitCode) + '</span>' : '')
    + '<br><span class="muted small">Confirme se corresponde ao local do chamado. </span><a href="https://rafajames.github.io/MapTec-TJRR/" target="_blank" rel="noopener">Abrir MapTec</a>';
}

function parseMessage() {
  const raw = $('whatsappText').value.trim();
  if (!raw) return;
  const f = { number: waField(raw, 'Chamado'), requester: waField(raw, 'Solicitante'), description: waField(raw, 'Descri[çc][ãa]o'), solutionTime: waField(raw, 'Tempo de solu[çc][ãa]o'), sector: waField(raw, 'Setor'), room: waField(raw, 'Sala') };
  const filled = [];
  const assign = (id, v, label) => { if (v) { $(id).value = v; filled.push(label); } };
  assign('number', f.number, 'número'); assign('requester', f.requester, 'solicitante'); assign('description', f.description, 'descrição'); assign('solutionTime', f.solutionTime, 'data de solução');
  if (f.description && !$('subject').value) {
    $('subject').value = /\bpc\b|computador/i.test(f.description) ? 'Manutenção de suporte em PC' : f.description.split(/[.!?]/)[0].slice(0, 90);
    filled.push('assunto (sugerido)');
  }
  if (!$('assetType').value) {
    if (/\bpc\b|computador/i.test(f.description)) assign('assetType', 'PC', 'equipamento');
    else if (/impressora/i.test(f.description)) assign('assetType', 'Impressora', 'equipamento');
    else if (/monitor/i.test(f.description)) assign('assetType', 'Monitor', 'equipamento');
  }
  const match = findMaptecLocation(f.sector, f.room, f.description);
  state.lastLocationMatch = match;
  if (match) {
    $('building').value = match.building;
    $('location').value = [match.block, match.room ? 'Sala ' + match.room : '', match.sector].filter(Boolean).join(' · ');
    filled.push('local (MapTec)');
  } else if (f.sector || f.room) {
    $('location').value = [f.sector, f.room ? 'Sala ' + f.room : ''].filter(Boolean).join(' · ');
    filled.push('local (sem confirmação no MapTec)');
  }
  showLocationMatch(match);
  $('parseFeedback').textContent = filled.length ? '' : 'Não reconheci os campos. Use “Editar dados” para preencher.';
  markDirty();
  evaluateLive();
}
$('whatsappText').addEventListener('paste', () => setTimeout(parseMessage, 0));
$('whatsappText').addEventListener('change', parseMessage);

/* ================= Pré-auditoria ================= */

function readForm() {
  const d = {};
  for (const k of FORM_FIELDS) d[k] = $(k).value.trim();
  return d;
}

function fillForm(record) {
  for (const k of FORM_FIELDS) $(k).value = record[k] || '';
  for (const id of ['action', 'cause', 'test', 'notes']) markAuto($(id), false);
  $('commentsFeedback').textContent = '';
  state.draftManual = !!record.draft;
  $('regenDraft').classList.toggle('hidden', !state.draftManual);
  $('closureConfirmed').checked = !!record.closureConfirmed;
  $('draftOutput').value = record.draft || '';
  state.lastLocationMatch = record.locationMatch || null;
  showLocationMatch(state.lastLocationMatch);
  $('draftWarnings').classList.add('hidden');
}

function markDirty() { state.dirty = true; }

function setEditing(id) {
  state.currentId = id;
  $('saveAudit').textContent = id ? 'Atualizar' : 'Salvar';
}

async function resetAudit({ ask = true } = {}) {
  if (ask && state.dirty && !(await confirmDialog('Descartar os dados não salvos desta pré-auditoria?', { title: 'Nova análise', ok: 'Descartar' }))) return false;
  $('auditForm').reset();
  $('whatsappText').value = '';
  $('parseFeedback').textContent = '';
  fillForm({});
  setEditing(null);
  state.dirty = false;
  $('aiResult').classList.add('hidden');
  $('draftStatus').classList.add('hidden');
  $('parseFeedback').textContent = '';
  evaluateLive();
  return true;
}

function renderEvaluation(ev, { empty = false } = {}) {
  const band = empty ? 'none' : scoreBand(ev.score);
  $('scoreRing').dataset.band = band;
  $('ringFg').style.strokeDashoffset = String(263.9 * (1 - (empty || ev.score === null ? 0 : ev.score / 100)));
  $('scoreValue').textContent = empty ? '—' : scoreText(ev.score);
  $('scoreTitle').textContent = empty ? 'Preencha os campos' : ev.passed + ' de ' + ev.total + ' critérios atendidos';
  $('scoreSub').textContent = empty ? 'A avaliação é atualizada enquanto você digita.' : band === 'good' ? 'Registro consistente. Revise os pontos restantes.' : band === 'fair' ? 'Registro parcial. Complete os itens indicados.' : 'Registro insuficiente. Veja o que falta abaixo.';
  $('dimensionBars').innerHTML = Object.entries(ev.dimensions).map(([k, d]) => {
    const b = scoreBand(d.score);
    return '<div class="dim"><span>' + esc(DIMENSION_LABELS[k]) + '</span><div class="bar ' + b + '"><i style="width:' + (empty ? 0 : d.score ?? 0) + '%"></i></div><b>' + (empty ? '—' : scoreText(d.score)) + '</b></div>';
  }).join('');
  const pill = $('scorePill');
  pill.dataset.band = band;
  pill.textContent = empty ? '—' : scoreText(ev.score);
  pill.setAttribute('aria-label', empty ? 'Sem avaliação' : 'Nota ' + scoreText(ev.score) + '. Ver detalhes');
  const missing = ev.criteria.filter(c => c.status === 'not_evidenced' || c.status === 'needs_review').map(c => c.label.toLowerCase());
  $('missingList').className = 'missing' + (empty ? '' : missing.length ? ' warn' : ' ok');
  $('missingList').textContent = empty ? '' : missing.length ? 'Falta: ' + missing.join(', ') + '.' : 'Registro completo.';
  const icon = { met: '✓', needs_review: '!', not_evidenced: '×', not_applicable: '–' };
  $('criteriaList').innerHTML = ev.criteria.map(c => '<li><span class="st ' + c.status + '" aria-hidden="true">' + icon[c.status] + '</span><div><b>' + esc(c.label) + ' <span class="tag-st ' + c.status + '">' + esc(STATUS_LABELS[c.status]) + '</span></b><span class="muted">' + esc(c.status === 'met' || c.status === 'not_applicable' ? c.evidence : c.recommendation) + '</span></div></li>').join('');
}

function renderSummary(d) {
  const parts = [d.number && 'Chamado ' + d.number, d.building, d.assetType, d.subject].filter(Boolean);
  $('ticketSummary').innerHTML = parts.length ? parts.map(p => '<span class="chip">' + esc(p.length > 48 ? p.slice(0, 47) + '…' : p) + '</span>').join('') : '<span class="muted small">Nenhum dado ainda.</span>';
  const ind = [['action', 'Ação'], ['cause', 'Causa'], ['test', 'Teste'], ['notes', 'Pendência']];
  $('solutionIndicators').innerHTML = ind.map(([k, label]) => '<button type="button" class="chip ' + (d[k] ? 'on' : 'off') + '" data-field="' + k + '">' + (d[k] ? '✓ ' : '') + label + '</button>').join('');
}

// Texto padrão gerado automaticamente enquanto o técnico não editar o texto à mão.
function autoDraft(d) {
  if (state.draftManual) return;
  const has = d.action || d.comments || d.description;
  if (!has) { $('draftOutput').value = ''; showDraftWarnings([]); return; }
  const r = buildStandardDraft({ ...d, closureConfirmed: $('closureConfirmed').checked, signature: state.signature });
  $('draftOutput').value = r.draft;
  showDraftWarnings(r.warnings.filter(w => !/não confirmado pelo técnico/i.test(w)));
}

let liveTimer;
function evaluateLive() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    const d = readForm();
    const empty = !Object.values(d).some(Boolean);
    state.lastEvaluation = evaluateQuality(d);
    renderEvaluation(state.lastEvaluation, { empty });
    renderSummary(d);
    autoDraft(d);
  }, 120);
}

function openFields(focusId) {
  $('fieldsPanel').classList.remove('hidden');
  $('toggleFields').setAttribute('aria-expanded', 'true');
  $('toggleFields').textContent = 'Ocultar dados';
  if (focusId) $(focusId).focus();
}
$('toggleFields').addEventListener('click', () => {
  if ($('fieldsPanel').classList.contains('hidden')) openFields();
  else { $('fieldsPanel').classList.add('hidden'); $('toggleFields').setAttribute('aria-expanded', 'false'); $('toggleFields').textContent = 'Editar dados'; }
});
$('solutionIndicators').addEventListener('click', e => { const b = e.target.closest('[data-field]'); if (b) openFields(b.dataset.field); });
$('scorePill').addEventListener('click', () => { $('criteriaDetails').open = true; $('criteriaDetails').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

$('auditForm').addEventListener('input', () => { markDirty(); evaluateLive(); });
let commentTimer;
$('comments').addEventListener('input', () => { markDirty(); evaluateLive(); clearTimeout(commentTimer); commentTimer = setTimeout(() => fillFromComments(), 500); });
$('closureConfirmed').addEventListener('change', () => { markDirty(); evaluateLive(); });
$('draftOutput').addEventListener('input', () => { markDirty(); state.draftManual = true; $('regenDraft').classList.remove('hidden'); });
$('regenDraft').addEventListener('click', () => { state.draftManual = false; $('regenDraft').classList.add('hidden'); evaluateLive(); });
$('newAudit').addEventListener('click', async () => { if (await resetAudit()) $('whatsappText').focus(); });

async function saveCurrent({ quiet = false } = {}) {
  const d = readForm();
  if (!Object.values(d).some(Boolean)) { if (!quiet) toast('Nada para salvar ainda.'); return false; }
  if (!state.db) { toast('O armazenamento local não está disponível neste navegador.', 'error'); return false; }
  const now = new Date().toISOString();
  const existing = state.currentId ? state.items.find(x => x.id === state.currentId) : null;
  const record = {
    ...d,
    id: existing?.id || store.makeId(),
    createdAt: existing?.createdAt || now,
    ...(existing ? { updatedAt: now } : {}),
    closureConfirmed: $('closureConfirmed').checked,
    draft: $('draftOutput').value,
    locationMatch: state.lastLocationMatch,
    result: evaluateQuality(d),
    appVersion: APP_VERSION
  };
  try {
    await store.saveAudit(state.db, record);
    state.items = await store.listAudits(state.db);
    setEditing(record.id);
    state.dirty = false;
    $('scorePill').classList.remove('saved-pulse'); void $('scorePill').offsetWidth; $('scorePill').classList.add('saved-pulse');
    if (!quiet) toast(existing ? 'Análise atualizada.' : 'Análise salva.');
    renderHome();
    persistFolderCopy().catch(err => { $('folderStatus').classList.remove('hidden'); $('folderStatus').classList.remove('hidden'); $('folderStatus').textContent = 'Falha ao atualizar a pasta: ' + err.message; });
    return true;
  } catch (err) {
    toast('Não foi possível salvar: ' + (err?.message || err) + '. Exporte um backup e tente novamente.', 'error');
    return false;
  }
}
$('saveAudit').addEventListener('click', () => saveCurrent());

/* ================= Preenchimento a partir do comentário ================= */

const AUTO_FIELDS = [['action', 'action', 'ação realizada'], ['cause', 'cause', 'causa'], ['test', 'test', 'teste/confirmação'], ['pending', 'notes', 'pendências']];

function markAuto(el, on) {
  el.classList.toggle('autofilled', on);
  if (on) el.dataset.auto = el.value; else delete el.dataset.auto;
  const label = document.querySelector('label[for="' + el.id + '"]');
  label?.querySelector('.auto-hint')?.remove();
  if (on && label) label.insertAdjacentHTML('beforeend', '<span class="auto-hint">preenchido do comentário</span>');
}

// Preenche a etapa 3 com as frases do comentário. Não sobrescreve o que o técnico digitou.
function fillFromComments({ manual = false } = {}) {
  const text = $('comments').value.trim();
  if (!text) { if (manual) { toast('Escreva o comentário primeiro.'); $('comments').focus(); } return; }
  const found = extractFromComments(text);
  const filled = [], kept = [];
  for (const [key, id, label] of AUTO_FIELDS) {
    const el = $(id), value = found[key];
    if (!value) continue;
    const mine = el.value.trim() && el.dataset.auto !== el.value;
    if (mine) { if (el.value.trim() !== value) kept.push(label); continue; }
    el.value = value;
    markAuto(el, true);
    filled.push(label);
  }
  const fb = $('commentsFeedback');
  fb.textContent = filled.length ? 'Preenchido do comentário: ' + filled.join(', ') + '.' + (kept.length ? ' Mantido: ' + kept.join(', ') + '.' : '') : kept.length ? 'Mantido: ' + kept.join(', ') + '.' : '';
  if (filled.length) { markDirty(); evaluateLive(); }
}
// Ao editar um campo preenchido automaticamente, ele passa a ser do técnico.
for (const [, id] of AUTO_FIELDS) $(id).addEventListener('input', () => { if ($(id).dataset.auto !== undefined && $(id).dataset.auto !== $(id).value) markAuto($(id), false); });

/* ================= Rascunho ================= */

function showDraftWarnings(list, footer = '') {
  const box = $('draftWarnings');
  box.classList.toggle('hidden', !list.length);
  box.innerHTML = list.length ? '<b>Revise antes de utilizar</b><ul>' + list.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (footer ? '<p class="muted small">' + esc(footer) + '</p>' : '') : '';
}

async function confirmReplaceDraft() {
  return !state.draftManual || !$('draftOutput').value.trim() || confirmDialog('Substituir o texto atual do rascunho?', { title: 'Substituir rascunho', ok: 'Substituir' });
}

function effectiveModel() { return normalizeModelId(state.ai.manualModel || state.ai.model); }
// Todos os modelos habilitados na chave (lista testada) servem de reserva, na ordem recomendada.
function fallbackModels() { return state.ai.models.filter(m => m !== effectiveModel()); }

async function makeAiDraft(stage) {
  if (!state.ai.key || !effectiveModel()) { toast('Configure a chave e o modelo da IA em Configurações.'); go('settings'); $('geminiKey').focus(); return; }
  const d = readForm();
  if (!d.description && !d.comments && !d.subject) { toast('Preencha ao menos a solicitação ou os comentários.'); $('description').focus(); return; }
  if (stage === 'completion' && !d.action && !(await confirmDialog('A ação realizada está vazia. A IA vai deixar marcadores [CONFIRMAR]. Continuar?', { ok: 'Continuar' }))) return;
  if (!(await confirmDialog('O conteúdo técnico do chamado (solicitação, comentários e ações) será enviado diretamente ao provedor ' + PROVIDERS[state.ai.provider].label + '. Remova dados pessoais ou sigilosos. Continuar?', { title: 'Enviar para a IA', ok: 'Enviar' }))) return;
  if (!(await confirmReplaceDraft())) return;
  const btn = stage === 'initial' ? $('initialDraft') : $('finalDraft');
  $('draftStatus').classList.remove('hidden');
  setBusy(btn, true);
  setStatus($('draftStatus'), 'working', 'Gerando resposta com ' + effectiveModel() + '…');
  try {
    const r = await generateResolutionDraft({
      provider: state.ai.provider, apiKey: state.ai.key, model: effectiveModel(), customBase: state.ai.customBase,
      fallbacks: fallbackModels(), onProgress: msg => setStatus($('draftStatus'), 'working', msg),
      request: ['Assunto: ' + d.subject, 'Local: ' + [d.building, d.location].filter(Boolean).join(' · '), 'Equipamento: ' + d.assetType, 'Patrimônio: ' + (d.asset || 'não informado'), 'Descrição: ' + d.description].join('\n'),
      history: d.comments,
      technicianNotes: ['Ação realizada: ' + (d.action || 'não informada'), 'Causa: ' + (d.cause || 'não informada'), 'Teste/validação: ' + (d.test || 'não informado')].join('\n'),
      pending: d.notes, signature: state.signature, stage, closureConfirmed: $('closureConfirmed').checked
    });
    $('draftOutput').value = r.draft;
    state.draftManual = true; $('regenDraft').classList.remove('hidden');
    markDirty();
    const warnings = [...r.guard_warnings, ...r.missing_information.map(x => 'Informação ausente: ' + x), ...r.contradictions.map(x => 'Divergência: ' + x), ...r.pending_items.map(x => 'Pendência: ' + x)];
    showDraftWarnings(warnings, r.requires_technician_confirmation ? 'A confirmação do técnico é necessária antes de afirmar conclusão ou encerramento.' : '');
    if (r.fallback_used) setStatus($('draftStatus'), 'warn', 'Resposta concluída com ' + r.model_used + ', porque ' + effectiveModel() + ' estava sobrecarregado ou sem cota. Nada foi enviado ao Aranda.');
    else setStatus($('draftStatus'), 'ok', 'Resposta concluída com ' + r.model_used + '. Nada foi enviado ao Aranda.');
  } catch (err) {
    const e = describeError(err);
    setStatus($('draftStatus'), 'error', 'Não foi possível gerar o rascunho. ' + e.message, e.detail);
    if (e.code === 'model' || e.code === 'auth') updateAiChip('error', e.code === 'auth' ? 'Falha na autenticação' : 'Modelo indisponível');
  } finally { setBusy(btn, false); }
}
const closeMenus = () => document.querySelectorAll('details.menu[open]').forEach(d => d.removeAttribute('open'));
$('initialDraft').addEventListener('click', () => { closeMenus(); makeAiDraft('initial'); });
$('finalDraft').addEventListener('click', () => { closeMenus(); makeAiDraft('completion'); });
document.addEventListener('click', e => { if (!e.target.closest('details.menu')) closeMenus(); });

$('copyDraft').addEventListener('click', async () => {
  const text = $('draftOutput').value.trim();
  if (!text) { toast('Ainda não há texto para copiar.'); return; }
  const warnings = checkClosureClaims(text, $('closureConfirmed').checked);
  if (warnings.length) showDraftWarnings(warnings);
  try {
    await navigator.clipboard.writeText(text);
    const saved = await saveCurrent({ quiet: true });
    toast((warnings.length ? 'Texto copiado — veja os avisos.' : 'Texto copiado.') + (saved ? ' Análise salva.' : ''));
  } catch {
    $('draftOutput').select();
    toast('Não foi possível copiar automaticamente. O texto foi selecionado: use Ctrl+C.', 'error');
  }
});

/* ================= Análise com IA ================= */

$('aiReview').addEventListener('click', async () => {
  closeMenus();
  if (!state.ai.key || !effectiveModel()) { toast('Configure a chave e o modelo da IA em Configurações.'); go('settings'); return; }
  const d = readForm();
  if (!Object.values(d).some(Boolean)) { toast('Preencha o chamado antes da análise.'); return; }
  if (!(await confirmDialog('Serão enviados ao provedor campos técnicos do chamado, sem número, solicitante e técnico. Remova nomes, contatos e dados sigilosos que existam na descrição ou nos comentários. Continuar?', { title: 'Analisar com IA', ok: 'Enviar' }))) return;
  const btn = $('aiReview'), box = $('aiResult');
  setBusy(btn, true);
  box.classList.remove('hidden');
  box.innerHTML = '<p class="muted">Analisando com ' + esc(effectiveModel()) + '…</p>';
  try {
    const r = await reviewTicketWithProvider({ provider: state.ai.provider, apiKey: state.ai.key, model: effectiveModel(), fallbacks: fallbackModels(), onProgress: msg => { box.innerHTML = '<p class="muted">' + esc(msg) + '</p>'; }, customBase: state.ai.customBase, data: d });
    const list = (arr, pick) => (Array.isArray(arr) && arr.length ? arr.map(x => '<li>' + esc(typeof x === 'string' ? x : pick(x)) + '</li>').join('') : '<li>Nenhum.</li>');
    box.innerHTML = '<h3>Análise assistida por IA</h3><p class="muted small">Consultiva e sujeita à revisão humana. Não altera a nota calculada pelas regras. Modelo: ' + esc(r.model_used) + (r.fallback_used ? ' (reserva; o escolhido estava sobrecarregado ou sem cota)' : '') + '.</p>'
      + '<p><b>Conclusão:</b> ' + esc(r.overall || 'não informada') + '</p><p><b>Confiança:</b> ' + esc(r.confidence || 'não informada') + '</p>'
      + '<b>Achados</b><ul>' + list(r.findings, x => [x.criterion, x.explanation || x.evidence].filter(Boolean).join(': ') || JSON.stringify(x)) + '</ul>'
      + '<b>Recomendações</b><ul>' + list(r.recommendations, x => x.recommendation || JSON.stringify(x)) + '</ul>';
  } catch (err) {
    const e = describeError(err);
    box.innerHTML = '<p><b>Falha na análise.</b> ' + esc(e.message) + '</p>' + (e.detail ? '<p class="muted small">Detalhe técnico: ' + esc(e.detail) + '</p>' : '');
  } finally { setBusy(btn, false); }
});

/* ================= Visão geral ================= */

function itemRow(x) {
  const s = x.result?.score;
  return '<button type="button" class="item" data-detail="' + esc(x.id) + '"><span><b>' + esc(x.number || x.subject || 'Análise sem título') + '</b><small>' + esc([x.building, fmtDate(x.updatedAt || x.createdAt)].filter(Boolean).join(' · ')) + '</small></span><span class="score-tag ' + scoreBand(s) + '">' + scoreText(s) + '</span></button>';
}
const sortedItems = () => state.items.slice().sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
const scoresOf = items => items.map(x => x.result?.score).filter(s => typeof s === 'number');

function bandsHtml(items) {
  const scores = scoresOf(items);
  if (!scores.length) return emptyState('Sem dados ainda', ' As faixas aparecem depois da primeira análise salva.');
  const bands = [['good', '80% ou mais', s => s >= 80], ['fair', '55% a 79%', s => s >= 55 && s < 80], ['low', 'Abaixo de 55%', s => s < 55]];
  return bands.map(([cls, label, fn]) => { const n = scores.filter(fn).length; return '<div class="band-row"><div><span>' + label + '</span><b>' + n + '</b></div><div class="bar ' + cls + '"><i style="width:' + Math.round(n / scores.length * 100) + '%"></i></div></div>'; }).join('');
}

function renderHome() {
  const scores = scoresOf(state.items);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  $('total').textContent = state.items.length;
  $('average').textContent = scoreText(avg);
  $('review').textContent = scores.filter(s => s < 80).length;
  $('recent').innerHTML = state.items.length ? sortedItems().slice(0, 5).map(itemRow).join('') : emptyState('Nenhuma análise ainda', ' Comece colando a mensagem de um chamado.', { page: 'audit', label: 'Fazer a primeira pré-auditoria' });
}

/* ================= Histórico ================= */

function renderHistory() {
  const q = norm($('historySearch').value), f = $('historyFilter').value;
  let list = state.items.filter(x => {
    if (f !== 'all' && scoreBand(x.result?.score) !== f) return false;
    if (!q) return true;
    return norm([x.number, x.subject, x.building, x.location, x.tech, x.requester, x.description].join(' ')).includes(q);
  });
  const key = x => String(x.updatedAt || x.createdAt);
  list.sort((a, b) => key(b).localeCompare(key(a)));
  $('historyCount').textContent = state.items.length && (q || f !== 'all') ? list.length + ' de ' + state.items.length : '';
  $('historyList').innerHTML = list.length ? list.map(itemRow).join('') : state.items.length ? emptyState('Nada encontrado', ' Ajuste a pesquisa ou o filtro.') : emptyState('Histórico vazio', ' As análises salvas aparecem aqui.', { page: 'audit', label: 'Nova pré-auditoria' });
}
['historySearch', 'historyFilter'].forEach(id => $(id).addEventListener('input', renderHistory));

document.addEventListener('click', e => {
  const row = e.target.closest('[data-detail]');
  if (row) openDetail(row.dataset.detail);
});

function criteriaOf(rec) {
  if (Array.isArray(rec.result?.criteria)) return rec.result.criteria.map(c => ({ label: c.label, status: c.status === 'review' ? 'needs_review' : c.status }));
  if (Array.isArray(rec.result?.rules)) return rec.result.rules.map(r => ({ label: r[0], status: r[1] ? 'met' : 'needs_review' }));
  return [];
}

function openDetail(id) {
  const rec = state.items.find(x => x.id === id);
  if (!rec) return;
  state.detailId = id;
  $('detailTitle').textContent = rec.number ? 'Chamado ' + rec.number : (rec.subject || 'Análise');
  const field = (label, value, full) => value ? '<div class="' + (full ? 'full' : '') + '"><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>' : '';
  const crit = criteriaOf(rec);
  $('detailBody').innerHTML = '<p class="muted small">Salva em ' + esc(fmtDate(rec.createdAt)) + (rec.updatedAt ? ' · atualizada em ' + esc(fmtDate(rec.updatedAt)) : '') + ' · nota <b>' + scoreText(rec.result?.score) + '</b></p>'
    + '<dl class="detail-grid">' + field('Assunto', rec.subject, true) + field('Prédio', rec.building) + field('Local', rec.location) + field('Solicitante', rec.requester) + field('Técnico', rec.tech)
    + field('Solicitação original', rec.description, true) + field('Comentários', rec.comments, true) + field('Ação realizada', rec.action, true) + field('Causa', rec.cause) + field('Teste', rec.test) + field('Pendências', rec.notes, true) + field('Texto preparado', rec.draft, true) + '</dl>'
    + (crit.length ? '<h2>Critérios</h2><ul class="criteria">' + crit.map(c => '<li><span class="st ' + c.status + '"></span><div><b>' + esc(c.label) + ' <span class="tag-st ' + c.status + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span></b></div></li>').join('') + '</ul>' : '');
  const dlg = $('detailDialog');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}
$('detailDialog').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === $('detailDialog')) $('detailDialog').close(); });
$('detailOpen').addEventListener('click', async () => {
  const rec = state.items.find(x => x.id === state.detailId);
  if (!rec) return;
  if (state.dirty && !(await confirmDialog('Há dados não salvos na pré-auditoria atual. Descartá-los para abrir esta análise?', { ok: 'Descartar e abrir' }))) return;
  $('detailDialog').close();
  fillForm(rec);
  setEditing(rec.id);
  state.dirty = false;
  go('audit');
  evaluateLive();
  toast('Análise carregada. Salvar vai atualizar o mesmo registro.');
});
$('detailDelete').addEventListener('click', async () => {
  const rec = state.items.find(x => x.id === state.detailId);
  if (!rec) return;
  if (!(await confirmDialog('Excluir a análise “' + (rec.number || rec.subject || 'sem título') + '”? Esta ação não pode ser desfeita.', { title: 'Excluir análise', ok: 'Excluir', danger: true }))) return;
  try {
    await store.deleteAudit(state.db, rec.id);
    state.items = await store.listAudits(state.db);
    if (state.currentId === rec.id) setEditing(null);
    $('detailDialog').close();
    renderHistory(); renderHome();
    persistFolderCopy().catch(() => {});
    toast('Análise excluída.');
  } catch (err) { toast('Não foi possível excluir: ' + err.message, 'error'); }
});

$('backup').addEventListener('click', () => {
  if (!state.items.length) { toast('Não há análises para exportar.'); return; }
  const blob = new Blob([JSON.stringify(store.buildBackup(state.items, APP_VERSION), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'regua-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup exportado com ' + state.items.length + ' análise(s).');
});

$('importBackupBtn').addEventListener('click', () => { closeMenus(); $('importBackupFile').click(); });
$('importBackupFile').addEventListener('change', async () => {
  const file = $('importBackupFile').files[0];
  $('importBackupFile').value = '';
  if (!file) return;
  if (file.size > store.MAX_BACKUP_BYTES) { toast('Arquivo maior que 10 MB.', 'error'); return; }
  const result = store.parseBackup(await file.text(), new Set(state.items.map(x => x.id)));
  if (!result.ok) { toast('Backup não importado: ' + result.errors.join(' '), 'error'); return; }
  if (!result.records.length) { toast('Nada a importar: ' + result.duplicates + ' já existente(s), ' + result.invalid + ' inválido(s).'); return; }
  const msg = 'Arquivo validado: ' + result.records.length + ' análise(s) nova(s)' + (result.duplicates ? ', ' + result.duplicates + ' já existente(s) serão ignorada(s)' : '') + (result.invalid ? ', ' + result.invalid + ' inválida(s) serão ignorada(s)' : '') + '. Os registros atuais não serão alterados. Importar?';
  if (!(await confirmDialog(msg, { title: 'Importar backup', ok: 'Importar' }))) return;
  try {
    await store.saveMany(state.db, result.records);
    state.items = await store.listAudits(state.db);
    renderHistory(); renderHome();
    persistFolderCopy().catch(() => {});
    toast(result.records.length + ' análise(s) importada(s).');
  } catch (err) { toast('Importação cancelada; nenhum registro foi gravado. ' + err.message, 'error'); }
});

$('clear').addEventListener('click', async () => {
  if (!state.items.length) { toast('O histórico já está vazio.'); return; }
  if (!(await confirmDialog('Apagar as ' + state.items.length + ' análise(s) deste navegador? Esta ação não pode ser desfeita. Exporte um backup antes se precisar.', { title: 'Limpar histórico', ok: 'Apagar tudo', danger: true }))) return;
  try {
    await store.clearAudits(state.db);
    state.items = [];
    setEditing(null);
    renderHistory(); renderHome();
    persistFolderCopy().catch(() => {});
    toast('Histórico local apagado.');
  } catch (err) { toast('Não foi possível limpar: ' + err.message, 'error'); }
});

async function persistFolderCopy() {
  const folder = state.localFolder;
  if (!folder) return false;
  if ((await folder.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await folder.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    $('folderStatus').classList.remove('hidden'); $('folderStatus').textContent = 'Permissão da pasta não concedida. O histórico continua salvo no navegador.';
    return false;
  }
  const dir = await (await folder.getDirectoryHandle('Régua', { create: true })).getDirectoryHandle('Meus chamados', { create: true });
  const w = await (await dir.getFileHandle('chamados.json', { create: true })).createWritable();
  await w.write(JSON.stringify(store.buildBackup(state.items, APP_VERSION), null, 2));
  await w.close();
  $('folderStatus').classList.remove('hidden'); $('folderStatus').textContent = 'Cópia atualizada em ' + folder.name + '/Régua/Meus chamados/chamados.json às ' + new Date().toLocaleTimeString('pt-BR') + '.';
  return true;
}
$('chooseFolder').addEventListener('click', async () => {
  if (!window.showDirectoryPicker) { toast('Este navegador não permite escolher pastas (recurso do Chrome e Edge). Use “Exportar backup”.'); return; }
  try {
    state.localFolder = await window.showDirectoryPicker({ mode: 'readwrite' });
    await store.putSetting(state.db, 'localFolder', state.localFolder);
    await persistFolderCopy();
    toast('Pasta autorizada e cópia criada.');
  } catch (err) { if (err.name !== 'AbortError') toast('Não foi possível acessar a pasta: ' + err.message, 'error'); }
});

/* ================= Relatórios ================= */

function renderReports() {
  const scores = scoresOf(state.items);
  $('reportAudits').textContent = state.items.length;
  $('reportAverage').textContent = scoreText(scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null);
  $('reportBars').innerHTML = bandsHtml(state.items);
  const withDims = state.items.filter(x => x.result?.dimensions);
  $('reportDims').innerHTML = withDims.length ? Object.keys(DIMENSION_LABELS).map(k => {
    const vals = withDims.map(x => x.result.dimensions[k]?.score).filter(v => typeof v === 'number');
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    return '<div class="dim"><span>' + DIMENSION_LABELS[k] + '</span><div class="bar ' + scoreBand(avg) + '"><i style="width:' + (avg ?? 0) + '%"></i></div><b>' + scoreText(avg) + '</b></div>';
  }).join('') : emptyState('Sem dados ainda', ' Salve análises para ver as médias.');
  const counts = {};
  for (const x of state.items) for (const c of criteriaOf(x)) if (c.status === 'not_evidenced' || c.status === 'needs_review') counts[c.label] = (counts[c.label] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const n = state.items.length || 1;
  $('reportCriteria').innerHTML = top.length ? top.map(([label, c]) => '<div class="band-row"><div><span>' + esc(label) + '</span><b>' + c + '</b></div><div class="bar fair"><i style="width:' + Math.round(c / n * 100) + '%"></i></div></div>').join('') : emptyState('Nenhuma falta registrada', state.items.length ? ' Todas as análises atenderam aos critérios.' : ' Salve análises para ver este indicador.');
}

/* ================= Conjunto gerencial ================= */

const fmtNum = n => n === null || n === undefined ? '—' : String(n).replace('.', ',');

function renderManager() {
  const rows = state.managerRecords;
  const sum = summarizeTickets(rows, { progressLabel: state.managerProgressLabel || 'Progresso' });
  $('managerTotal').textContent = sum.total;
  $('managerClosed').textContent = sum.total ? sum.closed : '—';
  $('managerOpen').textContent = sum.total ? sum.open : '—';
  $('managerAverage').textContent = sum.quality ? sum.quality.average + '%' : '—';
  $('managerQualityNote').textContent = sum.total && !sum.quality ? 'arquivo sem textos de registro' : sum.quality ? sum.quality.evaluated + ' com texto' : '';
  const maxCount = sum.categories[0]?.count || 1;
  $('managerCategories').innerHTML = sum.total ? sum.categories.slice(0, 12).map(c => '<div class="band-row"><div><span>' + esc(c.name) + '</span><b>' + c.count + ' · ' + Math.round(c.share * 100) + '%' + (c.median !== null ? ' · mediana ' + fmtNum(c.median) : '') + '</b></div><div class="bar"><i style="width:' + Math.round(c.count / maxCount * 100) + '%"></i></div></div>').join('') : emptyState('Nenhum conjunto', ' Escolha um arquivo acima.');
  const ins = [];
  if (sum.total) {
    const top = sum.categories[0];
    if (top) ins.push('<b>' + esc(top.name) + '</b> é a categoria mais frequente (' + Math.round(top.share * 100) + '% dos chamados).');
    if (sum.categories.length > 1) { const top3 = sum.categories.slice(0, 3).reduce((a, c) => a + c.share, 0); ins.push('As 3 principais categorias somam ' + Math.round(top3 * 100) + '% do volume.'); }
    if (sum.progress) {
      const p = sum.progress;
      ins.push(esc(p.label) + ': mediana ' + fmtNum(p.median) + ', média ' + fmtNum(p.mean) + ', 90% até ' + fmtNum(p.p90) + ' (máximo ' + fmtNum(p.max) + ').');
      const slow = sum.categories.filter(c => c.median !== null && c.count >= 3).sort((a, b) => b.median - a.median)[0];
      if (slow) ins.push('Maior ' + esc(p.label.toLowerCase()) + ' mediano: <b>' + esc(slow.name) + '</b> (' + fmtNum(slow.median) + ').');
      if (p.outliers) ins.push(p.outliers + ' chamado(s) acima do limite de 90% — vale revisar o registro deles.');
    }
    if (sum.duration) ins.push('Tempo registrado por chamado: mediana ' + fmtNum(sum.duration.median) + ' min, 90% até ' + fmtNum(sum.duration.p90) + ' min (máximo ' + sum.duration.max + ' min; total ' + Math.round(sum.duration.total / 60 * 10) / 10 + ' h).');
    if (sum.sla) ins.push('Pela data real de atendimento, <b>' + sum.sla.onTime + ' de ' + sum.sla.evaluated + '</b> ficaram dentro do prazo previsto.');
    if (sum.attendedBatch && sum.attendedBatch.share >= 0.3) ins.push('<b>' + Math.round(sum.attendedBatch.share * 100) + '%</b> das datas reais de atendimento caem no mesmo dia (' + esc(sum.attendedBatch.day) + '): indício de registro em lote no sistema, o que faz o prazo parecer estourado.');
    if (sum.daysToAttend) ins.push('Do registro ao atendimento registrado: mediana de ' + fmtNum(sum.daysToAttend.median) + ' dias (máximo ' + fmtNum(sum.daysToAttend.max) + ').');
    if (sum.daysToClose) ins.push('Do atendimento ao fechamento: mediana de ' + fmtNum(sum.daysToClose.median) + ' dias (entre ' + fmtNum(sum.daysToClose.min) + ' e ' + fmtNum(sum.daysToClose.max) + ').');
    if (sum.channels.length) ins.push('Canais: ' + sum.channels.map(([k, n]) => esc(k) + ' ' + Math.round(n / sum.total * 100) + '%').join(', ') + '.');
    if (sum.priorities.length === 1 && sum.slaLevels.length > 1) ins.push('A prioridade é a mesma em todos (' + esc(sum.priorities[0][0]) + '), mas o SLA varia (' + sum.slaLevels.map(([k, n]) => esc(k.replace(/^TJRR - /, '')) + ' ' + n).join(', ') + '): o prazo é definido pela categoria, não pela prioridade.');
    if (sum.subjects) ins.push(sum.subjects.distinct + ' assuntos diferentes em ' + sum.total + ' chamados' + (sum.subjects.generic ? '; ' + sum.subjects.generic + ' com assunto genérico (ex.: "Criado via Chatbot")' : '') + '.');
    for (const sp of sum.categorySpread) ins.push('Assuntos de <b>' + esc(sp.label) + '</b> (' + sp.count + ') estão espalhados em ' + sp.categories + ' categorias diferentes: classificação inconsistente.');
    if (sum.requesters) ins.push(sum.requesters.recurring + ' de ' + sum.requesters.distinct + ' solicitantes abriram 2 ou mais chamados (' + sum.requesters.recurringTickets + ' chamados, ' + Math.round(sum.requesters.recurringTickets / sum.total * 100) + '% do total); o mais recorrente abriu ' + sum.requesters.top + '.');
    if (!sum.quality) ins.push('O arquivo não traz descrição, comentários ou solução: a qualidade do registro não pode ser avaliada. Inclua essas colunas na exportação.');
    else ins.push(sum.quality.below80 + ' de ' + sum.quality.evaluated + ' registros com texto ficaram abaixo de 80% na avaliação por critérios.');
  }
  $('managerInsights').innerHTML = ins.map(x => '<li>' + x + '</li>').join('') || '<li class="muted">Os padrões aparecem após a análise.</li>';
  const q = norm($('managerSearch').value);
  const list = q ? rows.filter(r => norm(Object.values(r).join(' ')).includes(q)) : rows;
  const ctx = managerContext(sum);
  $('managerList').innerHTML = list.length ? list.slice(0, 200).map(r => {
    const m = ticketMetrics(r, ctx);
    const warn = m.flags.length && m.evaluated ? ' · ' + m.flags.length + ' alerta(s)' : '';
    return '<button type="button" class="item" data-ticket="' + rows.indexOf(r) + '"><span><b>' + esc([r.number, r.subject].filter(Boolean).join(' — ') || 'Sem número') + '</b><small>' + esc([r.category, r.duration && 'tempo ' + r.duration, r.progress && (state.managerProgressLabel || 'Progresso') + ' ' + r.progress].filter(Boolean).join(' · ') + warn) + '</small></span>' + (m.score !== null ? '<span class="score-tag ' + scoreBand(m.score) + '" title="Nota parcial: ' + m.evaluated + ' critério(s) avaliável(is)">' + m.score + '%</span>' : '<span class="score-tag" title="Sem textos no arquivo">—</span>') + '</button>';
  }).join('') + (list.length > 200 ? '<p class="muted small">Exibindo 200 de ' + list.length + '. Use a pesquisa para encontrar outros.</p>' : '') : rows.length ? emptyState('Nada encontrado', '') : '';
}
const TEXT_KEYS = ['description', 'comments', 'action', 'cause', 'test'];
function managerContext(sum) {
  return { fields: state.managerFields || new Set(), batchDay: sum.attendedBatch && sum.attendedBatch.share >= 0.3 ? sum.attendedBatch.day : null, progressIsSla: !!state.managerProgressIsSla };
}
function openTicket(index) {
  const r = state.managerRecords[index];
  if (!r) return;
  state.ticketIndex = index;
  const m = ticketMetrics(r, managerContext(summarizeTickets(state.managerRecords)));
  $('ticketTitle').textContent = [r.number, r.subject].filter(Boolean).join(' — ') || 'Chamado';
  const flagCls = f => f ? ' class="flag-' + f + '"' : '';
  const icon = { met: '✓', needs_review: '!', not_evidenced: '×', not_applicable: '–', not_exported: '·' };
  $('ticketBody').innerHTML =
    '<div class="ticket-score"><span class="score-pill" data-band="' + scoreBand(m.score) + '">' + (m.score === null ? '—' : m.score + '%') + '</span><span class="muted small">' + (m.score === null ? 'Sem nota: só ' + m.evaluated + ' critério(s) têm dados no arquivo (mínimo 3). Faltam os textos do chamado.' : 'Nota parcial com ' + m.evaluated + ' de 9 critérios (os demais não vieram no arquivo).') + '</span></div>'
    + (m.flags.length ? '<div class="callout warn"><b>Pontos de atenção</b><ul>' + m.flags.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></div>' : '')
    + (m.ops.length ? '<h3 class="sub">Indicadores operacionais</h3><dl class="kv">' + m.ops.map(o => '<div><dt>' + esc(o.label) + '</dt><dd' + flagCls(o.flag) + '>' + esc(o.value) + '</dd></div>').join('') + '</dl>' : '')
    + '<h3 class="sub">Critérios da pré-auditoria</h3><ul class="criteria">' + m.criteria.map(c => '<li><span class="st ' + c.status + '" aria-hidden="true">' + icon[c.status] + '</span><div><b>' + esc(c.label) + ' <span class="tag-st ' + c.status + '">' + esc(STATUS_LABELS[c.status]) + '</span></b>' + (c.status === 'not_evidenced' || c.status === 'needs_review' ? '<span class="muted">' + esc(c.recommendation) + '</span>' : '') + '</div></li>').join('') + '</ul>'
    + '<details class="sub-details"><summary>Dados do arquivo</summary><dl class="kv">' + Object.entries(r).filter(([, v]) => v).map(([k, v]) => '<div><dt>' + esc(FIELD_NAMES[k] || k) + '</dt><dd>' + esc(/At$/.test(k) ? fmtDate(v) : v) + '</dd></div>').join('') + '</dl></details>';
  const dlg = $('ticketDialog');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ticket]'); if (b) openTicket(+b.dataset.ticket); });
$('ticketDialog').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === $('ticketDialog')) $('ticketDialog').close(); });
$('ticketToAudit').addEventListener('click', async () => {
  const r = state.managerRecords[state.ticketIndex];
  if (!r) return;
  if (state.dirty && !(await confirmDialog('Há dados não salvos na pré-auditoria atual. Descartá-los?', { ok: 'Descartar' }))) return;
  $('ticketDialog').close();
  await resetAudit({ ask: false });
  fillForm({ ...r, location: r.location || [r.sector, r.room && 'Sala ' + r.room].filter(Boolean).join(' · '), solutionTime: r.attendedAt ? fmtDate(r.attendedAt) : '' });
  state.dirty = true;
  go('audit');
  openFields();
  evaluateLive();
  toast('Chamado carregado. Complete o comentário e os dados que faltam.');
});
const FIELD_NAMES = { channel: 'canal', ticketType: 'tipo de chamado', dueAt: 'atendimento previsto', attendedAt: 'atendimento real', duration: 'tempo', sla: 'SLA', impact: 'impacto', number: 'número', status: 'estado', openedAt: 'abertura', closedAt: 'encerramento', progress: 'progresso', priority: 'prioridade', category: 'categoria', subject: 'assunto', requester: 'solicitante', tech: 'técnico', building: 'prédio', sector: 'setor', room: 'sala', description: 'descrição', comments: 'comentários', cause: 'causa', test: 'teste', notes: 'pendências', action: 'solução' };
$('managerSearch').addEventListener('input', renderManager);
$('importManager').addEventListener('click', async () => {
  const file = $('managerFile').files[0];
  if (!file) { toast('Escolha um arquivo.'); return; }
  const btn = $('importManager');
  setBusy(btn, true);
  $('managerFeedback').textContent = 'Lendo ' + file.name + '…';
  try {
    const r = await readTicketFile(file);
    state.managerRecords = r.records;
    const has = f => r.mapping.some(m => m.field === f);
    state.managerProgressLabel = has('progress') && has('sla') ? '% do prazo do SLA' : r.mapping.find(m => m.field === 'progress')?.column || 'Progresso';
    state.managerFields = new Set(r.format === 'JSON' ? r.records.flatMap(x => Object.keys(x)) : r.mapping.map(m => m.field));
    state.managerProgressIsSla = has('progress') && has('sla');
    renderManager();
    $('managerFeedback').textContent = r.format + ': ' + r.records.length + ' chamados analisados nesta aba. Nada foi salvo ou enviado.';
    const map = $('managerMapping');
    map.classList.toggle('hidden', !r.mapping.length && !r.ignored.length);
    map.textContent = (r.mapping.length ? 'Colunas reconhecidas: ' + r.mapping.map(m => m.column + ' → ' + FIELD_NAMES[m.field]).join(', ') + '.' : '') + (r.ignored.length ? ' Ignoradas: ' + r.ignored.join(', ') + '.' : '');
    toast(r.records.length + ' chamados analisados.');
  } catch (err) {
    $('managerFeedback').textContent = 'Não foi possível ler o arquivo: ' + (err instanceof SyntaxError ? 'o JSON é inválido.' : err.message);
    toast('Falha ao ler o arquivo.', 'error');
  } finally { setBusy(btn, false); }
});
$('clearManager').addEventListener('click', () => { state.managerRecords = []; $('managerFile').value = ''; $('managerMapping').classList.add('hidden'); $('managerFeedback').textContent = 'Conjunto removido da memória desta aba.'; renderManager(); });

/* ================= Configurações: IA ================= */

const AI_CHIP_TEXT = { idle: 'Aguardando configuração', keyed: 'Chave informada · não testada', working: 'Testando conexão…', ok: 'Conectado', manual: 'Modelo manual', error: 'Falha' };
function updateAiChip(kind, text) {
  const chip = $('aiStateChip');
  chip.dataset.state = kind === 'keyed' || kind === 'idle' ? 'idle' : kind === 'manual' ? 'warn' : kind;
  chip.textContent = text || AI_CHIP_TEXT[kind];
}

function aiPrefsFor(p) { return state.ai.prefs[p] || {}; }
async function saveAiPrefs() {
  state.ai.prefs[state.ai.provider] = { model: state.ai.model, manualModel: state.ai.manualModel, customBase: state.ai.customBase };
  if (state.db) await store.putSetting(state.db, 'aiPrefs', { last: state.ai.provider, byProvider: state.ai.prefs }).catch(() => {});
}

function resetModelSelect(message = 'Teste a conexão para listar modelos') {
  $('geminiModel').innerHTML = '<option value="">' + esc(message) + '</option>';
  $('geminiModel').disabled = true;
  state.ai.models = [];
  state.ai.connected = false;
}

function applyProvider(provider) {
  state.ai.provider = provider;
  const prefs = aiPrefsFor(provider);
  state.ai.model = prefs.model || '';
  state.ai.manualModel = prefs.manualModel || '';
  state.ai.customBase = prefs.customBase || '';
  $('aiProvider').value = provider;
  $('manualModel').value = state.ai.manualModel;
  $('customBase').value = state.ai.customBase;
  $('customBaseWrap').classList.toggle('hidden', provider !== 'custom');
  $('providerNote').textContent = 'Acesso pelo navegador: ' + PROVIDERS[provider].browserAccess;
  resetModelSelect(state.ai.model ? 'Último escolhido: ' + state.ai.model + ' — teste para confirmar' : undefined);
  setStatus($('aiStatus'), 'idle', state.ai.key ? 'Chave informada. Teste a conexão para listar os modelos.' : 'Cole a chave do provedor e teste a conexão.');
  updateAiChip(state.ai.key ? (state.ai.manualModel ? 'manual' : 'keyed') : 'idle');
}

$('aiProvider').addEventListener('change', () => { applyProvider($('aiProvider').value); saveAiPrefs(); });
$('geminiKey').addEventListener('input', e => {
  state.ai.key = e.target.value.trim();
  state.ai.connected = false;
  updateAiChip(state.ai.key ? (state.ai.manualModel ? 'manual' : 'keyed') : 'idle');
  setStatus($('aiStatus'), 'idle', state.ai.key ? 'Chave informada. Teste a conexão para listar os modelos.' : 'Cole a chave do provedor e teste a conexão.');
});
$('toggleKey').addEventListener('click', () => {
  const show = $('geminiKey').type === 'password';
  $('geminiKey').type = show ? 'text' : 'password';
  $('toggleKey').textContent = show ? 'Ocultar' : 'Mostrar';
  $('toggleKey').setAttribute('aria-pressed', String(show));
});
$('customBase').addEventListener('change', e => { state.ai.customBase = e.target.value.trim(); resetModelSelect(); saveAiPrefs(); });
$('geminiModel').addEventListener('change', () => {
  state.ai.model = $('geminiModel').value;
  saveAiPrefs();
  setStatus($('aiStatus'), 'ok', 'Modelo selecionado: ' + state.ai.model + '. Ele será usado em todas as gerações desta sessão.');
  updateAiChip('ok');
});
$('manualModel').addEventListener('change', () => {
  state.ai.manualModel = normalizeModelId($('manualModel').value);
  $('manualModel').value = state.ai.manualModel;
  saveAiPrefs();
  if (state.ai.manualModel) {
    setStatus($('aiStatus'), 'warn', 'Modelo manual “' + state.ai.manualModel + '” definido. Ele tem prioridade sobre a lista e será validado na primeira geração.');
    updateAiChip('manual');
  } else {
    setStatus($('aiStatus'), state.ai.connected ? 'ok' : 'idle', state.ai.connected ? 'Usando o modelo da lista: ' + state.ai.model + '.' : 'Teste a conexão para listar os modelos.');
    updateAiChip(state.ai.connected ? 'ok' : state.ai.key ? 'keyed' : 'idle');
  }
});
$('clearGemini').addEventListener('click', () => {
  state.ai.key = '';
  $('geminiKey').value = '';
  resetModelSelect();
  updateAiChip('idle');
  setStatus($('aiStatus'), 'idle', 'Chave removida da memória desta aba.');
  toast('Chave removida da memória desta aba.');
});

$('testGemini').addEventListener('click', async () => {
  if (!state.ai.key) { toast('Cole a chave do provedor.'); $('geminiKey').focus(); return; }
  state.ai.customBase = $('customBase').value.trim();
  const btn = $('testGemini');
  setBusy(btn, true);
  updateAiChip('working', 'Testando conexão…');
  setStatus($('aiStatus'), 'working', 'Testando conexão e identificando modelos disponíveis…');
  try {
    const r = await testProviderConnection(state.ai.provider, state.ai.key, state.ai.customBase, { preferredModel: state.ai.model });
    state.ai.models = r.models;
    state.ai.model = r.selectedModel;
    state.ai.connected = true;
    const sel = $('geminiModel');
    sel.innerHTML = r.models.map(m => '<option value="' + esc(m) + '">' + esc(m) + (m === r.recommendedModel ? ' (recomendado)' : '') + '</option>').join('');
    sel.disabled = false;
    sel.value = r.selectedModel;
    await saveAiPrefs();
    const how = r.preferredKept ? 'mantido o modelo escolhido anteriormente' : 'selecionado o recomendado';
    setStatus($('aiStatus'), 'ok', 'Chave aceita. ' + r.models.length + ' modelo(s) de texto identificado(s); ' + how + ': ' + r.selectedModel + '.' + (state.ai.manualModel ? ' Atenção: o modelo manual “' + state.ai.manualModel + '” continua com prioridade; apague-o para usar a lista.' : ''));
    updateAiChip(state.ai.manualModel ? 'manual' : 'ok', state.ai.manualModel ? 'Modelo manual' : 'Conectado');
    toast('Conexão confirmada.');
  } catch (err) {
    const e = describeError(err);
    resetModelSelect(e.code === 'no_discovery' ? 'Lista indisponível — use o campo manual' : undefined);
    const label = { auth: 'Falha na autenticação', permission: 'Sem permissão', model: 'Modelo indisponível', network: navigator.onLine === false ? 'Sem internet' : 'Conexão ou CORS', quota: 'Cota atingida', timeout: 'Tempo esgotado', no_discovery: 'Sem lista de modelos', no_models: 'Nenhum modelo' }[e.code] || 'Falha';
    updateAiChip(e.code === 'no_discovery' ? 'manual' : 'error', label);
    setStatus($('aiStatus'), e.code === 'no_discovery' ? 'warn' : 'error', e.message, e.detail);
    if (e.code === 'no_discovery') $('manualModel').focus();
  } finally { setBusy(btn, false); }
});

$('draftSignature').addEventListener('change', async () => {
  state.signature = $('draftSignature').value.trim() || DEFAULT_SIGNATURE;
  $('draftSignature').value = state.signature;
  if (state.db) await store.putSetting(state.db, 'signature', state.signature).catch(() => {});
  toast('Assinatura salva.');
});

/* ================= Configurações: dados e critérios ================= */

async function renderSettingsInfo() {
  const info = $('storageInfo');
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    info.textContent = state.items.length + ' análise(s) salvas.' + (est ? ' Uso aproximado: ' + (est.usage / 1024).toFixed(0) + ' KB.' : '') + (persisted ? ' Dados protegidos contra limpeza automática.' : ' O navegador pode apagar os dados em caso de pouco espaço; exporte backups regularmente.');
    $('persistStorage').classList.toggle('hidden', !!persisted || !navigator.storage?.persist);
  } catch { info.textContent = state.items.length + ' análise(s) salvas.'; }
  const off = $('offlineInfo');
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) off.textContent = 'Indisponível neste modo de abertura. Acesse pelo endereço publicado (HTTPS).';
  else {
    const keys = await caches.keys().catch(() => []);
    const ready = !!navigator.serviceWorker.controller && keys.some(k => k.startsWith('regua-shell-'));
    off.textContent = ready ? 'Pronto: a aplicação abre sem internet, e a pré-auditoria, o texto padrão, o histórico e as exportações funcionam offline. A IA exige internet.' : 'Preparando o cache. Após este primeiro carregamento, a Régua passa a abrir sem internet.';
  }
  $('criteriaTable').innerHTML = '<table><thead><tr><th>Critério</th><th>Dimensão</th><th>Peso</th></tr></thead><tbody>' + DEFAULT_CRITERIA.map(c => '<tr><td>' + esc(c.label) + '</td><td>' + esc(DIMENSION_LABELS[c.dimension]) + '</td><td>' + c.weight + '</td></tr>').join('') + '</tbody></table>';
}
$('persistStorage').addEventListener('click', async () => {
  const ok = await navigator.storage?.persist?.().catch(() => false);
  toast(ok ? 'Dados protegidos contra limpeza automática.' : 'O navegador não concedeu a proteção. Continue exportando backups.');
  renderSettingsInfo();
});

$('proposeCriteria').addEventListener('click', async () => {
  if (!state.ai.key || !effectiveModel()) { toast('Configure e teste a IA primeiro.'); return; }
  const btn = $('proposeCriteria'), box = $('criteriaProposal');
  setBusy(btn, true);
  try {
    const r = await proposeCriteriaConfiguration(state.ai.key, effectiveModel(), $('criteriaContext').value.trim(), state.ai.provider, state.ai.customBase, DEFAULT_CRITERIA);
    box.classList.remove('hidden');
    box.innerHTML = '<b>Proposta da IA — não aplicada</b><p class="muted small">Revise com a gestão. Critérios oficiais só mudam após aprovação, testes e versionamento.</p><pre>' + esc(JSON.stringify(r, null, 2)) + '</pre>';
  } catch (err) {
    const e = describeError(err);
    box.classList.remove('hidden');
    box.innerHTML = '<b>Falha na proposta.</b> ' + esc(e.message) + (e.detail ? '<br><span class="muted small">Detalhe técnico: ' + esc(e.detail) + '</span>' : '');
  } finally { setBusy(btn, false); }
});

/* ================= Inicialização ================= */

async function init() {
  applyTheme(themePref());
  updateNetwork();
  renderEvaluation(evaluateQuality({}), { empty: true });
  renderSummary({});
  $('appVersion').textContent = APP_VERSION;
  $('draftSignature').value = state.signature;
  applyProvider('gemini');
  registerServiceWorker();
  await loadMaptec();
  try {
    state.db = await store.openDatabase();
    const [items, folder, signature, prefs] = await Promise.all([
      store.listAudits(state.db), store.getSetting(state.db, 'localFolder'), store.getSetting(state.db, 'signature'), store.getSetting(state.db, 'aiPrefs')
    ]);
    state.items = items;
    if (folder) { state.localFolder = folder; $('folderStatus').classList.remove('hidden'); $('folderStatus').textContent = 'Pasta configurada: ' + folder.name + '. A permissão será confirmada ao salvar.'; }
    if (signature) { state.signature = signature; $('draftSignature').value = signature; }
    if (prefs?.byProvider) { state.ai.prefs = prefs.byProvider; applyProvider(PROVIDERS[prefs.last] ? prefs.last : 'gemini'); }
  } catch (err) {
    console.error(err);
    toast('Não foi possível abrir o armazenamento local (' + (err?.message || err) + '). As análises não serão salvas nesta sessão.', 'error');
  }
  renderHome();
  renderManager();
  const initial = location.hash.slice(1);
  go(PAGE_TITLES[initial] ? initial : 'home', { focus: false });
}

init();
