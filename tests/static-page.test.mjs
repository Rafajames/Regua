import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('script clássico da página não contém erro de sintaxe',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
 assert.ok(scripts.length>=1,'script principal precisa existir');
 for(const script of scripts)new Function(script[1]);
});

test('página contém temas e módulos de análise configurados',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['manager','reports','settings','themeToggle','geminiKey'])assert.ok(html.includes('id="'+id+'"'),id+' deve existir');
 assert.ok(html.includes('./src/ai-provider.js'));
 assert.ok(html.includes('./src/quality-engine.js'));
});
