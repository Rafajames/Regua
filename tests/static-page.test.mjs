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

test('prompt do assistente proíbe invenção e exige confirmação humana',()=>{
 assert.match(SYSTEM_PROMPT,/Nunca invente/);
 assert.match(SYSTEM_PROMPT,/não declare que o problema foi resolvido/);
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
 assert.ok(html.includes('showDirectoryPicker'));
 assert.ok(html.includes('regua-meus-chamados.json'));
});
