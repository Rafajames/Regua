import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationalSummary, compareSummaries } from '../src/reporting.js';

test('relatório calcula volume, backlog e duração somente com datas válidas',()=>{
 const summary=buildOperationalSummary([
  {openedAt:'2026-11-20T10:00:00Z',closedAt:'2026-11-20T11:00:00Z',building:'Fórum',tech:'Técnico A'},
  {openedAt:'2026-11-21T10:00:00Z',closedAt:null,building:'Fórum',tech:'Técnico B'},
  {openedAt:'data inválida',closedAt:null,building:'Sede',tech:'Técnico A'}
 ]);
 assert.equal(summary.totalRecords,3);
 assert.equal(summary.openedCount,2);
 assert.equal(summary.closedCount,1);
 assert.equal(summary.openBacklog,2);
 assert.equal(summary.resolutionMinutes.average,60);
 assert.equal(summary.byBuilding.Fórum,2);
 assert.equal(summary.byTechnician['Técnico A'],2);
});

test('comparação de períodos não divide por zero',()=>{
 const a={totalRecords:8,closedCount:5,openBacklog:3};
 const b={totalRecords:4,closedCount:0,openBacklog:0};
 const result=compareSummaries(a,b);
 assert.equal(result.totalRecords.changePercent,100);
 assert.equal(result.closedCount.changePercent,null);
 assert.equal(result.openBacklog.changePercent,null);
});
