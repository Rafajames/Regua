import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsv, parseXlsx, rowsToRecords, matchField, summarizeTickets, itemsToRows, alignPdfRows, readTicketFile } from '../src/ticket-import.js';

const fx = name => new URL('./fixtures/' + name, import.meta.url);

test('CSV: separador vírgula ou ponto e vírgula, aspas e BOM', () => {
  assert.deepEqual(parseCsv('﻿Chamado,Categoria\nRF-1,"Suporte, usuário"\n'), [['Chamado', 'Categoria'], ['RF-1', 'Suporte, usuário']]);
  assert.deepEqual(parseCsv('Chamado;Estado\r\nRF-2;Closed\r\n'), [['Chamado', 'Estado'], ['RF-2', 'Closed']]);
  assert.deepEqual(parseCsv('a,b\n"diz ""oi""",x'), [['a', 'b'], ['diz "oi"', 'x']]);
});

test('colunas reconhecidas pelo nome (inclusive datas antes de texto)', () => {
  assert.equal(matchField('Chamado'), 'number');
  assert.equal(matchField('Estado'), 'status');
  assert.equal(matchField('Progresso'), 'progress');
  assert.equal(matchField('Data de solução'), 'closedAt');
  assert.equal(matchField('Solução'), 'action');
  assert.equal(matchField('Técnico responsável'), 'tech');
  assert.equal(matchField('Coluna qualquer'), null);
  const r = rowsToRecords([['Chamado', 'Data de abertura', 'Outra'], ['RF-1', '05/11/2026 14:30', 'x']]);
  assert.equal(r.records[0].number, 'RF-1');
  assert.equal(new Date(r.records[0].openedAt).getDate(), 5);
  assert.deepEqual(r.ignored, ['Outra']);
});

test('arquivo CSV no formato exportado (Chamado, Estado, Progresso, Categoria, Solicitante)', async () => {
  const text = await readFile(fx('chamados-ficticios.csv'), 'utf8');
  const file = new File([text], 'chamados.csv');
  const r = await readTicketFile(file);
  assert.equal(r.format, 'CSV');
  assert.equal(r.records.length, 60);
  assert.deepEqual(r.mapping.map(m => m.field), ['number', 'status', 'progress', 'category', 'requester']);
  const s = summarizeTickets(r.records);
  assert.equal(s.total, 60);
  assert.equal(s.closed + s.open, 60);
  assert.equal(s.open, 6);
  assert.ok(s.progress.median > 0 && s.progress.p90 >= s.progress.median);
  assert.equal(s.categories.reduce((a, c) => a + c.count, 0), 60);
  assert.equal(s.requesters.distinct, 6);
  assert.equal(s.quality, null, 'sem colunas de texto, a qualidade não é calculada');
});

test('Excel .xlsx lido sem bibliotecas (textos, datas e avaliação de qualidade)', async () => {
  const buf = await readFile(fx('chamados-ficticios.xlsx'));
  const rows = await parseXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.deepEqual(rows[0], ['Chamado', 'Estado', 'Data de abertura', 'Categoria', 'Solicitante', 'Descrição', 'Solução']);
  assert.equal(rows.length, 21);
  const { records } = rowsToRecords(rows);
  assert.equal(new Date(records[0].openedAt).getUTCFullYear(), 2026);
  const s = summarizeTickets(records);
  assert.equal(s.quality.evaluated, 10);
});

test('PDF: textos posicionados viram linhas e colunas alinhadas ao cabeçalho', () => {
  const items = [
    { str: 'Chamado', x: 50, y: 700 }, { str: 'Estado', x: 150, y: 700 }, { str: 'Categoria', x: 250, y: 700 },
    { str: 'RF-1', x: 50, y: 680 }, { str: 'Closed', x: 150, y: 681 }, { str: 'Computador', x: 252, y: 680, w: 50 }, { str: 'e outros', x: 304, y: 680 },
    { str: 'RF-2', x: 50, y: 660 }, { str: 'Open', x: 151, y: 660 },
    { str: 'Chamado', x: 50, y: 640 }, { str: 'Estado', x: 150, y: 640 }, { str: 'Categoria', x: 250, y: 640 },
    { str: 'RF-3', x: 50, y: 620 }, { str: 'Teste', x: 150, y: 620 }, { str: 'Suporte ao Usuário', x: 250, y: 620 }
  ];
  const rows = alignPdfRows(itemsToRows(items));
  assert.deepEqual(rows, [['Chamado', 'Estado', 'Categoria'], ['RF-1', 'Closed', 'Computador e outros'], ['RF-2', 'Open', ''], ['RF-3', 'Teste', 'Suporte ao Usuário']], 'cabeçalho repetido é pulado; dados parecidos com nomes de coluna são mantidos');
  assert.throws(() => alignPdfRows(itemsToRows([{ str: 'Relatório', x: 1, y: 1 }])), /cabeçalho/);
});

test('formatos inválidos têm mensagem clara', async () => {
  await assert.rejects(readTicketFile(new File(['x'], 'a.xls')), /\.xls antigo/);
  await assert.rejects(readTicketFile(new File(['x'], 'a.docx')), /Formato não reconhecido/);
  await assert.rejects(readTicketFile(new File(['foo,bar\n1,2'], 'a.csv')), /Não reconheci nenhuma coluna/);
});

test('volume: 20 mil chamados analisados rapidamente', () => {
  const recs = Array.from({ length: 20000 }, (_, i) => ({ number: 'RF-' + i, status: i % 4 ? 'Closed' : 'Open', progress: String(i % 30), category: 'Cat ' + (i % 7), requester: 'P' + (i % 900) }));
  const t = Date.now();
  const s = summarizeTickets(recs);
  assert.equal(s.total, 20000);
  assert.ok(Date.now() - t < 1500);
});
