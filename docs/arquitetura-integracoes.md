# Arquitetura de integrações — Régua

## Fontes e responsabilidades
1. **Aranda:** fonte primária dos chamados e registros de atendimento. Técnico e gestor consultam a origem conforme suas permissões. O gestor obtém os chamados diretamente do Aranda; não recebe chamados repassados por técnicos.
2. **MapTec:** referência de prédios, blocos, andares, salas, setores e unidades.
3. **Plataforma patrimonial:** referência de equipamentos e tombamentos, limitada aos campos autorizados.

A Régua não pesquisa Google, não rastreia páginas e não consulta fontes externas genéricas. Todas as integrações são somente leitura.

## Fluxos de auditoria
- Técnico: seleção/importação autorizada dos próprios chamados e pré-auditoria.
- Gestor: consulta/importação independente de um conjunto de chamados do Aranda, com filtros compatíveis com a API.
- O sistema oficial permanece como origem e destino de qualquer correção; a Régua não escreve no Aranda.

## Sincronização dos catálogos
- Prevista diariamente às 07:00 em Boa Vista (UTC-4), equivalente a 11:00 UTC.
- Execução manual disponível no GitHub Actions.
- MapTec e patrimônio são fontes independentes.
- Timeout, validação JSON e relatório de status sem payload bruto.
- O workflow atual apenas valida endpoints e gera artefato de execução; não implementa cache compartilhado nem publicação de dados.
- URLs, autenticação e contrato real dependem dos responsáveis pelas plataformas.

## Contrato intermediário Aranda
O adaptador deverá normalizar os dados para o esquema descrito em docs/contrato-importacao-aranda.md. Esse é um contrato interno do Régua, não uma afirmação sobre o esquema nativo do Aranda. Não presumir URLs, nomes de campos, paginação ou autenticação.

## Segurança e publicação
- Tokens de integrações somente em backend/Secrets; nunca em HTML, JavaScript público, arquivos versionados ou logs.
- Não publicar solicitantes, comentários, conteúdo de chamados ou inventário restrito.
- Dados compartilhados exigem backend privado, autenticação, autorização por perfil/escopo, retenção, criptografia e auditoria de acesso.
- Gemini em modo BYOK atual mantém a chave em memória do navegador e envia diretamente ao Google; somente teste individual, com dados minimizados e sem informação pessoal/sigilosa.
- Uso institucional de IA exige backend privado, gestão de segredos, limites de uso e política de dados aprovada.

## Dependências externas
Para integrar de verdade: autorização escrita, endpoint/documentação, mecanismo de autenticação, filtros, paginação, limites, campos permitidos e responsável técnico de cada fonte.
