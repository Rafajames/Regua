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

test('formato completo do Aranda: datas M/D/AAAA AM/PM, tempo "0d:0h:4min", prazo, SLA e lote', () => {
  const rows = parseCsv('Chamado,Estado,Tipo de chamado,Data de registro,Assunto,Tipo de registro,Progresso,Tempo,SLA,Categoria,Data de atendimento prevista,Data real de atendimento,Data de fechamento,Prioridade\n'
    + 'RF-1,Closed,Solicitação de Serviço,11/9/2026 9:38:13 AM,Impressora - suporte,Telephone,3.13,0d:0h:4min,TJRR - Prioridade Média,Suporte ao Usuário,11/9/2026 11:48:13 AM,11/9/2026 11:05:45 AM,11/14/2026 7:00:44 AM,4 MEDIUM-LOW\n'
    + 'RF-2,Closed,Solicitação de Serviço,10/26/2026 1:13:21 PM,Suporte - impressora,E-Mail,18.41,0d:1h:12min,TJRR - Prioridade Alta,Computador e outros,10/26/2026 2:18:21 PM,10/27/2026 4:18:05 PM,11/3/2026 3:35:57 PM,4 MEDIUM-LOW\n'
    + 'RF-3,Closed,Solicitação de Serviço,10/26/2026 9:08:23 AM,Chamado - Criado via Chatbot,Chamado Fácil,10.1,0d:0h:6min,TJRR - Prioridade Alta,Suporte ao uso dos sistemas e aplicativos,10/26/2026 10:13:23 AM,10/27/2026 4:22:42 PM,11/4/2026 7:00:40 AM,4 MEDIUM-LOW\n');
  const { records, mapping } = rowsToRecords(rows);
  const f = Object.fromEntries(mapping.map(m => [m.column, m.field]));
  assert.equal(f['Tipo de chamado'], 'ticketType');
  assert.equal(f['Categoria'], 'category', 'Categoria não pode ser tomada por "Tipo de chamado"');
  assert.equal(f['Tipo de registro'], 'channel');
  assert.equal(f['Data de registro'], 'openedAt');
  assert.equal(f['Data de atendimento prevista'], 'dueAt');
  assert.equal(f['Data real de atendimento'], 'attendedAt');
  assert.equal(f['Tempo'], 'duration');
  const d = new Date(records[1].openedAt);
  assert.equal(d.getMonth(), 9); assert.equal(d.getDate(), 26); assert.equal(d.getHours(), 13);
  const s = summarizeTickets(records);
  assert.deepEqual([s.duration.median, s.duration.max], [6, 72]);
  assert.deepEqual([s.sla.onTime, s.sla.late], [1, 2]);
  assert.equal(s.attendedBatch.count, 2);
  assert.equal(s.subjects.generic, 1);
  assert.equal(s.channels.length, 3);
  assert.equal(s.categorySpread[0]?.label, undefined, 'só 2 chamados de impressora: abaixo do mínimo para apontar inconsistência');
});
