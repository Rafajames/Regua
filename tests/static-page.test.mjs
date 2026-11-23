import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('script clássico da página não contém erro de sintaxe',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('<script>'),end=html.indexOf('</script>',start+8);
 assert.ok(start>=0&&end>start,'script principal precisa existir');
 new Function(html.slice(start+8,end));
});

test('módulo Gemini pode ser carregado sem executar chamadas externas',async()=>{\n const ai=await import('../src/ai-provider.js');\n assert.equal(typeof ai.testGeminiConnection,'function');\n assert.equal(typeof ai.proposeCriteriaConfiguration,'function');\n});\n\ntest('página contém temas e módulos de análise configurados',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['manager','reports','settings','themeToggle','geminiKey'])assert.ok(html.includes('id="'+id+'"'),id+' deve existir');
 assert.ok(html.includes('./src/ai-provider.js'));
 assert.ok(html.includes('./src/quality-engine.js'));
});
