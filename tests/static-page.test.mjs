import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('página contém telas, campos e créditos essenciais', async () => {
  const html = await read('index.html');
  for (const id of ['home', 'audit', 'history', 'reports', 'manager', 'settings', 'auditForm', 'themeToggle', 'geminiKey', 'aiProvider', 'geminiModel', 'manualModel', 'standardDraft', 'initialDraft', 'finalDraft', 'draftOutput', 'closureConfirmed', 'copyDraft', 'historySearch', 'importBackupFile', 'detailDialog', 'chooseFolder', 'updateBar'])
    assert.ok(html.includes('id="' + id + '"'), id + ' deve existir');
  assert.ok(html.includes('src/app.js'));
  assert.ok(html.includes('manifest.webmanifest'));
  assert.ok(html.includes('Concepção e desenvolvimento: <strong>Jamerson Rafael</strong>'));
});

test('sem scripts inline (CSP) e todo id referenciado existe', async () => {
  const html = await read('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'scripts devem ser arquivos externos');
  assert.ok(!/\son[a-z]+=/i.test(html), 'sem manipuladores inline');
  assert.match(html, /Content-Security-Policy/);
  const app = await read('src/app.js');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([...app.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]));
  const missing = [...used].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], 'ids usados no app.js e ausentes no HTML');
});

test('cores do MapTec aplicadas e ícones atualizados', async () => {
  const css = await read('assets/styles.css');
  for (const c of ['#0a2c63', '#0d3a80', '#0b4fb0', '#e8f0fb', '#f3f6fb', '#e08300']) assert.ok(css.includes(c), c);
  assert.ok(!/#123b3a|#16866b/i.test(css), 'paleta antiga removida');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(await read('assets/regua-icone.svg'), /#0a2c63/);
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.name, 'Régua — Inteligência Operacional');
  assert.equal(manifest.theme_color, '#0a2c63');
});

test('Service Worker: versão, arquivos existentes, rede primeiro e sem interceptar APIs externas', async () => {
  const sw = await read('sw.js');
  const app = await read('src/app.js');
  const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
  const appVersion = app.match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(swVersion, appVersion, 'versões do app e do cache devem andar juntas');
  const shell = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const f of shell) await access(new URL('../' + f, import.meta.url));
  for (const m of ['app.js', 'quality-engine.js', 'ai-provider.js', 'draft-template.js', 'storage.js', 'reporting.js', 'theme-boot.js']) assert.ok(shell.includes('src/' + m), m + ' deve estar no cache');
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /SKIP_WAITING/);
  assert.ok(!/addEventListener\('install'[\s\S]*?skipWaiting\(\)[\s\S]*?\}\);/.test(sw.split("addEventListener('activate'")[0]), 'install não deve ativar sozinho');
});

test('nenhuma chave de API versionada', async () => {
  for (const f of ['index.html', 'src/app.js', 'src/ai-provider.js', 'config/ai.example.json']) {
    const t = await read(f);
    assert.ok(!/AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9-]{20,}|xai-[A-Za-z0-9]{20,}/.test(t), f);
  }
  const app = await read('src/app.js');
  assert.ok(!/localStorage\.setItem\([^)]*key/i.test(app), 'chave não pode ir para o localStorage');
});
