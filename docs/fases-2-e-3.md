# Fases 2 e 3 — Qualidade avançada e inteligência operacional

## Fase 2 — Qualidade avançada
- Separar avaliação em abertura, acompanhamento/comentários e encerramento.
- Critérios objetivos determinísticos, com evidência e justificativa.
- Estados: atendido, parcial, não atendido e não avaliável.
- Ausência de informação não deve ser tratada como prova de falha quando o critério não se aplica.
- Pesos e limites configuráveis; valores iniciais são parâmetros provisórios, não norma institucional.
- IA futura apenas como apoio: recebe dados minimizados, devolve JSON estruturado, explica evidências e sinaliza incerteza. A IA não altera chamados nem decide encerramento.
- Nenhum envio a provedor de IA sem configuração, consentimento institucional e proteção de dados.

## Fase 3 — Relatórios e análise
- Volume de aberturas e encerramentos por período.
- Backlog e idade dos chamados, quando os campos existirem.
- Tempo de resolução usando datas válidas; não confundir data/hora de solução com duração.
- Distribuição por prédio, setor, sala, categoria, prioridade e técnico.
- Recorrência por local/equipamento/tema, sem inferir identidade.
- Comparação entre períodos equivalentes.
- Indicadores de qualidade separados por dimensão.
- Recomendações explicáveis, vinculadas aos dados que as sustentam.
- Exportação CSV/JSON e relatórios imprimíveis.
- Filtros e indicação clara de cobertura/ausência dos dados.

## Regras de integridade
1. Deduplicar por identificador do chamado e sistema de origem.
2. Preservar valor original e proveniência dos dados importados.
3. Não inventar datas, SLA, categoria, tombamento ou responsável.
4. Exibir "sem dados suficientes" quando não for possível calcular.
5. Separar indicadores calculados de avaliações assistidas por IA.
6. Toda métrica deve informar período, filtros e quantidade de registros considerados.

## Limite desta entrega
Esta documentação e os módulos de integração preparam o projeto. A ativação das métricas consolidadas depende de fonte de chamados autorizada e de um backend compartilhado; o IndexedDB atual continua local a cada navegador.
