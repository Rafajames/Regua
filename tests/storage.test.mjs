import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup, sanitizeRecord, buildBackup, MAX_BACKUP_ITEMS } from '../src/storage.js';

const rec = (id, extra = {}) => ({ id, subject: 'Assunto ' + id, createdAt: '2026-11-20T10:00:00Z', result: { score: 80 }, ...extra });

test('backup exportado é reimportável e preserva os registros', () => {
  const backup = buildBackup([rec('a'), rec('b')], 'teste');
  const r = parseBackup(JSON.stringify(backup));
  assert.equal(r.ok, true);
  assert.deepEqual(r.records.map(x => x.id), ['a', 'b']);
  assert.equal(r.records[0].result.score, 80);
});

test('formato antigo (v1) e array simples são aceitos', () => {
  assert.equal(parseBackup(JSON.stringify({ product: 'Regua', version: 1, items: [rec('a')] })).records.length, 1);
  assert.equal(parseBackup(JSON.stringify([rec('a')])).records.length, 1);
});

test('duplicidades com o histórico e dentro do arquivo são ignoradas', () => {
  const r = parseBackup(JSON.stringify({ items: [rec('a'), rec('b'), rec('b')] }), new Set(['a']));
  assert.deepEqual(r.records.map(x => x.id), ['b']);
  assert.equal(r.duplicates, 2);
});

test('conteúdo inválido é rejeitado antes de qualquer gravação', () => {
  assert.equal(parseBackup('').ok, false);
  assert.equal(parseBackup('{ quebrado').ok, false);
  assert.equal(parseBackup(JSON.stringify({ foo: 1 })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ product: 'OutroApp', items: [rec('a')] })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ items: new Array(MAX_BACKUP_ITEMS + 1).fill(rec('x')) })).ok, false);
  const r = parseBackup(JSON.stringify({ items: [null, 5, [], {}, rec('ok')] }));
  assert.equal(r.records.length, 1);
  assert.equal(r.invalid, 4);
});

test('registro importado é saneado (nota, textos e HTML não executável)', () => {
  const s = sanitizeRecord({ id: 'x', subject: '<img src=x onerror=alert(1)>', number: 123, result: { score: '<b>99</b>' }, createdAt: 'data ruim' });
  assert.equal(s.number, '123');
  assert.equal(s.result.score, null, 'nota não numérica não pode ser exibida como HTML');
  assert.ok(!Number.isNaN(new Date(s.createdAt).getTime()));
  assert.equal(typeof s.subject, 'string');
  assert.equal(sanitizeRecord({ id: 'y', result: { score: 150 }, subject: 'a' }).result.score, null);
});
