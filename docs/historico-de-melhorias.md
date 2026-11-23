# Histórico de melhorias

## 2026.11.23 — Auditoria técnica completa
**Correções:** deploy desbloqueado (teste quebrado); Service Worker sem mistura de versões; prompt duplicado; temperatura no Gemini 3; modelos não textuais na OpenAI; parâmetros recusados por modelos de raciocínio; troca silenciosa do modelo escolhido; regra de qualidade duplicada; gravação no IndexedDB confirmada pela transação; registros duplicados ao corrigir uma análise; download de backup no Firefox; segundo alerta ao atualizar.

**Funcional:** texto padrão sem IA (offline) com trava de encerramento e assinatura editável; modelo manual; avaliação ao vivo; recuperar/atualizar análises; histórico com pesquisa, filtro, ordenação, detalhes e exclusão; importação de backup validada; relatório de critérios mais faltantes e médias por dimensão; tela de conjunto gerencial acessível; indicador offline; proteção de armazenamento persistente.

**Visual:** paleta do MapTec · TJRR; CSS único; Pré-auditoria em duas colunas; ícones SVG; diálogos; animações discretas com respeito a movimento reduzido; tema escuro revisado.

**Segurança:** CSP sem scripts inline; `referrer` desabilitado; chave oculta em mensagens de erro; validação de URL do provedor personalizado (HTTPS, exceto localhost); saneamento de backups importados.

**Documentação:** auditoria-tecnica.md, relatorio-de-testes.md, este arquivo e seções novas em identidade visual, módulo de IA e roadmap (conteúdo anterior preservado).

## 2026.11.23.2 — Sobrecarga do provedor de IA
O Gemini 3.8 Flash passou a responder "high demand" (HTTP 503) em horários de pico. A Régua agora tenta novamente sozinha (2 novas tentativas, com espera) e, se continuar sobrecarregado, usa até 2 modelos reserva da lista testada, informando qual modelo gerou o texto. Erros de chave, permissão e cota não geram novas tentativas. Testes: 3 novos (45 no total).
