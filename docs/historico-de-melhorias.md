# Histórico de melhorias

## 2026.11.23 — Auditoria técnica completa
**Correções:** deploy desbloqueado (teste quebrado); Service Worker sem mistura de versões; prompt duplicado; temperatura no Gemini 3; modelos não textuais na OpenAI; parâmetros recusados por modelos de raciocínio; troca silenciosa do modelo escolhido; regra de qualidade duplicada; gravação no IndexedDB confirmada pela transação; registros duplicados ao corrigir uma análise; download de backup no Firefox; segundo alerta ao atualizar.

**Funcional:** texto padrão sem IA (offline) com trava de encerramento e assinatura editável; modelo manual; avaliação ao vivo; recuperar/atualizar análises; histórico com pesquisa, filtro, ordenação, detalhes e exclusão; importação de backup validada; relatório de critérios mais faltantes e médias por dimensão; tela de conjunto gerencial acessível; indicador offline; proteção de armazenamento persistente.

**Visual:** paleta do MapTec · TJRR; CSS único; Pré-auditoria em duas colunas; ícones SVG; diálogos; animações discretas com respeito a movimento reduzido; tema escuro revisado.

**Segurança:** CSP sem scripts inline; `referrer` desabilitado; chave oculta em mensagens de erro; validação de URL do provedor personalizado (HTTPS, exceto localhost); saneamento de backups importados.

**Documentação:** auditoria-tecnica.md, relatorio-de-testes.md, este arquivo e seções novas em identidade visual, módulo de IA e roadmap (conteúdo anterior preservado).

## 2026.11.23.2 — Sobrecarga do provedor de IA
O Gemini 3.8 Flash passou a responder "high demand" (HTTP 503) em horários de pico. A Régua agora tenta novamente sozinha (2 novas tentativas, com espera) e, se continuar sobrecarregado, usa até 2 modelos reserva da lista testada, informando qual modelo gerou o texto. Erros de chave, permissão e cota não geram novas tentativas. Testes: 3 novos (45 no total).

## 2026.11.23.3 — Cota do provedor (HTTP 429)
A Régua lê os detalhes de cota enviados pelo Google (modelo, limite diário ou por minuto, tempo de espera) e explica em linguagem simples. Como a cota do Gemini é por modelo, uma cota esgotada não gasta novas tentativas no mesmo modelo: passa direto para o modelo reserva. Testes: 3 novos (48 no total).

## 2026.11.23.4 — Reserva com todos os modelos da chave
A pedido do autor, quando o modelo escolhido está sobrecarregado ou sem cota, a Régua tenta todos os demais modelos de texto habilitados na chave (lista obtida no teste de conexão), na ordem recomendada. Só o modelo escolhido recebe novas tentativas; cada reserva é tentada uma vez, para limitar a espera. O status mostra "modelo N de M".

## 2026.11.23.5 — Fila de reservas não para em modelo descontinuado
Correção: ao chegar no gemini-2.5-flash (listado pela chave, mas "no longer available to new users"), a fila de reservas era interrompida. Agora qualquer falha do próprio modelo (indisponível, sem cota, sobrecarregado, sem permissão, tempo esgotado, resposta inválida ou bloqueada) pula para o próximo; só chave inválida, configuração ou falta de internet interrompem. Se nenhum modelo responder, a mensagem resume quantos falharam por motivo. Testes: 51.
