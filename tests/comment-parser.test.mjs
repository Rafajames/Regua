import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromComments, classifySentence } from '../src/comment-parser.js';

test('comentário típico: visita, causa, ação e confirmação', () => {
  const r = extractFromComments('Foi realizada a visita técnica e foi verificado que o cabo HDMI estava danificado e foi feita a substituição do cabo. Após isso, o equipamento voltou a funcionar normalmente e o usuário confirmou.');
  assert.equal(r.action, 'Foi realizada a visita técnica.\nFoi feita a substituição do cabo.');
  assert.equal(r.cause, 'Foi verificado que o cabo HDMI estava danificado.');
  assert.equal(r.test, 'O equipamento voltou a funcionar normalmente. O usuário confirmou.');
  assert.equal(r.pending, '');
});

test('pendência é separada e a causa sai de frase ligada por vírgula', () => {
  const r = extractFromComments('Foi realizada a visita técnica, verificado que a fonte do PC está queimada. Aguardando a chegada da peça para substituição.');
  assert.equal(r.action, 'Foi realizada a visita técnica.');
  assert.equal(r.cause, 'Verificado que a fonte do PC está queimada.');
  assert.equal(r.pending, 'Aguardando a chegada da peça para substituição.');
});

test('primeira pessoa, horário no início e teste realizado', () => {
  const r = extractFromComments('10:15 - Troquei o cabo de rede e reiniciei o computador, o usuário confirmou que a internet voltou.');
  assert.equal(r.action, 'Troquei o cabo de rede.\nReiniciei o computador.');
  assert.match(r.test, /usuário confirmou/);
  const r2 = extractFromComments('Substituído o toner e realizado teste de impressão com sucesso.');
  assert.equal(r2.action, 'Substituído o toner.');
  assert.equal(r2.test, 'Realizado teste de impressão com sucesso.');
});

test('não inventa: texto sem ação, causa ou teste fica vazio', () => {
  const r = extractFromComments('Usuário ligou pedindo atendimento.');
  assert.equal(r.action + r.cause + r.test + r.pending, '');
  assert.equal(extractFromComments('').action, '');
  assert.equal(classifySentence('Substituído o cabo danificado'), 'action', 'ação no início prevalece sobre adjetivo de causa');
  assert.equal(classifySentence('Não foi possível concluir o atendimento'), 'pending');
});

test('comentário real do nobreak: teste sem sucesso é teste; "será necessário" é pendência; nada se perde', () => {
  const r = extractFromComments('Realizada a visita técnica na Coordenação da Vara da Justiça Itinerante. Removido o nobreak da estação do servidor. Conectados os equipamentos do servidor, monitores e computador a uma extensão da unidade. Recolhido o nobreak para envio ao Laboratório de TIC do TJRR. Verificado que o nobreak da estação do servidor não apresenta sinal, não acende e não liga, mesmo conectado à tomada. Testado o nobreak em outras tomadas, sem sucesso. Será necessário enviar o nobreak ao Laboratório de TIC do TJRR; após a análise, será avaliada a possibilidade de manutenção ou substituição do equipamento.');
  assert.equal(r.action.split('\n').length, 4);
  assert.match(r.action, /Recolhido o nobreak/);
  assert.match(r.cause, /^Verificado que o nobreak/);
  assert.equal(r.test, 'Testado o nobreak em outras tomadas, sem sucesso.');
  assert.match(r.pending, /^Será necessário enviar o nobreak/);
  assert.match(r.pending, /Após a análise, será avaliada/);
  assert.deepEqual(r.unclassified, []);
});
