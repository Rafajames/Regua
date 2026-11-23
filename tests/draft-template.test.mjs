import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandardDraft, checkClosureClaims, greetingFor, DEFAULT_SIGNATURE } from '../src/draft-template.js';

const afternoon = new Date(2026, 10, 23, 14, 0);

test('texto padrão com encerramento confirmado segue o modelo de referência', () => {
  const r = buildStandardDraft({ action: 'Substituído o cabo HDMI\nTestada a saída de vídeo', test: 'Usuário confirmou funcionamento', closureConfirmed: true, date: afternoon });
  assert.ok(r.draft.startsWith('Prezado(a) Sr(a), boa tarde!'));
  assert.match(r.draft, /Conforme solicitado, o seguinte procedimento foi realizado:/);
  assert.match(r.draft, /- Substituído o cabo HDMI\./);
  assert.match(r.draft, /Sendo assim, encerro o chamado\./);
  assert.match(r.draft, /pesquisa de satisfação/);
  assert.match(r.draft, /Qualquer dúvida, estaremos à disposição\./);
  assert.ok(r.draft.trimEnd().endsWith('Jamerson Rafael\n\nAnalista de Field Service'));
  assert.equal(r.closureIncluded, true);
});

test('sem confirmação do técnico o texto NÃO declara encerramento', () => {
  const r = buildStandardDraft({ action: 'Reinstalado o driver da impressora', closureConfirmed: false, date: afternoon });
  assert.doesNotMatch(r.draft, /encerro o chamado/);
  assert.doesNotMatch(r.draft, /pesquisa de satisfação/);
  assert.match(r.draft, /\[CONFIRMAR:/);
});

test('pendência registrada impede o encerramento mesmo com a caixa marcada', () => {
  const r = buildStandardDraft({ action: 'Diagnóstico realizado', notes: 'Aguardando peça do fornecedor', closureConfirmed: true, date: afternoon });
  assert.doesNotMatch(r.draft, /encerro o chamado/);
  assert.match(r.draft, /Pendência: Aguardando peça do fornecedor\./);
  assert.ok(r.warnings.some(w => /pendência/i.test(w)));
});

test('sem ação registrada usa marcador em vez de inventar procedimento', () => {
  const r = buildStandardDraft({ date: afternoon });
  assert.match(r.draft, /\[CONFIRMAR: informar o procedimento realizado\]/);
});

test('assinatura é editável e a saudação acompanha o horário', () => {
  const r = buildStandardDraft({ action: 'Ação', signature: 'Maria Souza\nTécnica de Suporte', date: new Date(2026, 0, 1, 9) });
  assert.ok(r.draft.startsWith('Prezado(a) Sr(a), bom dia!'));
  assert.match(r.draft, /Maria Souza\n\nTécnica de Suporte$/);
  assert.equal(greetingFor(new Date(2026, 0, 1, 19)), 'boa noite');
  assert.equal(DEFAULT_SIGNATURE, 'Jamerson Rafael\nAnalista de Field Service');
});

test('verificação de encerramento indevido e de marcadores pendentes', () => {
  assert.equal(checkClosureClaims('Sendo assim, encerro o chamado.', false).length, 1);
  assert.equal(checkClosureClaims('Sendo assim, encerro o chamado.', true).length, 0);
  assert.equal(checkClosureClaims('Faltou [CONFIRMAR: data]', true).length, 1);
});
