# Fases 2 e 3 — Qualidade avançada e inteligência operacional

## Fase 2 — Qualidade avançada
- Separar abertura, acompanhamento/comentários e encerramento.
- Critérios determinísticos com evidência e recomendação.
- Pesos iniciais provisórios, sem valor de norma institucional.
- Ausência de informação não equivale automaticamente a falha técnica.
- IA como apoio: recebe campos minimizados, retorna JSON estruturado, explica evidências e sinaliza incerteza.
- Técnico revisa seus chamados; gestor faz auditoria independente diretamente sobre o conjunto obtido do Aranda.
- IA não altera registros, não encerra chamados e não altera critérios oficiais automaticamente.

## Fase 3 — Relatórios e análise
- Volume, abertura, encerramento e backlog.
- Tempo de resolução apenas com datas válidas e sem confundir timestamp de solução com duração.
- Distribuição por prédio, setor, sala, categoria, prioridade e técnico.
- Recorrência por local/equipamento/tema, sem inferir identidade.
- Comparação de períodos equivalentes e indicadores por dimensão de qualidade.
- Exportação e filtros, com cobertura e limitações explícitas.

## Integridade
1. Deduplicar por sistema de origem + identificador.
2. Preservar proveniência e valores originais.
3. Não inventar datas, SLA, categoria, tombamento ou responsável.
4. Exibir insuficiência de dados quando não for possível calcular.
5. Separar métricas calculadas de avaliações assistidas por IA.
6. Toda métrica informa período, filtros e universo analisado.

## Limite desta entrega
A interface inclui tema, configuração individual de Gemini e importação JSON local para ensaio de auditoria gerencial. Ainda não existe conexão real ao Aranda, backend multiusuário ou relatório institucional consolidado. O motor de qualidade e o módulo de relatórios precisam de testes com exportações autorizadas e dados de exemplo anonimizados.
