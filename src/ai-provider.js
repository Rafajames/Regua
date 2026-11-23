// Integração com provedores de IA acessados diretamente pelo navegador.
// A chave nunca é armazenada por este módulo: chega por parâmetro e segue apenas para o provedor.

import { DEFAULT_SIGNATURE, SATISFACTION_SURVEY, checkClosureClaims, greetingFor } from './draft-template.js';

export const PROVIDERS = {
  gemini: { label: 'Google Gemini', kind: 'gemini', discovery: true, browserAccess: 'Permitido (CORS liberado pela API).' },
  openai: { label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', discovery: true, browserAccess: 'Permitido; a OpenAI desaconselha expor chaves no navegador em produção.' },
  claude: { label: 'Anthropic Claude', kind: 'anthropic', discovery: true, browserAccess: 'Permitido somente com o cabeçalho anthropic-dangerous-direct-browser-access.' },
  grok: { label: 'xAI Grok', kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1', discovery: true, browserAccess: 'Depende da política de CORS da xAI; se o navegador bloquear, será exibido erro de CORS.' },
  custom: { label: 'API compatível com OpenAI', kind: 'openai-compatible', discovery: 'optional', browserAccess: 'Depende do servidor informado liberar CORS para rafajames.github.io.' }
};

export const ERROR_MESSAGES = {
  config: 'Configuração incompleta.',
  auth: 'A chave foi recusada pelo provedor. Confira se ela está correta, ativa e pertence ao provedor escolhido.',
  permission: 'A chave não tem permissão para este recurso ou modelo.',
  model: 'O modelo selecionado não está disponível para esta chave. Teste a conexão novamente e escolha outro modelo da lista.',
  quota: 'Limite de uso ou cota do provedor atingido. Aguarde alguns minutos ou verifique o plano da conta.',
  network: 'Não foi possível contatar o provedor. Verifique a internet. Se ela estiver funcionando, o provedor pode estar bloqueando chamadas feitas diretamente do navegador (CORS).',
  timeout: 'O provedor demorou demais para responder. Tente novamente; se persistir, escolha um modelo mais rápido.',
  server: 'O modelo está sobrecarregado ou instável no provedor (alta demanda). A Régua tentou novamente e não conseguiu. Aguarde alguns minutos ou escolha outro modelo em Configurações.',
  blocked: 'O provedor bloqueou a resposta pela política de segurança de conteúdo. Revise o texto enviado.',
  invalid_response: 'A IA respondeu em um formato inesperado. Tente novamente ou escolha outro modelo.',
  no_discovery: 'Este provedor não informou a lista de modelos. Digite manualmente o identificador do modelo indicado na documentação dele.',
  no_models: 'A chave foi aceita, mas nenhum modelo de texto compatível foi encontrado.',
  bad_request: 'O provedor recusou a requisição.'
};

export class AIError extends Error {
  constructor(code, message, detail = '') {
    super(message || ERROR_MESSAGES[code] || 'Falha na comunicação com a IA.');
    this.name = 'AIError';
    this.code = code;
    this.detail = detail;
  }
}

const scrub = (text, key) => {
  let out = String(text || '').slice(0, 300);
  if (key && key.length > 6) out = out.split(key).join('[chave ocultada]');
  return out;
};

function providerMessage(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.error === 'string') return body.error;
  return body.error?.message || body.error?.type || body.message || '';
}

// Lê os detalhes estruturados de cota do Google (QuotaFailure / RetryInfo).
export function parseQuotaDetails(details) {
  if (!Array.isArray(details)) return null;
  const info = { scope: null, model: '', limit: null, retryAfterSec: null, freeTier: false };
  for (const d of details) {
    const type = String(d?.['@type'] || '');
    if (type.endsWith('QuotaFailure')) {
      for (const v of d.violations || []) {
        const id = String(v.quotaId || '') + ' ' + String(v.quotaMetric || '');
        if (/PerDay/i.test(id)) info.scope = 'day';
        else if (!info.scope && /PerMinute/i.test(id)) info.scope = 'minute';
        if (/free_?tier/i.test(id)) info.freeTier = true;
        if (v.quotaDimensions?.model) info.model = v.quotaDimensions.model;
        if (v.quotaValue !== undefined && info.limit === null) info.limit = Number(v.quotaValue);
      }
    }
    if (type.endsWith('RetryInfo') && d.retryDelay) {
      const sec = parseFloat(String(d.retryDelay));
      if (Number.isFinite(sec)) info.retryAfterSec = Math.ceil(sec);
    }
  }
  return info.scope || info.model || info.retryAfterSec !== null ? info : null;
}

function quotaMessage(q, fallbackModel = '') {
  const model = q?.model || fallbackModel;
  const m = model ? ' para o modelo ' + model : '';
  if (q?.limit === 0) return 'Sua chave não tem cota' + (q.freeTier ? ' gratuita' : '') + m + '. Escolha outro modelo em Configurações ou ative o faturamento no Google AI Studio.';
  if (q?.scope === 'day') return 'O limite diário da sua chave' + m + ' foi atingido' + (q.limit ? ' (' + q.limit + ' pedidos por dia)' : '') + '. Ele é renovado a cada dia. Enquanto isso, escolha outro modelo em Configurações — cada modelo tem cota própria.';
  if (q?.scope === 'minute' || q?.retryAfterSec) return 'Limite de pedidos por minuto atingido' + m + '. Tente novamente' + (q.retryAfterSec ? ' em cerca de ' + q.retryAfterSec + ' segundos' : ' em instantes') + '.';
  return ERROR_MESSAGES.quota;
}

export function classifyHttpError(status, detail = '', key = '', details = null) {
  const msg = String(detail || '');
  const safe = scrub(msg, key);
  if (/api key not valid|invalid api key|incorrect api key|invalid x-api-key|invalid_api_key|authentication|unauthori[sz]ed|API_KEY_INVALID/i.test(msg) || status === 401) return new AIError('auth', ERROR_MESSAGES.auth, safe);
  if (/no longer available|not found for api version|is not found|does not exist|model_not_found|not supported for generatecontent|deprecated|unknown model|invalid model/i.test(msg) || status === 404) return new AIError('model', ERROR_MESSAGES.model, safe);
  if (status === 403) return new AIError('permission', ERROR_MESSAGES.permission, safe);
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(msg)) {
    const q = parseQuotaDetails(details);
    const err = new AIError('quota', quotaMessage(q), safe);
    err.quota = q;
    return err;
  }
  if (status >= 500) return new AIError('server', ERROR_MESSAGES.server, safe);
  return new AIError('bad_request', ERROR_MESSAGES.bad_request + (safe ? ' Detalhe: ' + safe : ''), safe);
}

async function request(url, options, { key = '', timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new AIError('timeout', ERROR_MESSAGES.timeout);
    throw new AIError('network', ERROR_MESSAGES.network, scrub(err?.message || err, key));
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw classifyHttpError(response.status, providerMessage(body), key, body?.error?.details);
  return body;
}

export function parseJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { /* tenta extrair o objeto */ }
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* segue para o erro */ }
  }
  throw new AIError('invalid_response', ERROR_MESSAGES.invalid_response, text.slice(0, 160));
}

/* ---------- Identificação e ordenação de modelos ---------- */

export const normalizeModelId = id => String(id || '').trim().replace(/^models\//, '');

const GEMINI_EXCLUDE = /(embedding|aqa|imagen|veo|tts|audio|live|image|robotics|computer-use|omni|learnlm)/i;

function geminiRank(id) {
  if (id === 'gemini-3.8-flash') return [0, 0, 0, id];
  const m = id.match(/^gemini-(\d+(?:\.\d+)?)-(flash|pro)(-lite)?(.*)$/i);
  if (!m) return [/^gemini-/i.test(id) ? 3 : 4, 0, 0, id];
  const version = Number(m[1]);
  const unstable = /preview|exp|latest|\d{2}-\d{2}/i.test(m[4] || '') ? 1 : 0;
  const family = m[2].toLowerCase() === 'flash' ? (m[3] ? 1 : 0) : 2; // flash > flash-lite > pro (custo/latência)
  return [1 + unstable, -version, family, id];
}

function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function rankGeminiModels(models) {
  return [...new Set(models.map(normalizeModelId))]
    .filter(id => id && !GEMINI_EXCLUDE.test(id))
    .sort((a, b) => compareRank(geminiRank(a), geminiRank(b)));
}

const OPENAI_EXCLUDE = /(audio|realtime|transcribe|tts|image|dall-e|whisper|embedding|moderation|search|instruct|codex|babbage|davinci|computer-use|sora)/i;
const GROK_EXCLUDE = /(image|imagine|video|embed|vision-beta)/i;

function openAiRank(id) {
  const m = id.match(/^(?:gpt-|o)(\d+(?:\.\d+)?)/i);
  const version = m ? Number(m[1]) : 0;
  const dated = /-\d{4}-\d{2}-\d{2}$|-\d{4}$/.test(id) ? 1 : 0;
  return [-version, dated, id.length, id];
}

export function filterChatModels(provider, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (provider === 'openai') {
    return unique.filter(id => /^(gpt-|o\d|chatgpt-)/i.test(id) && !OPENAI_EXCLUDE.test(id)).sort((a, b) => compareRank(openAiRank(a), openAiRank(b)));
  }
  if (provider === 'grok') return unique.filter(id => !GROK_EXCLUDE.test(id)).sort((a, b) => compareRank(openAiRank(a), openAiRank(b)));
  return unique;
}

function baseUrlFor(provider, customBase = '') {
  if (provider === 'custom') {
    const raw = String(customBase || '').trim().replace(/\/+$/, '');
    if (!raw) throw new AIError('config', 'Informe a URL base da API compatível (ex.: https://servidor/v1).');
    let url;
    try { url = new URL(raw); } catch { throw new AIError('config', 'A URL base informada não é válida.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new AIError('config', 'Use HTTPS na URL base (HTTP só é aceito para localhost).');
    return raw;
  }
  return PROVIDERS[provider]?.baseUrl || 'https://api.openai.com/v1';
}

async function geminiModels(key) {
  const ids = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const body = await request(url, { headers: { 'x-goog-api-key': key } }, { key, timeoutMs: 20000 });
    for (const m of body.models || []) {
      if ((m.supportedGenerationMethods || []).includes('generateContent')) ids.push(m.name);
    }
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  return rankGeminiModels(ids);
}

async function anthropicModels(key) {
  const body = await request('https://api.anthropic.com/v1/models?limit=100', { headers: anthropicHeaders(key) }, { key, timeoutMs: 20000 });
  return (body.data || []).map(x => x.id).filter(Boolean);
}

async function openAiCompatibleModels(provider, key, customBase) {
  const base = baseUrlFor(provider, customBase);
  try {
    const body = await request(base + '/models', { headers: { Authorization: 'Bearer ' + key } }, { key, timeoutMs: 20000 });
    return filterChatModels(provider, (body.data || []).map(x => x.id));
  } catch (err) {
    if (provider === 'custom' && err.code === 'model') throw new AIError('no_discovery', ERROR_MESSAGES.no_discovery, err.detail);
    throw err;
  }
}

export async function discoverModels(provider, key, customBase = '') {
  const k = String(key || '').trim();
  if (!PROVIDERS[provider]) throw new AIError('config', 'Provedor desconhecido.');
  if (!k) throw new AIError('config', 'Informe a chave de API.');
  if (provider === 'gemini') return geminiModels(k);
  if (provider === 'claude') return anthropicModels(k);
  return openAiCompatibleModels(provider, k, customBase);
}

/**
 * Valida a chave consultando o catálogo de modelos.
 * preferredModel: modelo escolhido anteriormente pelo usuário; é mantido se continuar disponível.
 */
export async function testProviderConnection(provider, key, customBase = '', { preferredModel = '' } = {}) {
  const models = await discoverModels(provider, key, customBase);
  if (!models.length) throw new AIError('no_models', ERROR_MESSAGES.no_models);
  const preferred = normalizeModelId(preferredModel);
  const selectedModel = preferred && models.includes(preferred) ? preferred : models[0];
  return { models, selectedModel, recommendedModel: models[0], preferredKept: selectedModel === preferred && !!preferred };
}

/* ---------- Geração ---------- */

function anthropicHeaders(key) {
  return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
}

const isGemini3OrLater = id => {
  const m = String(id).match(/^gemini-(\d+)/i);
  return m ? Number(m[1]) >= 3 : false;
};

async function generateGemini(key, model, system, prompt) {
  const id = normalizeModelId(model);
  const generationConfig = { responseMimeType: 'application/json' };
  // Família Gemini 3: o Google recomenda manter a temperatura padrão.
  if (!isGemini3OrLater(id)) generationConfig.temperature = 0.2;
  const body = await request('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(id) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    })
  }, { key });
  if (body?.promptFeedback?.blockReason) throw new AIError('blocked', ERROR_MESSAGES.blocked, body.promptFeedback.blockReason);
  const candidate = body?.candidates?.[0];
  if (!candidate) throw new AIError('invalid_response', ERROR_MESSAGES.invalid_response, 'Resposta sem candidatos.');
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') throw new AIError('blocked', ERROR_MESSAGES.blocked, candidate.finishReason);
  const text = (candidate.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('\n');
  if (!text.trim()) throw new AIError('invalid_response', ERROR_MESSAGES.invalid_response, 'Resposta vazia' + (candidate.finishReason ? ' (' + candidate.finishReason + ')' : '') + '.');
  return parseJson(text);
}

async function generateClaude(key, model, system, prompt) {
  const body = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...anthropicHeaders(key) },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: prompt }] })
  }, { key });
  if (body.stop_reason === 'refusal') throw new AIError('blocked', ERROR_MESSAGES.blocked, 'refusal');
  return parseJson((body.content || []).filter(x => x.type === 'text').map(x => x.text || '').join('\n'));
}

async function generateOpenAiCompatible(provider, key, model, system, prompt, customBase) {
  const base = baseUrlFor(provider, customBase);
  const payload = { model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  // Alguns modelos (ex.: modelos de raciocínio) recusam temperature ou response_format.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await request(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify(payload)
      }, { key });
      const content = body?.choices?.[0]?.message?.content;
      if (!content) throw new AIError('invalid_response', ERROR_MESSAGES.invalid_response, 'Resposta sem conteúdo.');
      return parseJson(content);
    } catch (err) {
      if (err.code !== 'bad_request') throw err;
      if (/temperature/i.test(err.detail) && 'temperature' in payload) { delete payload.temperature; continue; }
      if (/response_format|json_object/i.test(err.detail) && 'response_format' in payload) { delete payload.response_format; continue; }
      throw err;
    }
  }
  throw new AIError('bad_request', ERROR_MESSAGES.bad_request);
}

async function generateOnce(provider, key, id, prompt, customBase, system) {
  if (provider === 'gemini') return generateGemini(key, id, system, prompt);
  if (provider === 'claude') return generateClaude(key, id, system, prompt);
  return generateOpenAiCompatible(provider, key, id, system, prompt, customBase);
}

// Esperas entre novas tentativas quando o provedor está sobrecarregado (HTTP 5xx / "high demand").
let RETRY_DELAYS = [1500, 4000];
export function setRetryDelays(delays) { RETRY_DELAYS = delays; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isOverload = err => err?.code === 'server' || (err?.code === 'quota' && /high demand|overload/i.test(err.detail || ''));
const isQuota = err => err?.code === 'quota' && !isOverload(err);

/**
 * Gera com o modelo escolhido; em sobrecarga, tenta de novo e depois usa os modelos reserva.
 * Retorna { result, modelUsed, fallbackUsed }.
 */
async function generate(provider, key, model, prompt, customBase, system, { fallbacks = [], onProgress } = {}) {
  const k = String(key || '').trim();
  const id = normalizeModelId(model);
  if (!k) throw new AIError('config', 'Informe uma chave de API e teste a conexão.');
  if (!id) throw new AIError('config', 'Selecione ou digite um modelo antes de gerar.');
  const chain = [...new Set([id, ...fallbacks.map(normalizeModelId).filter(Boolean)])].slice(0, 3);
  let lastError, firstQuotaError;
  for (const [index, current] of chain.entries()) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const result = await generateOnce(provider, k, current, prompt, customBase, system);
        return { result, modelUsed: current, fallbackUsed: index > 0 };
      } catch (err) {
        lastError = err;
        if (isQuota(err)) {
          // A cota é por modelo: não repete o mesmo modelo, passa para o próximo.
          if (!firstQuotaError) { firstQuotaError = err; if (!err.quota?.model) err.message = quotaMessage(err.quota, current); }
          break;
        }
        if (!isOverload(err)) throw err;
        if (attempt < RETRY_DELAYS.length) {
          onProgress?.(`${current} sobrecarregado; nova tentativa ${attempt + 2} de ${RETRY_DELAYS.length + 1}…`);
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }
    if (chain[index + 1]) onProgress?.(`${current} ${isQuota(lastError) ? 'sem cota disponível' : 'continua sobrecarregado'}; tentando ${chain[index + 1]}…`);
  }
  if (firstQuotaError) {
    if (chain.length > 1) firstQuotaError.message += ' Também foram tentados os modelos reserva (' + chain.slice(1).join(', ') + '), sem sucesso.';
    throw firstQuotaError;
  }
  throw new AIError('server', ERROR_MESSAGES.server, lastError?.detail || '');
}

/* ---------- Tarefas ---------- */

export const REFERENCE_TEMPLATE = `Prezado(a) Sr(a), {saudacao}!

Conforme solicitado, o seguinte procedimento foi realizado:

{procedimentos realizados}

Sendo assim, encerro o chamado.

${SATISFACTION_SURVEY}

Qualquer dúvida, estaremos à disposição.

Atenciosamente,

{assinatura}`;

export const SYSTEM_PROMPT = `Você é o assistente de documentação técnica da plataforma Régua.
Sua tarefa é transformar solicitação, histórico/comentários e anotações do técnico em um rascunho profissional em português do Brasil.
REGRAS OBRIGATÓRIAS:
- Use apenas fatos presentes nas entradas. Nunca invente diagnóstico, ação, equipamento, patrimônio, data, teste, resultado, nome, autorização ou confirmação de funcionamento.
- Separe claramente: solicitação original, comentários anteriores de outros técnicos, ações efetivamente realizadas pelo técnico atual, informações posteriores e pendências.
- Não transforme ação solicitada, sugerida ou hipótese em ação realizada.
- Não declare que o problema foi resolvido, que o chamado foi encerrado ou que houve validação se o técnico não confirmou expressamente. Só use "Sendo assim, encerro o chamado." e a frase da pesquisa de satisfação quando apto_para_encerramento for true.
- Quando houver dados insuficientes, use marcadores [CONFIRMAR: ...] no texto e liste perguntas curtas em missing_information.
- Preserve números de patrimônio, modelos e nomes exatamente como recebidos; sinalize divergências em contradictions.
- Siga o modelo de referência abaixo, adaptando ao contexto, com a saudação e a assinatura recebidas:
${REFERENCE_TEMPLATE}
- Se ainda não houve atendimento, produza um ESBOÇO que não afirme execução: use formulação futura/condicional e marcadores [CONFIRMAR: ...].
Retorne somente JSON válido com: draft (string), facts_used (array), missing_information (array), contradictions (array), pending_items (array), requires_technician_confirmation (boolean).`;

const asArray = value => Array.isArray(value) ? value.map(x => typeof x === 'string' ? x : JSON.stringify(x)) : [];

export async function generateResolutionDraft({ provider = 'gemini', apiKey, model, fallbacks = [], onProgress, customBase = '', request: requestText = '', history = '', technicianNotes = '', pending = '', signature = DEFAULT_SIGNATURE, stage = 'initial', closureConfirmed = false, date = new Date() }) {
  const input = {
    etapa: stage,
    saudacao: greetingFor(date),
    solicitacao_original: requestText,
    comentarios_anteriores: history,
    acoes_do_tecnico_atual: stage === 'initial' ? '' : technicianNotes,
    pendencias: pending,
    apto_para_encerramento: stage !== 'initial' && !!closureConfirmed,
    assinatura: signature || DEFAULT_SIGNATURE
  };
  const task = stage === 'initial'
    ? 'Gere um primeiro esboço com base na solicitação e no histórico. O atendimento ainda não ocorreu: não afirme execução.'
    : 'Atualize a minuta após a execução, incorporando somente as ações que o técnico relata ter realizado. Não confunda disponibilização anterior com entrega ou instalação já realizada.';
  const { result, modelUsed, fallbackUsed } = await generate(provider, apiKey, model, task + '\n\nENTRADAS:\n' + JSON.stringify(input), customBase, SYSTEM_PROMPT, { fallbacks, onProgress });
  const draft = typeof result.draft === 'string' ? result.draft : '';
  if (!draft.trim()) throw new AIError('invalid_response', ERROR_MESSAGES.invalid_response, 'Campo draft ausente.');
  const guardWarnings = checkClosureClaims(draft, input.apto_para_encerramento);
  return {
    draft,
    facts_used: asArray(result.facts_used),
    missing_information: asArray(result.missing_information),
    contradictions: asArray(result.contradictions),
    pending_items: asArray(result.pending_items),
    requires_technician_confirmation: result.requires_technician_confirmation !== false || guardWarnings.length > 0,
    guard_warnings: guardWarnings,
    model_used: modelUsed,
    fallback_used: fallbackUsed
  };
}

export async function reviewTicketWithProvider({ provider = 'gemini', apiKey, model, fallbacks = [], onProgress, customBase = '', data = {} }) {
  const allowed = {};
  for (const k of ['subject', 'building', 'location', 'description', 'comments', 'cause', 'action', 'test', 'notes', 'assetType']) allowed[k] = data[k] || '';
  const system = 'Você é um auditor documental de chamados de suporte de TI. Não invente fatos nem atribua culpa. Diferencie ausência de registro de falha técnica e não presuma resolução. Você não altera a nota calculada pelas regras. Retorne somente JSON com overall, confidence, findings (criterion, status, evidence, explanation), missing_information, recommendations e human_review.';
  const { result, modelUsed, fallbackUsed } = await generate(provider, apiKey, model, 'Analise a qualidade documental do chamado. Dados técnicos minimizados (sem número, solicitante ou técnico):\n' + JSON.stringify(allowed), customBase, system, { fallbacks, onProgress });
  return { ...result, model_used: modelUsed, fallback_used: fallbackUsed };
}

export async function proposeCriteriaConfiguration(apiKey, model, context = '', provider = 'gemini', customBase = '', criteria = []) {
  const prompt = 'Proponha critérios objetivos e auditáveis para a Régua. Não crie normas institucionais. Preserve IDs, sugira pesos de 1 a 5 e justifique. Retorne JSON com rationale, criteria, proposed_additions, governance_warnings, human_approval_required=true. Contexto: ' + context + ' Critérios atuais (provisórios): ' + JSON.stringify(criteria);
  const system = 'Você é consultor de desenho de critérios de qualidade para suporte de TI. Retorne somente JSON válido com rationale, criteria, proposed_additions, governance_warnings e human_approval_required=true. Não invente normas institucionais.';
  return (await generate(provider, apiKey, model, prompt, customBase, system)).result;
}
