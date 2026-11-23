# Contrato de importação Aranda — formato intermediário

A integração direta com Aranda ainda depende de autorização e documentação da API/exportação. Este contrato define o formato canônico que o adaptador deverá produzir; não afirma que os campos abaixo correspondem ao esquema nativo do Aranda.

## Envelope
Um array JSON na raiz ou um objeto com data: [].

## Campos normalizados
| Campo | Tipo | Observação |
|---|---|---|
| number | string | Identificador do chamado na origem |
| requester | string | Dado pessoal; minimizar acesso |
| tech | string | Técnico responsável, se disponível |
| openedAt | ISO 8601 string | Data/hora de abertura |
| closedAt | ISO 8601 string ou null | Data/hora de encerramento |
| solutionTime | string | Preservar semântica da origem; não assumir duração |
| building | string | Unidade/prédio |
| location | string | Bloco, setor, sala ou local |
| category | string | Categoria da origem |
| priority | string | Prioridade da origem |
| subject | string | Assunto |
| description | string | Descrição de abertura |
| assetType / asset | string | Tipo de equipamento e tombamento, se autorizado |
| comments | string | Histórico de comentários; pode conter dados pessoais |
| cause | string | Causa registrada |
| action | string | Ação realizada |
| test | string | Validação/teste |
| notes | string | Pendências e observações |

## Regras
- Preservar identificador e proveniência do sistema de origem.
- Deduplicar por sistema + número do chamado.
- Não completar dados ausentes com inferências.
- Preservar data/hora da solução sem convertê-la em duração.
- Validar timezone, datas e campos obrigatórios antes de métricas.
- Minimizar solicitante e comentários quando não forem necessários.
- O arquivo importado permanece local na sessão atual; não é transmitido ao GitHub.
