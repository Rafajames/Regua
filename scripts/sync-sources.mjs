import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const SOURCES = [
  { id: 'maptec', urlKey: 'REGUA_MAPTEC_API_URL', tokenKey: 'REGUA_MAPTEC_API_TOKEN' },
  { id: 'patrimonio', urlKey: 'REGUA_PATRIMONIO_API_URL', tokenKey: 'REGUA_PATRIMONIO_API_TOKEN' }
];
const timeoutMs = Number(process.env.REGUA_SYNC_TIMEOUT_MS || 15000);
const maxBytes = Number(process.env.REGUA_SYNC_MAX_BYTES || 5_000_000);

function safeEndpoint(raw) {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('A API deve usar HTTPS.');
  return url;
}
async function fetchSource(source) {
  const endpoint = safeEndpoint(process.env[source.urlKey]);
  if (!endpoint) return { source: source.id, status: 'not_configured', count: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: 'application/json' };
    const token = process.env[source.tokenKey];
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, { headers, signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error('A API não retornou application/json.');
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('Resposta excede o limite configurado.');
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : parsed?.data;
    if (!Array.isArray(records)) throw new Error('Contrato inválido: esperado array JSON ou objeto com data[].');
    if (records.length > 250000) throw new Error('Quantidade de registros acima do limite de segurança.');
    // Não persistir payload bruto: ele pode conter dados pessoais ou campos não autorizados.
    return {
      source: source.id,
      status: 'validated',
      count: records.length,
      generatedAt: parsed?.meta?.generatedAt || null,
      version: parsed?.meta?.version || null,
      sampleKeys: records[0] && typeof records[0] === 'object' ? Object.keys(records[0]).slice(0, 30) : []
    };
  } finally {
    clearTimeout(timer);
  }
}
const startedAt = new Date().toISOString();
const results = await Promise.all(SOURCES.map(async source => {
  try { return await fetchSource(source); }
  catch (error) { return { source: source.id, status: 'error', error: String(error.message || error).slice(0, 240), count: null }; }
}));
const report = {
  schemaVersion: 1,
  startedAt,
  finishedAt: new Date().toISOString(),
  timezone: 'America/Boa_Vista',
  results
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/sync-report.json', JSON.stringify(report, null, 2) + '\n');
for (const item of results) console.log(`[${item.source}] ${item.status}${item.count === null ? '' : ` — ${item.count} registros`}`);
if (results.some(x => x.status === 'error')) process.exitCode = 1;
