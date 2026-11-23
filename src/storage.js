// Persistência local da Régua (IndexedDB) e validação de backups.
// As funções de validação são puras para poderem ser testadas sem navegador.

export const DB_NAME = 'regua-preauditoria';
export const DB_VERSION = 2;
export const BACKUP_FORMAT = { product: 'Regua', version: 2 };
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_ITEMS = 5000;

export const RECORD_TEXT_FIELDS = ['number', 'requester', 'tech', 'building', 'location', 'solutionTime', 'subject', 'description', 'assetType', 'asset', 'comments', 'cause', 'action', 'test', 'notes'];
const MAX_FIELD = 20000;

/* ---------- IndexedDB ---------- */

export function openDatabase(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error('IndexedDB indisponível neste navegador.')); return; }
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('audits')) db.createObjectStore('audits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Outra aba da Régua está bloqueando a atualização do banco local. Feche as outras abas e recarregue.'));
  });
}

// Resolve somente quando a transação é efetivamente gravada (oncomplete), evitando perda silenciosa.
function tx(db, store, mode, work) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transação cancelada.'));
    const r = work(t.objectStore(store));
    if (r) r.onsuccess = () => { result = r.result; };
  });
}

export const listAudits = db => tx(db, 'audits', 'readonly', s => s.getAll()).then(r => r || []);
export const saveAudit = (db, record) => tx(db, 'audits', 'readwrite', s => s.put(record));
export const deleteAudit = (db, id) => tx(db, 'audits', 'readwrite', s => s.delete(id));
export const clearAudits = db => tx(db, 'audits', 'readwrite', s => s.clear());
export const getSetting = (db, key) => tx(db, 'settings', 'readonly', s => s.get(key));
export const putSetting = (db, key, value) => tx(db, 'settings', 'readwrite', s => s.put(value, key));

export function saveMany(db, records) {
  return new Promise((resolve, reject) => {
    const t = db.transaction('audits', 'readwrite');
    const store = t.objectStore('audits');
    for (const r of records) store.put(r);
    t.oncomplete = () => resolve(records.length);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Importação cancelada; nenhum registro foi gravado.'));
  });
}

/* ---------- Backup ---------- */

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function buildBackup(items, appVersion = '') {
  return { ...BACKUP_FORMAT, appVersion, exportedAt: new Date().toISOString(), count: items.length, items };
}

const validDate = v => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());

/** Normaliza um registro importado. Retorna null quando não é aproveitável. */
export function sanitizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const k of RECORD_TEXT_FIELDS) {
    const v = raw[k];
    out[k] = v === undefined || v === null ? '' : String(v).slice(0, MAX_FIELD);
  }
  if (!out.subject && !out.description && !out.number) return null;
  out.id = typeof raw.id === 'string' && raw.id.trim() && raw.id.length <= 100 ? raw.id.trim() : makeId();
  out.createdAt = validDate(raw.createdAt) ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
  if (validDate(raw.updatedAt)) out.updatedAt = new Date(raw.updatedAt).toISOString();
  out.closureConfirmed = raw.closureConfirmed === true;
  if (typeof raw.draft === 'string') out.draft = raw.draft.slice(0, MAX_FIELD);
  const score = Number(raw.result?.score);
  out.result = raw.result && typeof raw.result === 'object' ? { ...raw.result } : {};
  out.result.score = Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : null;
  if (raw.locationMatch && typeof raw.locationMatch === 'object') out.locationMatch = raw.locationMatch;
  return out;
}

/**
 * Valida o conteúdo de um backup ANTES de qualquer gravação.
 * Aceita o formato atual ({product, items}), o formato v1 e um array simples.
 */
export function parseBackup(text, existingIds = new Set()) {
  const errors = [];
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['O arquivo está vazio.'] };
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['O arquivo excede 10 MB.'] };
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, errors: ['O arquivo não é um JSON válido.'] }; }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
  if (!list) return { ok: false, errors: ['Formato não reconhecido: esperado um backup da Régua com o campo "items".'] };
  if (parsed && !Array.isArray(parsed) && parsed.product && parsed.product !== 'Regua') errors.push('O arquivo indica outro produto: ' + String(parsed.product).slice(0, 40) + '.');
  if (list.length > MAX_BACKUP_ITEMS) return { ok: false, errors: ['O backup possui mais de ' + MAX_BACKUP_ITEMS + ' registros.'] };
  const fresh = [], duplicates = [], seen = new Set();
  let invalid = 0;
  for (const raw of list) {
    const rec = sanitizeRecord(raw);
    if (!rec) { invalid++; continue; }
    if (seen.has(rec.id) || existingIds.has(rec.id)) { duplicates.push(rec.id); continue; }
    seen.add(rec.id);
    fresh.push(rec);
  }
  return { ok: errors.length === 0, errors, records: fresh, total: list.length, invalid, duplicates: duplicates.length };
}
