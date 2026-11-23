# Relatório de testes — 23/11/2026

## 1. Testes automatizados (`npm test`, Node 22)
**42 testes, 42 aprovados, 0 falhas.**

| Arquivo | Cobertura |
|---|---|
| tests/quality-engine.test.mjs | nota 100%, campos vazios, "requer revisão" × "não evidenciado", critério condicional de pendência, aplicação de pesos, reprodutibilidade, faixas |
| tests/ai-provider.test.mjs | Gemini 3.8 Flash recomendado, remoção de `models/`, exclusão de modelos não textuais, preservação da escolha, geração com o modelo selecionado, `systemInstruction` sem duplicação, sem temperature no Gemini 3, erro "no longer available", bloqueio/vazio, classificação de HTTP, chave ocultada, rede/CORS, filtros OpenAI, retry sem temperature, cabeçalhos do Claude, endpoint xAI, validação de URL personalizada e modelo manual, recusa sem chave/modelo, alerta de encerramento |
| tests/draft-template.test.mjs | modelo de referência, sem encerramento sem confirmação, pendência bloqueia encerramento, marcador sem ação, assinatura editável, saudação por horário |
| tests/storage.test.mjs | ida e volta do backup, formato v1, duplicidade, arquivos inválidos, outro produto, limite de itens, saneamento contra HTML/nota inválida |
| tests/static-page.test.mjs | telas e campos, créditos, ausência de script inline, ids do JS existentes no HTML, paleta MapTec, manifest, Service Worker (versão = app, arquivos do cache existem, não intercepta outras origens), nenhuma chave versionada |

Todas as chamadas de IA usam `fetch` simulado. **Nenhuma integração real com provedores foi testada.**

## 2. Teste em navegador (`tests/e2e/regua_e2e.py`, Chrome headless + Playwright, servidor local)
**54 verificações, 54 aprovadas.**

Abrange: abertura e cores; navegação nas 6 telas; WhatsApp + MapTec; avaliação ao vivo; texto padrão com e sem confirmação; salvar, atualizar sem duplicar, persistência após recarregar; pesquisa, filtro, detalhe, recuperar análise; exportar, limpar, importar com prévia, reimportar sem duplicar, recusar backup inválido, excluir; IA com respostas simuladas (chave inválida, listagem, 3.8 Flash automático, troca manual preservada, geração usando o modelo escolhido, chave ausente de localStorage e IndexedDB); celular 390 px sem rolagem horizontal; tema escuro; **offline real** (Service Worker controlando, reabertura sem rede, salvar e texto padrão offline, mensagem de falta de internet na IA); **atualização** (aviso de nova versão, confirmação com dados não salvos, cache antigo removido); console sem erros de JavaScript.

Execução: `python3 -m http.server 8765` na raiz e `python3 tests/e2e/regua_e2e.py <pasta-servida> <pasta-capturas>`.

## 3. Não testado
- Firefox e Safari (somente Chromium nesta auditoria). O código evita APIs exclusivas, exceto a cópia em pasta (Chrome/Edge), que tem alternativa (backup).
- Chamadas reais aos provedores de IA (sem chaves).
- Execução do GitHub Actions após estes commits (depende da publicação — ver relatório final).
