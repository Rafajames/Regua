# Auditoria técnica — 23/11/2026

Escopo: repositório inteiro (index.html, src/, tests/, config/, assets/, data/, docs/, sw.js, manifest, package.json, workflows).

## Diagnóstico
| # | Problema encontrado | Gravidade | Situação |
|---|---|---|---|
| 1 | Teste `prompt do assistente…` falhava por diferença de maiúscula; o workflow roda `npm test` antes do deploy, então **nenhum commit recente era publicado** — inclusive a correção do Gemini 3.8 Flash. | Crítica | Corrigido |
| 2 | Service Worker servia `index.html` da rede, mas módulos JS do cache (stale-while-revalidate): versões misturadas após publicação e risco de continuar com `ai-provider.js` antigo. `skipWaiting` automático, sem aviso ao usuário. | Alta | Corrigido: rede primeiro para tudo, cache como reserva, aviso "Nova versão disponível" |
| 3 | Prompt de sistema enviado duas vezes (como sistema e dentro da mensagem). | Média | Corrigido |
| 4 | Gemini 3 recebia `temperature: 0.2` (Google recomenda manter o padrão nesta família). | Média | Corrigido |
| 5 | Lista da OpenAI incluía whisper, dall-e, tts, embeddings; modelos de raciocínio recusavam `temperature`. | Média | Corrigido |
| 6 | Erros do provedor mostrados crus e truncados; CORS e falta de internet indistinguíveis. | Média | Corrigido (mensagens por categoria) |
| 7 | Sem modelo manual para provedores sem catálogo. | Média | Implementado |
| 8 | Novo teste de conexão sempre trocava o modelo escolhido pelo primeiro da lista. | Média | Corrigido (preserva escolha válida) |
| 9 | Regra de qualidade duplicada no `index.html` (fallback) com comportamento diferente do motor, usada se o formulário fosse enviado antes do módulo carregar. | Média | Removido; módulo importado diretamente |
| 10 | Estados dos critérios não seguiam a referência (tudo virava "review"). | Baixa | Corrigido sem alterar a nota |
| 11 | Gravação no IndexedDB resolvia no `onsuccess` da requisição, não no `oncomplete` da transação. | Média | Corrigido |
| 12 | Cada envio criava registro novo: impossível corrigir uma análise sem duplicar. | Média | Corrigido (recuperar e atualizar o mesmo registro) |
| 13 | Sem importação de backup, sem exclusão individual, sem detalhe, sem pesquisa/filtros. | Média | Implementado, com validação antes de gravar |
| 14 | `URL.revokeObjectURL` logo após `click()` podia cancelar o download no Firefox. | Baixa | Corrigido |
| 15 | Três camadas de CSS sobrepostas (azul → teal) no `index.html`; scripts inline e `onclick` impediam CSP. | Média | CSS em `assets/styles.css`, JS em `src/app.js`, CSP aplicada |
| 16 | Tela "Auditoria gerencial" existia mas estava oculta e inacessível pelo menu. | Baixa | Exposta como "Conjunto gerencial" |
| 17 | Labels sem `for`, foco não gerenciado na troca de tela, sem link "pular para o conteúdo". | Baixa | Corrigido |
| 18 | Confirmar atualização com dados não salvos gerava um segundo alerta do navegador. | Baixa | Corrigido (achado no teste em navegador) |

## Decisões técnicas
- **Sem backend, sem dependências novas.** Tudo continua estático no GitHub Pages.
- **Não migrar para a Interactions API**: `generateContent` em `v1beta` é o endpoint documentado para `gemini-3.8-flash`.
- **Chave só em memória**; provedor, modelo e URL base (não sensíveis) ficam no IndexedDB para não se perderem.
- **Cores do MapTec** por pedido do autor (ver docs/identidade-visual-e-experiencia.md).
- **Atualização do Service Worker sob controle do usuário**: nada é recarregado no meio de uma pré-auditoria.
- **CSP** com `connect-src https:` (e localhost) porque a URL do provedor personalizado é configurável.
- **Arquivos separados** (`app.js`, `storage.js`, `draft-template.js`, `styles.css`) para permitir CSP, cache coerente e testes unitários — sem reescrever regras de negócio.

## Riscos antes de uso institucional
- Chave de IA no navegador e envio direto ao provedor: exige backend privado.
- IndexedDB pode ser apagado pelo navegador; o botão "Proteger dados" ajuda, mas backup continua necessário.
- Sem autenticação nem trilha de auditoria; dados ficam por navegador.
- Pesos experimentais sem aprovação institucional.
- Critérios de solução são avaliados mesmo em chamados em andamento (penaliza registros parciais legítimos) — decisão pendente.

## Integrações futuras
| Integração | Estado | O que falta |
|---|---|---|
| MapTec | Snapshot local `data/maptec-locations.json`; workflow diário só valida endpoint se configurado. | URL de API somente leitura, token (secret `REGUA_MAPTEC_API_URL/TOKEN`), contrato de campos. |
| Patrimônio | Desabilitado. | API autorizada, contrato, regra de privacidade. |
| Aranda | Apenas importação manual de JSON normalizado em memória. | API/exportação autorizada, adaptador do formato nativo. Nenhuma escrita será implementada. |
