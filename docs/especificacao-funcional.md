# Régua — Especificação funcional

## 1. Propósito

A Régua é uma plataforma de pré-auditoria e inteligência operacional dos serviços de TI em prédios/unidades. **Não é um sistema de chamados**: não abre, distribui, encaminha, atualiza nem encerra chamados no sistema oficial.

Dois fluxos complementares:
1. **Pré-auditoria individual:** o técnico copia/informa os dados de um chamado já existente e verifica a qualidade da abertura, dos comentários e da solução proposta antes de encerrar no sistema oficial.
2. **Auditoria operacional:** analisa registros cadastrados ou importados para medir volume, encerramentos, tempos, recorrência, qualidade e diferenças entre prédios/unidades.

A Régua não altera o chamado original e não bloqueia seu encerramento. O técnico faz eventuais correções no sistema de origem.

## 2. Pré-auditoria individual

Dados que o técnico poderá informar:
- Número do chamado e técnico (opcionais).
- Prédio e localização.
- Assunto e descrição original.
- Equipamento, patrimônio ou sistema.
- Comentários e atualizações.
- Causa identificada.
- Ação realizada/solução proposta.
- Teste realizado ou confirmação do usuário.
- Observações e pendências.

A Régua apresenta critérios atendidos, itens a revisar e orientações. A checagem inicial usa regras locais simples; não é avaliação por IA nem aprovação formal. O histórico é local ao navegador.

## 3. Dados para auditoria operacional

| Campo | Tipo | Obrigatoriedade |
|---|---|---|
| Número do chamado | Texto | Obrigatório; deduplicação |
| Data/hora de abertura | Data/hora | Obrigatório |
| Data/hora de encerramento | Data/hora | Opcional |
| Prédio | Texto/lista | Obrigatório |
| Andar, setor, sala | Texto | Conforme cadastro |
| Solicitante | Texto | Opcional; anonimizar para IA |
| Canal | Lista | Obrigatório |
| Assunto e descrição | Texto | Obrigatórios |
| Categoria/tema | Texto/lista | Obrigatório |
| Prioridade e status | Lista | Obrigatórios |
| Técnico responsável | Texto | Opcional |
| Comentários com data/hora | Lista | Opcional |
| Resolução | Texto | Ao encerrar |
| Reaberto? | Booleano | Opcional |

## 4. Métricas determinísticas

Calculadas pelo sistema, sem IA:
- Total por data de abertura; médias por dia útil, semana e mês.
- Picos por dia da semana e hora.
- Temas recorrentes e variação entre períodos.
- Chamados por prédio, andar, setor, sala e canal.
- Tempo até primeira resposta, quando houver comentário datado.
- Tempo médio e mediano de resolução.
- Cumprimento de SLA configurado.
- Backlog e idade média.
- Taxa de reabertura.
- Reincidência por local/solicitante e tema em até 30 dias.
- Carga e tempo por técnico.

Dados ausentes não podem ser inferidos; a métrica deve ser marcada como indisponível.

## 5. Auditoria de qualidade — evolução

Três dimensões com notas de 0 a 10:
- **Abertura:** local completo; equipamento/sistema identificado; sintoma claro; contato/responsável; categoria e prioridade coerentes.
- **Comentários:** primeira atualização no prazo; intervalos sem atualização; pendências explicadas; tom profissional e informação útil.
- **Encerramento:** causa identificada; ação descrita; teste/confirmação; linguagem clara; compatibilidade com a abertura.

Parte dos critérios é objetiva e parte poderá ser avaliada pelo Gemini com JSON estruturado e justificativa por critério. Pesos e prazos ainda são parâmetros em aberto e devem ser configuráveis.

## 6. Relatórios

Relatórios por dia ou intervalo, com:
1. Resumo executivo.
2. Volume de aberturas e encerramentos.
3. Temas e tendências.
4. Locais e reincidência.
5. Tempo, SLA e backlog.
6. Qualidade por dimensão.
7. Equipe, com opção de ocultar seção individual.
8. Recomendações fundamentadas nos dados.

Filtros: prédio, andar, tema, técnico e prioridade.

## 7. Arquitetura e privacidade

- Frontend estático HTML/CSS/JavaScript no GitHub Pages.
- IndexedDB local por navegador/dispositivo.
- Não há sincronização ou base central entre técnicos nesta versão.
- Backup/importação JSON e CSV.
- Anonimização antes de qualquer envio à IA.
- Chave Gemini nunca embutida no JavaScript público nem persistida no navegador.
- Consolidação entre usuários exige backend, autenticação, banco compartilhado, perfis e política de retenção.

## 8. Fases

1. Base manual e pré-auditoria inicial.
2. Qualidade avançada, critérios configuráveis e Gemini seguro.
3. Relatórios completos, comparação de períodos e recomendações.
4. Importação em lote de CSV/Aranda.
5. Automação, condicionada a permissões e integrações autorizadas.

## 9. Decisões pendentes

- Lista oficial de categorias/temas.
- Prazos oficiais de SLA.
- Pesos dos critérios de qualidade.
- Política de circulação dos relatórios.
- Arquitetura de autenticação e consolidação central.
- Detalhes de integração com Aranda.
