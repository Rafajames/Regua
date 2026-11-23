import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuality, DEFAULT_CRITERIA, STATUS_LABELS, scoreBand, WEIGHTS_ARE_PROVISIONAL } from '../src/quality-engine.js';

const complete = {
  building: 'Fórum', location: 'Bloco 1 · Sala 106', subject: 'Computador sem vídeo',
  description: 'Computador da sala não apresenta imagem após reinicialização.',
  assetType: 'PC', comments: '09:10 - teste de cabo; 09:20 - troca de monitor.',
  cause: 'Cabo HDMI danificado.', action: 'Substituído o cabo HDMI e testada a saída de vídeo.',
  test: 'Usuário confirmou imagem e funcionamento normal.', notes: ''
};

test('registro completo atinge 100% em todas as dimensões', () => {
  const r = evaluateQuality(complete);
  assert.equal(r.criteria.length, DEFAULT_CRITERIA.length);
  assert.equal(r.score, 100);
  for (const k of ['opening', 'updates', 'closure']) assert.equal(r.dimensions[k].score, 100);
  assert.equal(r.passed, r.total);
});

test('campos vazios são "não evidenciados", sem inventar evidência', () => {
  const r = evaluateQuality({});
  assert.equal(r.score, 0);
  assert.ok(r.criteria.every(c => c.status === 'not_evidenced' || c.status === 'not_applicable'));
  assert.ok(r.criteria.every(c => STATUS_LABELS[c.status]));
});

test('conteúdo insuficiente "requer revisão" e não é confundido com ausência', () => {
  const r = evaluateQuality({ subject: 'PC', description: 'erro', action: 'troca', building: 'Fórum' });
  const st = id => r.criteria.find(c => c.id === id).status;
  assert.equal(st('subject'), 'needs_review');
  assert.equal(st('symptom'), 'needs_review');
  assert.equal(st('action'), 'needs_review');
  assert.equal(st('location'), 'needs_review', 'prédio sem setor/sala é parcial');
  assert.equal(st('cause'), 'not_evidenced');
});

test('critério condicional de pendência só entra no cálculo quando há pendência', () => {
  const sem = evaluateQuality(complete);
  assert.equal(sem.criteria.find(c => c.id === 'pending').status, 'not_applicable');
  assert.equal(sem.total, 8);
  const com = evaluateQuality({ ...complete, comments: 'Aguardando peça do fornecedor terceiro.', notes: '' });
  assert.equal(com.criteria.find(c => c.id === 'pending').status, 'not_evidenced');
  assert.equal(com.total, 9);
  // pesos aplicáveis = 14; falta o critério de pendência (peso 1) → 13/14
  assert.equal(com.score, Math.round(13 / 14 * 100));
  const contextualizada = evaluateQuality({ ...complete, notes: 'Aguardando peça; previsão de retorno em 3 dias.' });
  assert.equal(contextualizada.criteria.find(c => c.id === 'pending').status, 'met');
  assert.equal(contextualizada.score, 100);
});

test('pesos são aplicados (critério de peso 2 vale o dobro do peso 1)', () => {
  // sem pendência, o total aplicável é 13 (o critério de pendência é excluído)
  const semCausa = evaluateQuality({ ...complete, cause: '' });          // peso 1
  const semAcao = evaluateQuality({ ...complete, action: '' });          // peso 2
  assert.equal(semCausa.score, Math.round(12 / 13 * 100));
  assert.equal(semAcao.score, Math.round(11 / 13 * 100));
});

test('resultado é reproduzível e equipamento pode ser identificado sem tombamento', () => {
  const a = evaluateQuality(complete), b = evaluateQuality(complete);
  assert.deepEqual(a.criteria, b.criteria);
  assert.equal(a.score, b.score);
  assert.equal(evaluateQuality({ assetType: 'PC' }).criteria.find(c => c.id === 'asset').status, 'met');
});

test('pesos marcados como provisórios e faixas de nota', () => {
  assert.equal(WEIGHTS_ARE_PROVISIONAL, true);
  assert.equal(scoreBand(80), 'good');
  assert.equal(scoreBand(79), 'fair');
  assert.equal(scoreBand(54), 'low');
  assert.equal(scoreBand(null), 'none');
});
