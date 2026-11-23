import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testProviderConnection, generateResolutionDraft, discoverModels, PROVIDERS, SYSTEM_PROMPT } from '../src/ai-provider.js';

test('provedores e funções de IA carregam sem chamadas externas',()=>{
 assert.deepEqual(Object.keys(PROVIDERS),['gemini','openai','claude','grok','custom']);
 assert.equal(typeof testProviderConnection,'function');
 assert.equal(typeof generateResolutionDraft,'function');
 assert.equal(typeof discoverModels,'function');
});

test('Gemini prioriza o modelo atual para evitar seleção automática de versão antiga',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({models:[
  {name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},
  {name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']},
  {name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}
 ]}),{status:200,headers:{'Content-Type':'application/json'}});
 try {
  const result=await testProviderConnection('gemini','fake-test-key');
  assert.equal(result.selectedModel,'gemini-3.8-flash');
  assert.equal(result.models[0],'gemini-3.8-flash');
  assert.ok(result.models.indexOf('gemini-2.5-flash')>result.models.indexOf('gemini-3.5-flash'));
 } finally { globalThis.fetch=originalFetch; }
});

test('prompt do assistente proíbe invenção e exige confirmação humana',()=>{
 assert.match(SYSTEM_PROMPT,/Nunca invente/);
 assert.match(SYSTEM_PROMPT,/não declare que o problema foi resolvido/i);
 assert.match(SYSTEM_PROMPT,/missing_information/);
});

test('script clássico da página não contém erro de sintaxe',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('<script>'),end=html.indexOf('</script>',start+8);
 assert.ok(start>=0&&end>start,'script principal precisa existir');
 new Function(html.slice(start+8,end));
});

test('página contém rascunho, armazenamento local e provedores',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['manager','reports','settings','themeToggle','geminiKey','aiProvider','initialDraft','finalDraft','draftOutput','chooseFolder'])assert.ok(html.includes('id="'+id+'"'),id+' deve existir');
 assert.ok(html.includes('./src/ai-provider.js'));
 assert.ok(html.includes("$('geminiModel').disabled=false"));
 assert.ok(html.includes("$('geminiModel').value=r.selectedModel"));
 assert.ok(html.includes('showDirectoryPicker'));
 assert.ok(html.includes('chamados.json'));
 assert.ok(html.includes('manifest.webmanifest'));
 assert.ok(html.includes('navigator.serviceWorker.register'));
 assert.ok(html.includes('Jamerson Rafael'));
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(sw.includes('APP_SHELL'));
 assert.ok(sw.includes("request.mode==='navigate'"));
 const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.name,'Régua — Inteligência Operacional');
});
