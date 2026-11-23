import json, re, sys, time
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8765/'
SITE = sys.argv[1]
OUT = sys.argv[2]
results = []
def ok(name, cond, extra=''):
    results.append((name, bool(cond), extra))
    print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(extra) if extra else ''), flush=True)

MODELS = {"models": [
  {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
  {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]},
  {"name": "models/gemini-3.7-flash", "supportedGenerationMethods": ["generateContent"]},
  {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}]}
gen_calls = []

def gemini_route(route):
    url = route.request.url
    cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json"}
    if route.request.method == 'OPTIONS':
        return route.fulfill(status=204, headers=cors)
    if url.endswith(':generateContent'):
        gen_calls.append(url)
        body = {"candidates": [{"content": {"parts": [{"text": json.dumps({"draft": "Prezado(a) Sr(a), boa tarde!\n\nConforme solicitado, o seguinte procedimento foi realizado:\n\n- Substituído o cabo HDMI.\n\n[CONFIRMAR: informar se o atendimento foi concluído]", "missing_information": ["Confirmação do usuário"], "contradictions": [], "pending_items": [], "requires_technician_confirmation": True})}]}}]}
        return route.fulfill(status=200, headers=cors, body=json.dumps(body))
    if '/models' in url:
        if 'bad' in (route.request.headers.get('x-goog-api-key') or ''):
            return route.fulfill(status=400, headers=cors, body=json.dumps({"error": {"code": 400, "message": "API key not valid. Please pass a valid API key."}}))
        return route.fulfill(status=200, headers=cors, body=json.dumps(MODELS))
    route.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, service_workers='allow')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.route(re.compile(r'https://generativelanguage\.googleapis\.com/.*'), gemini_route)

    page.goto(BASE, wait_until='networkidle')
    ok('abre a Visão geral', page.locator('#home.active').count() == 1)
    ok('cores do MapTec na barra lateral', page.eval_on_selector('.side', 'e => getComputedStyle(e).backgroundColor') == 'rgb(10, 44, 99)')
    page.screenshot(path=f'{OUT}/01-visao-geral-vazia.png', full_page=True)

    for pid in ['audit', 'history', 'reports', 'manager', 'settings', 'home']:
        page.click(f'nav [data-page="{pid}"]')
        ok(f'navega para {pid}', page.locator(f'#{pid}.active').count() == 1 and page.locator(f'nav [data-page="{pid}"][aria-current="page"]').count() == 1)

    def fields():
        if page.locator('#fieldsPanel.hidden').count(): page.click('#toggleFields')
    def menu():
        if not page.locator('#history details.menu[open]').count(): page.click('#history details.menu summary')

    # --- Pré-auditoria
    page.click('nav [data-page="audit"]')
    page.fill('#whatsappText', 'Chamado: 2026-00999\nSolicitante: Servidor Fictício\nDescrição: PC da sala não liga após queda de energia no setor.\nSetor: SECRETARIA GERAL DA CORREGEDORIA\nSala: 01')
    page.dispatch_event('#whatsappText', 'change'); page.wait_for_timeout(300)
    ok('resumo mostra o chamado sem abrir campos', '2026-00999' in page.text_content('#ticketSummary') and page.locator('#fieldsPanel.hidden').count() == 1)
    fields()
    ok('WhatsApp preenche número', page.input_value('#number') == '2026-00999')
    ok('MapTec identifica o prédio', page.input_value('#building') == 'Sede Administrativa', page.input_value('#building'))
    page.fill('#comments', '10:00 - verificado cabo de energia; 10:15 - fonte sem resposta.')
    page.fill('#action', 'Substituída a fonte de alimentação do PC e realizado teste de inicialização.')
    page.fill('#cause', 'Fonte de alimentação queimada.')
    page.wait_for_timeout(300)
    partial = page.text_content('#scoreValue')
    page.fill('#test', 'Usuário confirmou funcionamento normal.')
    page.wait_for_timeout(300)
    ok('avaliação ao vivo atualiza a nota', page.text_content('#scoreValue') == '100%', f'{partial} -> {page.text_content("#scoreValue")}')
    page.screenshot(path=f'{OUT}/02-pre-auditoria.png', full_page=True)

    draft = page.input_value('#draftOutput')
    ok('texto padrão sem confirmação não encerra', 'Prezado(a) Sr(a)' in draft and 'encerro o chamado' not in draft and '[CONFIRMAR' in draft)
    page.check('#closureConfirmed')
    page.wait_for_timeout(300)
    draft = page.input_value('#draftOutput')
    ok('texto padrão confirmado encerra e assina', 'Sendo assim, encerro o chamado.' in draft and 'Jamerson Rafael' in draft)

    page.click('#saveAudit')
    page.wait_for_timeout(400)
    ok('salvar registra no histórico', page.text_content('#total') == '1')
    ok('botão vira Atualizar após salvar', page.text_content('#saveAudit') == 'Atualizar')
    page.fill('#notes', 'Sem pendências.')
    page.click('#saveAudit'); page.wait_for_timeout(400)
    ok('salvar de novo atualiza sem duplicar', page.text_content('#total') == '1')

    # segunda análise incompleta
    page.click('#newAudit')
    if page.locator('#confirmDialog[open]').count(): page.click('#confirmOk')
    fields()
    page.fill('#subject', 'Impressora'); page.fill('#building', 'Fórum Cível'); page.fill('#description', 'erro')
    page.wait_for_timeout(300)
    ok('registro incompleto mostra "Requer revisão"', page.locator('#criteriaList .tag-st.needs_review').count() >= 2)
    page.click('#saveAudit'); page.wait_for_timeout(400)
    ok('segunda análise salva', page.text_content('#total') == '2')

    page.reload(wait_until='networkidle')
    ok('dados persistem após recarregar', page.text_content('#total') == '2')
    page.screenshot(path=f'{OUT}/03-visao-geral-com-dados.png', full_page=True)

    # --- Histórico
    page.click('nav [data-page="history"]')
    page.fill('#historySearch', '00999'); page.wait_for_timeout(150)
    ok('pesquisa filtra o histórico', page.locator('#historyList .item').count() == 1)
    page.fill('#historySearch', ''); page.select_option('#historyFilter', 'low'); page.wait_for_timeout(150)
    ok('filtro por nota', page.locator('#historyList .item').count() == 1)
    page.select_option('#historyFilter', 'all')
    page.locator('#historyList .item', has_text='2026-00999').click()
    ok('detalhe abre em diálogo', page.is_visible('#detailDialog'))
    page.screenshot(path=f'{OUT}/04-historico-detalhe.png')
    page.click('#detailOpen')
    ok('recupera análise no formulário', page.input_value('#number') == '2026-00999' and page.locator('#audit.active').count() == 1)
    ok('recupera texto preparado', 'encerro o chamado' in page.input_value('#draftOutput'))

    page.click('nav [data-page="history"]')
    with page.expect_download() as dl:
        menu(); page.click('#backup')
    path = dl.value.path()
    backup = json.load(open(path, encoding='utf-8'))
    ok('backup exportado com 2 registros', backup.get('count') == 2 and len(backup['items']) == 2)

    menu(); page.click('#clear'); page.click('#confirmOk'); page.wait_for_timeout(300)
    ok('limpar histórico com confirmação', page.text_content('#total') == '0')
    page.set_input_files('#importBackupFile', path)
    page.wait_for_selector('#confirmDialog[open]')
    ok('importação mostra prévia validada', '2 análise(s) nova(s)' in page.text_content('#confirmText'))
    page.click('#confirmOk'); page.wait_for_timeout(400)
    ok('importação restaura os registros', page.text_content('#total') == '2')
    page.set_input_files('#importBackupFile', path); page.wait_for_timeout(300)
    ok('reimportar não duplica', page.text_content('#total') == '2' and not page.is_visible('#confirmDialog'))
    bad = '/tmp/bad-backup.json'; open(bad, 'w').write('{"product":"Regua","items":"x"}')
    page.set_input_files('#importBackupFile', bad); page.wait_for_timeout(300)
    ok('backup inválido é recusado sem alterar dados', page.text_content('#total') == '2' and 'não importado' in page.text_content('#toast'))

    page.locator('#historyList .item').first.click()
    page.click('#detailDelete'); page.click('#confirmOk'); page.wait_for_timeout(400)
    ok('excluir com confirmação', page.text_content('#total') == '1')

    # --- IA (respostas simuladas; nenhuma chave real)
    page.click('nav [data-page="settings"]')
    page.fill('#geminiKey', 'bad-key-teste')
    page.click('#testGemini'); page.wait_for_timeout(500)
    ok('chave inválida mostra falha de autenticação', page.text_content('#aiStateChip') == 'Falha na autenticação' and 'recusada' in page.text_content('#aiStatus'))
    page.fill('#geminiKey', 'chave-ficticia-teste')
    page.click('#testGemini'); page.wait_for_timeout(500)
    ok('conexão simulada lista modelos', page.is_enabled('#geminiModel') and page.text_content('#aiStateChip') == 'Conectado')
    ok('Gemini 3.8 Flash selecionado automaticamente', page.input_value('#geminiModel') == 'gemini-3.8-flash')
    opts = page.eval_on_selector_all('#geminiModel option', 'o => o.map(x => x.value)')
    ok('embedding fora da lista e sem prefixo models/', 'text-embedding-004' not in opts and not any(o.startswith('models/') for o in opts), opts)
    page.select_option('#geminiModel', 'gemini-3.7-flash')
    page.screenshot(path=f'{OUT}/05-configuracoes-ia.png', full_page=True)
    page.click('#testGemini'); page.wait_for_timeout(500)
    ok('novo teste mantém a escolha manual do usuário', page.input_value('#geminiModel') == 'gemini-3.7-flash')
    ok('chave não foi salva no armazenamento', 'chave-ficticia' not in page.evaluate('() => JSON.stringify(localStorage)'))

    page.click('nav [data-page="audit"]')
    page.click('#newAudit')
    if page.locator('#confirmDialog[open]').count(): page.click('#confirmOk')
    fields()
    page.fill('#subject', 'PC sem vídeo'); page.fill('#description', 'Monitor sem imagem desde a manhã.'); page.fill('#action', 'Substituído o cabo HDMI.')
    page.click('#draftPanel details.menu summary'); page.click('#finalDraft'); page.click('#confirmOk')
    page.wait_for_timeout(800)
    ok('geração usa o modelo selecionado', gen_calls and gen_calls[-1].endswith('/models/gemini-3.7-flash:generateContent'), gen_calls[-1:] )
    ok('rascunho de IA exibido com avisos', 'Prezado' in page.input_value('#draftOutput') and page.is_visible('#draftWarnings'))
    page.screenshot(path=f'{OUT}/06-rascunho-ia.png', full_page=True)
    idb_dump = page.evaluate("""() => new Promise(r => { const q = indexedDB.open('regua-preauditoria'); q.onsuccess = () => { const db = q.result; const t = db.transaction('settings'); const g = t.objectStore('settings').getAll(); g.onsuccess = () => r(JSON.stringify(g.result)); }; })""")
    ok('chave não foi salva no IndexedDB', 'chave-ficticia' not in idb_dump)

    # --- Responsivo e tema escuro
    page.set_viewport_size({'width': 390, 'height': 844})
    page.click('nav [data-page="home"]'); page.wait_for_timeout(300)
    overflow = page.evaluate('() => document.documentElement.scrollWidth > window.innerWidth + 1')
    ok('sem rolagem horizontal no celular', not overflow)
    page.screenshot(path=f'{OUT}/07-celular.png', full_page=True)
    page.click('nav [data-page="audit"]'); page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/08-celular-pre-auditoria.png')
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.click('#themeToggle'); page.wait_for_timeout(300)
    ok('tema escuro aplicado', page.evaluate('() => document.documentElement.dataset.theme') == 'dark')
    page.screenshot(path=f'{OUT}/09-escuro.png', full_page=True)
    page.click('#themeToggle')

    # --- Offline
    page.evaluate('() => navigator.serviceWorker.ready')
    page.reload(wait_until='networkidle')
    ctrl = page.evaluate('() => !!navigator.serviceWorker.controller')
    ok('Service Worker controla a página', ctrl)
    page.unroute(re.compile(r'https://generativelanguage\.googleapis\.com/.*'))
    ctx.set_offline(True)
    page.reload(wait_until='domcontentloaded'); page.wait_for_timeout(800)
    ok('abre offline pelo cache', page.locator('.page.active').count() == 1 and page.is_visible('.side'), page.url)
    ok('histórico disponível offline', page.text_content('#total') == '1', page.text_content('#total'))
    ok('indicador offline', 'Offline' in page.text_content('#netPill'))
    page.click('nav [data-page="audit"]'); page.click('#newAudit')
    if page.locator('#confirmDialog[open]').count(): page.click('#confirmOk')
    fields()
    page.fill('#subject', 'Teste offline completo'); page.fill('#building', 'Sede'); page.fill('#description', 'Teclado não responde em nenhuma porta USB do computador.'); page.fill('#action', 'Substituído o teclado por outro do estoque.')
    page.click('#saveAudit'); page.wait_for_timeout(400)
    ok('salva offline', page.text_content('#total') == '2')
    page.wait_for_timeout(300)
    ok('texto padrão funciona offline', 'Prezado' in page.input_value('#draftOutput'))
    page.click('#draftPanel details.menu summary'); page.click('#finalDraft'); page.wait_for_timeout(300)
    ok('sem chave (após recarregar) a IA leva às Configurações', page.locator('#settings.active').count() == 1)
    page.fill('#geminiKey', 'chave-ficticia-teste'); page.click('#testGemini'); page.wait_for_timeout(600)
    ok('IA offline explica a falta de internet', 'internet' in page.text_content('#aiStatus').lower(), page.text_content('#aiStatus'))
    ctx.set_offline(False)

    # --- Preenchimento da etapa 3 a partir do comentário
    page.click('nav [data-page="audit"]')
    page.click('#newAudit')
    if page.locator('#confirmDialog[open]').count(): page.click('#confirmOk')
    fields()
    page.fill('#cause', 'Causa digitada pelo técnico.')
    page.fill('#comments', 'Foi realizada a visita técnica e foi verificado que o cabo HDMI estava danificado e foi feita a substituição do cabo. Após isso, o equipamento voltou a funcionar e o usuário confirmou. Aguardando reposição do cabo reserva.')
    page.wait_for_timeout(900)
    ok('indicadores mostram o que foi identificado', page.locator('#solutionIndicators .chip.on').count() == 4)
    ok('texto para o Aranda gerado sozinho', 'Foi feita a substituição do cabo' in page.input_value('#draftOutput'))
    page.click('#copyDraft'); page.wait_for_timeout(500)
    ok('copiar também salva a análise', 'salva' in page.text_content('#toast'))
    ok('comentário preenche ação realizada', page.input_value('#action') == 'Foi realizada a visita técnica.\nFoi feita a substituição do cabo.', page.input_value('#action'))
    ok('comentário preenche teste e pendência', 'usuário confirmou' in page.input_value('#test') and 'Aguardando' in page.input_value('#notes'))
    ok('não sobrescreve causa digitada pelo técnico', page.input_value('#cause') == 'Causa digitada pelo técnico.' and 'Mantido' in page.text_content('#commentsFeedback'))
    ok('nota atualizada após preenchimento', page.text_content('#scoreValue') != '—')
    page.screenshot(path=f'{OUT}/11-preenchimento-comentario.png', full_page=True)

    # --- Atualização: publica nova versão do SW
    page.fill('#comments', page.input_value('#comments') + ' Observação ainda não salva.')
    swp = f'{SITE}/sw.js'
    src = open(swp, encoding='utf-8').read()
    open(swp, 'w', encoding='utf-8').write(src.replace("const VERSION = '", "const VERSION = 'teste-"))
    page.state = None
    nav_log = []
    page.on('framenavigated', lambda f: nav_log.append(f.url) if f == page.main_frame else None)
    page.evaluate("() => { navigator.serviceWorker.getRegistration().then(r => r.update()); }")
    try:
        page.wait_for_selector('#updateBar:not(.hidden)', timeout=8000)
        ok('aviso discreto de nova versão', True)
        page.screenshot(path=f'{OUT}/10-aviso-atualizacao.png')
        native = []
        page.on('dialog', lambda d: (native.append(d.type), d.accept()))
        with page.expect_navigation(timeout=15000):
            page.click('#applyUpdate')
            page.wait_for_timeout(300)
            asked = page.locator('#confirmDialog[open]').count() == 1
            if asked: page.click('#confirmOk')
        ok('com dados não salvos, pergunta antes de atualizar (uma única vez)', asked and not native, native)
        page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
        keys = page.evaluate('() => caches.keys()')
        ok('após atualizar, só o cache novo permanece', keys == ['regua-shell-teste-2026.11.23.7'], keys)
    except Exception as e:
        ok('aviso discreto de nova versão', False, f'{e} | navegações: {nav_log}')
    open(swp, 'w', encoding='utf-8').write(src)

    ok('sem erros de JavaScript no console', not [e for e in errors if 'net::ERR_INTERNET_DISCONNECTED' not in e and 'Failed to fetch' not in e and 'Failed to load resource' not in e and 'CORS policy' not in e], errors[:5])
    browser.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} verificações aprovadas')
json.dump([{'name': n, 'pass': p, 'extra': str(x)} for n, p, x in results], open(f'{OUT}/results.json', 'w'), ensure_ascii=False, indent=1)
sys.exit(1 if fails else 0)
