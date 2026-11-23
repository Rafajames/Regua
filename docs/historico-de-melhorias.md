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

## 2026.11.23.6 — Etapa 3 preenchida a partir do comentário
Novo `src/comment-parser.js` (sem IA, offline): separa o comentário do técnico em frases e classifica cada uma como ação realizada, causa, teste/confirmação ou pendência, preenchendo a etapa 3 automaticamente ao sair do campo de comentários (ou pelo botão "Preencher solução a partir do comentário"). Usa somente as frases do técnico; campos digitados manualmente não são sobrescritos; campos preenchidos automaticamente ficam destacados até serem editados. Testes: 55 unitários e 58 verificações em navegador.

## 2026.11.23.7 — Interface mínima em todas as telas
Referências: formulários de uma coluna e divulgação progressiva (Nielsen Norman Group, U.S. Web Design System) e o padrão de campo único do Linear.
- Pré-auditoria em 3 blocos numa coluna: (1) colar a mensagem — interpretada sozinha ao colar, com resumo em etiquetas e os campos escondidos em "Editar dados"; (2) seu comentário — preenche ação/causa/teste/pendência sozinho, com indicadores e "Falta: …"; (3) texto para o Aranda — gerado sozinho com o modelo padrão até o técnico editá-lo ("Refazer texto padrão" volta ao automático). "Copiar e salvar" salva a análise. IA reunida em "Melhorar com IA". Nota em selo no topo; critérios completos em "Detalhes da avaliação".
- Visão geral: 3 indicadores e últimas análises. Histórico: pesquisa, filtro e menu "Mais" (backup, importar, pasta, limpar). Relatórios: 2 indicadores, o que mais falta, por etapa e notas. Conjunto gerencial: uma linha de importação. Configurações: IA (com "Avançado"), Preferências, Dados e Critérios recolhíveis.
- Nenhuma função removida. Testes: 55 unitários, 62 verificações em navegador.

## 2026.11.23.8 — Leitor de comentários e pendências
- Leitor: "Testado…, sem sucesso" passa a ser teste (antes ia para pendência); "será + particípio" (ex.: "será avaliada") é pendência; novos verbos de ação (recolhido, retirado, enviado, desligado etc.); fragmentos curtos como "após a análise" são unidos à frase seguinte em vez de se perderem.
- Critério "Pendências contextualizadas" (critérios 0.3-experimental): também reconhece "será necessário", "em andamento", "agendado" e "retorno". Pesos inalterados. Justificativa: pendências escritas assim eram ignoradas e o critério ficava "não aplicável" mesmo com o campo preenchido.
