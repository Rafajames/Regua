import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDERS, SYSTEM_PROMPT, AIError, testProviderConnection, discoverModels, generateResolutionDraft,
  rankGeminiModels, filterChatModels, classifyHttpError, parseJson, normalizeModelId, setRetryDelays
} from '../src/ai-provider.js';

setRetryDelays([1, 1]);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), options }); return handler(String(url), options, calls.length); };
  try { return await fn(calls); } finally { globalThis.fetch = original; }
}

test('provedores conhecidos são expostos sem chamadas externas', () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['gemini', 'openai', 'claude', 'grok', 'custom']);
});

test('Gemini: 3.8 Flash é recomendado e modelos antigos ficam depois', async () => {
  await withFetch(() => json({ models: [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.7-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] }
  ] }), async calls => {
    const r = await testProviderConnection('gemini', 'fake-test-key');
    assert.equal(r.selectedModel, 'gemini-3.8-flash');
    assert.equal(r.recommendedModel, 'gemini-3.8-flash');
    assert.ok(r.models.indexOf('gemini-3.7-flash') < r.models.indexOf('gemini-2.5-flash'));
    assert.ok(!r.models.some(m => m.startsWith('models/')), 'prefixo models/ deve ser removido');
    assert.ok(!r.models.includes('text-embedding-004'));
    assert.ok(!r.models.some(m => /tts/.test(m)), 'modelos de voz não geram texto');
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'fake-test-key', 'chave vai no cabeçalho, não na URL');
    assert.ok(!calls[0].url.includes('fake-test-key'));
  });
});

test('Gemini: escolha anterior do usuário é preservada se continuar disponível', async () => {
  await withFetch(() => json({ models: [
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: ['generateContent'] }
  ] }), async () => {
    const kept = await testProviderConnection('gemini', 'k', '', { preferredModel: 'models/gemini-3.1-pro-preview' });
    assert.equal(kept.selectedModel, 'gemini-3.1-pro-preview');
    assert.equal(kept.preferredKept, true);
    const gone = await testProviderConnection('gemini', 'k', '', { preferredModel: 'gemini-2.5-flash' });
    assert.equal(gone.selectedModel, 'gemini-3.8-flash', 'modelo antigo indisponível não pode prender a seleção');
  });
});

test('Gemini: geração usa exatamente o modelo selecionado, sem prefixo duplicado e sem temperature no Gemini 3', async () => {
  await withFetch(() => json({ candidates: [{ content: { parts: [{ text: '{"draft":"Prezado(a) Sr(a), boa tarde!","missing_information":[],"requires_technician_confirmation":true}' }] } }] }), async calls => {
    const r = await generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'models/gemini-3.8-flash', request: 'PC sem vídeo', stage: 'initial' });
    assert.match(calls[0].url, /\/v1beta\/models\/gemini-3\.8-flash:generateContent$/);
    const body = JSON.parse(calls[0].options.body);
    assert.ok(body.systemInstruction.parts[0].text.includes('Nunca invente'));
    assert.equal(body.generationConfig.temperature, undefined);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal((body.contents[0].parts[0].text.match(/REGRAS OBRIGATÓRIAS/g) || []).length, 0, 'prompt de sistema não deve ser duplicado na mensagem');
    assert.equal(r.draft, 'Prezado(a) Sr(a), boa tarde!');
  });
});

test('Gemini: erro de modelo descontinuado vira mensagem compreensível', async () => {
  await withFetch(() => json({ error: { code: 404, message: 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash.' } }, 404), async () => {
    await assert.rejects(
      generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash', request: 'x' }),
      err => err instanceof AIError && err.code === 'model' && /não está disponível/.test(err.message) && /gemini-3\.8-flash/.test(err.detail)
    );
  });
});

test('Gemini: resposta bloqueada e resposta vazia são diferenciadas', async () => {
  await withFetch(() => json({ promptFeedback: { blockReason: 'SAFETY' } }), async () => {
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', request: 'x' }), e => e.code === 'blocked');
  });
  await withFetch(() => json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }), async () => {
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', request: 'x' }), e => e.code === 'invalid_response');
  });
});

test('classificação de erros HTTP', () => {
  assert.equal(classifyHttpError(400, 'API key not valid. Please pass a valid API key.').code, 'auth');
  assert.equal(classifyHttpError(401, '').code, 'auth');
  assert.equal(classifyHttpError(403, 'forbidden').code, 'permission');
  assert.equal(classifyHttpError(404, '').code, 'model');
  assert.equal(classifyHttpError(429, '').code, 'quota');
  assert.equal(classifyHttpError(503, '').code, 'server');
  assert.equal(classifyHttpError(400, 'Unsupported parameter: temperature').code, 'bad_request');
  assert.ok(!classifyHttpError(400, 'erro com a chave sk-secreta-123456', 'sk-secreta-123456').detail.includes('sk-secreta-123456'), 'a chave deve ser ocultada');
});

test('falha de rede (inclui bloqueio de CORS) é explicada', async () => {
  await withFetch(() => { throw new TypeError('Failed to fetch'); }, async () => {
    await assert.rejects(discoverModels('grok', 'k'), e => e.code === 'network' && /CORS/.test(e.message));
  });
});

test('OpenAI: lista só modelos de texto e remove áudio, imagem e embeddings', () => {
  const ids = ['whisper-1', 'gpt-4o', 'dall-e-3', 'text-embedding-3-small', 'gpt-4o-mini-tts', 'gpt-5', 'gpt-4o-realtime-preview', 'omni-moderation-latest', 'o4-mini', 'gpt-5-2025-08-07'];
  const out = filterChatModels('openai', ids);
  assert.deepEqual(out.filter(x => /whisper|dall-e|embedding|tts|realtime|moderation/.test(x)), []);
  assert.equal(out[0], 'gpt-5', 'versão mais nova e alias sem data primeiro');
  assert.ok(out.includes('o4-mini'));
});

test('OpenAI: parâmetro temperature recusado é removido automaticamente', async () => {
  await withFetch((url, options, n) => n === 1
    ? json({ error: { message: "Unsupported value: 'temperature' does not support 0.2 with this model." } }, 400)
    : json({ choices: [{ message: { content: '{"draft":"texto"}' } }] }), async calls => {
    const r = await generateResolutionDraft({ provider: 'openai', apiKey: 'k', model: 'gpt-5', request: 'x' });
    assert.equal(r.draft, 'texto');
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).temperature, undefined);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer k');
  });
});

test('Claude: cabeçalhos de acesso pelo navegador e modelo selecionado', async () => {
  await withFetch(() => json({ content: [{ type: 'text', text: 'Segue: {"draft":"ok"}' }] }), async calls => {
    const r = await generateResolutionDraft({ provider: 'claude', apiKey: 'k', model: 'claude-sonnet-5-5', request: 'x' });
    assert.equal(r.draft, 'ok');
    const h = calls[0].options.headers;
    assert.equal(h['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(h['anthropic-version'], '2023-06-01');
    assert.equal(JSON.parse(calls[0].options.body).model, 'claude-sonnet-5-5');
  });
});

test('Grok usa o endpoint da xAI', async () => {
  await withFetch(() => json({ data: [{ id: 'grok-4' }, { id: 'grok-imagine-image' }] }), async calls => {
    const models = await discoverModels('grok', 'k');
    assert.equal(calls[0].url, 'https://api.x.ai/v1/models');
    assert.deepEqual(models, ['grok-4']);
  });
});

test('Provedor personalizado: valida URL e orienta modelo manual quando não há catálogo', async () => {
  await assert.rejects(discoverModels('custom', 'k', ''), e => e.code === 'config');
  await assert.rejects(discoverModels('custom', 'k', 'http://exemplo.com/v1'), e => e.code === 'config' && /HTTPS/.test(e.message));
  await assert.rejects(discoverModels('custom', 'k', 'não é url'), e => e.code === 'config');
  await withFetch(() => json({ error: 'not found' }, 404), async calls => {
    await assert.rejects(discoverModels('custom', 'k', 'https://llm.exemplo.com/v1/'), e => e.code === 'no_discovery');
    assert.equal(calls[0].url, 'https://llm.exemplo.com/v1/models');
  });
  await withFetch(() => json({ data: [{ id: 'meu-modelo' }] }), async () => {
    assert.deepEqual(await discoverModels('custom', 'k', 'http://localhost:11434/v1'), ['meu-modelo']);
  });
});

test('geração sem modelo ou sem chave é recusada antes de qualquer rede', async () => {
  await withFetch(() => { throw new Error('não deveria chamar a rede'); }, async calls => {
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: '', request: 'x' }), e => e.code === 'config');
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: '', model: 'gemini-3.8-flash', request: 'x' }), e => e.code === 'config');
    assert.equal(calls.length, 0);
  });
});

test('rascunho de IA que declara encerramento sem confirmação recebe alerta', async () => {
  await withFetch(() => json({ candidates: [{ content: { parts: [{ text: '{"draft":"Sendo assim, encerro o chamado.","requires_technician_confirmation":false}' }] } }] }), async () => {
    const r = await generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', request: 'x', stage: 'completion', closureConfirmed: false });
    assert.ok(r.guard_warnings.length >= 1);
    assert.equal(r.requires_technician_confirmation, true);
  });
});

test('utilitários: JSON com cercas e texto extra, normalização de modelo e ranking', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Claro! {"a":2} Fim.'), { a: 2 });
  assert.throws(() => parseJson('sem json'), e => e.code === 'invalid_response');
  assert.equal(normalizeModelId('models/gemini-3.8-flash'), 'gemini-3.8-flash');
  assert.deepEqual(rankGeminiModels(['gemini-3.1-pro-preview', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-flash-latest']).slice(0, 2), ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

test('prompt proíbe invenção, exige marcadores e condiciona o encerramento', () => {
  assert.match(SYSTEM_PROMPT, /Nunca invente/);
  assert.match(SYSTEM_PROMPT, /não declare que o problema foi resolvido/i);
  assert.match(SYSTEM_PROMPT, /\[CONFIRMAR/);
  assert.match(SYSTEM_PROMPT, /apto_para_encerramento/);
  assert.match(SYSTEM_PROMPT, /pesquisa de satisfação/);
});

const HIGH_DEMAND = { error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } };
const OK_DRAFT = { candidates: [{ content: { parts: [{ text: '{"draft":"ok"}' }] } }] };

test('sobrecarga (503 high demand): tenta novamente e conclui com o mesmo modelo', async () => {
  await withFetch((url, o, n) => n < 3 ? json(HIGH_DEMAND, 503) : json(OK_DRAFT), async calls => {
    const progress = [];
    const r = await generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', request: 'x', onProgress: m => progress.push(m) });
    assert.equal(calls.length, 3);
    assert.equal(r.model_used, 'gemini-3.8-flash');
    assert.equal(r.fallback_used, false);
    assert.equal(progress.length, 2);
  });
});

test('sobrecarga persistente: usa o modelo reserva e informa', async () => {
  await withFetch(url => url.includes('gemini-3.8-flash') ? json(HIGH_DEMAND, 503) : json(OK_DRAFT), async calls => {
    const r = await generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', fallbacks: ['gemini-3.7-flash'], request: 'x' });
    assert.equal(r.model_used, 'gemini-3.7-flash');
    assert.equal(r.fallback_used, true);
    assert.equal(calls.filter(c => c.url.includes('gemini-3.8-flash')).length, 3);
  });
});

test('sobrecarga em todos os modelos: mensagem clara; erros de chave não geram novas tentativas', async () => {
  await withFetch(() => json(HIGH_DEMAND, 503), async () => {
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', fallbacks: ['gemini-3.7-flash'], request: 'x' }),
      e => e.code === 'server' && /sobrecarregado/.test(e.message) && /high demand/.test(e.detail));
  });
  await withFetch(() => json({ error: { message: 'API key not valid.' } }, 400), async calls => {
    await assert.rejects(generateResolutionDraft({ provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash', fallbacks: ['gemini-3.7-flash'], request: 'x' }), e => e.code === 'auth');
    assert.equal(calls.length, 1);
  });
});
