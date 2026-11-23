import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuality, DEFAULT_CRITERIA } from '../src/quality-engine.js';

test('motor avalia critérios e dimensões sem criar dados',()=>{
 const result=evaluateQuality({
  building:'Fórum',location:'Bloco 1 · Sala 106',subject:'Computador sem vídeo',
  description:'Computador da sala não apresenta imagem após reinicialização.',
  assetType:'PC',comments:'09:10 - teste de cabo; 09:20 - troca de monitor.',
  cause:'Cabo HDMI danificado.',action:'Substituído o cabo HDMI e testada a saída de vídeo.',
  test:'Usuário confirmou imagem e funcionamento normal.',notes:''
 });
 assert.equal(result.criteria.length,DEFAULT_CRITERIA.length);
 assert.equal(result.score,100);
 assert.equal(result.dimensions.opening.score,100);
 assert.equal(result.dimensions.updates.score,100);
 assert.equal(result.dimensions.closure.score,100);
});

test('motor sinaliza campos ausentes e não inventa evidência',()=>{
 const result=evaluateQuality({});
 assert.equal(result.score,0);
 assert.ok(result.criteria.every(item=>item.status==='review'||item.status==='not_applicable'));
 assert.ok(result.criteria.some(item=>item.evidence.includes('não informado')||item.evidence.includes('ausente')));
});

test('equipamento pode ser identificado pelo tipo sem tombamento conhecido',()=>{
 const result=evaluateQuality({assetType:'PC'});
 const asset=result.criteria.find(item=>item.id==='asset');
 assert.equal(asset.status,'met');
});
