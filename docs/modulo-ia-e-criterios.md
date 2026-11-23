# Módulo de IA, rascunhos e critérios de qualidade

## Objetivo
A IA auxilia o técnico a transformar solicitação, histórico de comentários e anotações livres em um texto profissional de resolução. Também pode apoiar a análise de qualidade documental. O motor determinístico continua responsável pela pontuação de critérios; a IA não altera notas nem chamados.

## Assistente de resolução
O fluxo tem duas etapas:
1. **Esboço inicial:** usa a solicitação e os comentários existentes. Não afirma que uma ação foi realizada.
2. **Versão após atendimento:** acrescenta as anotações livres do técnico e produz uma minuta final, sem confundir ações anteriores com a execução atual.

A resposta estruturada contém o texto sugerido, fatos utilizados, informações ausentes, contradições, pendências e indicação de confirmação humana. O técnico deve revisar e copiar manualmente o texto para o Aranda. A aplicação não envia nem encerra chamados.

## Regras de integridade
- Não inventar diagnóstico, ações, equipamentos, tombamentos, datas, testes, resultados, nomes ou autorizações.
- Diferenciar solicitação, comentários anteriores e ações realizadas pelo técnico.
- Não declarar resolução, encerramento ou validação sem confirmação expressa.
- Preservar modelos e patrimônios exatamente como fornecidos.
- Marcar fatos ausentes com [CONFIRMAR: ...] e listar perguntas necessárias.
- Apontar contradições para revisão, sem escolher arbitrariamente uma versão.
- A redação pode seguir o padrão de saudação, introdução, procedimentos, pendências, encerramento condicional, disponibilidade e assinatura.

## Provedores disponíveis
- Google Gemini (lista de modelos pela API Gemini).
- OpenAI (endpoint de modelos).
- Anthropic Claude (endpoint de modelos e Messages API).
- xAI Grok (API compatível com OpenAI).
- Endpoint personalizado compatível com OpenAI.

O usuário informa o provedor e a chave. O sistema tenta identificar modelos disponíveis automaticamente. Se o endpoint não expuser catálogo, houver restrição CORS ou o provedor não permitir consulta, a identificação automática pode falhar; a integração não deve inventar nomes de modelos. A seleção de um modelo compatível é necessária antes de gerar conteúdo.

## Segurança — limite desta versão
A chave é mantida somente na memória da aba, não em localStorage, IndexedDB ou no repositório. Ela é enviada diretamente do navegador ao provedor. É um modo de teste individual (BYOK), não arquitetura institucional de produção. A chave pode ser inspecionada pelo próprio usuário no navegador; a aplicação pública não impõe limites de uso nem políticas organizacionais.
Para uso institucional, as chamadas devem migrar para backend privado com autenticação, autorização, gestão de segredos, rate limiting, auditoria e política de retenção. Nunca inserir chave em HTML, JavaScript versionado, GitHub Actions público ou logs.

## Dados enviados
Na geração de rascunhos são enviados os campos que o técnico preencheu: solicitação, comentários/histórico, anotações de atendimento e assinatura opcional. Isso pode conter dados pessoais ou sigilosos. A interface pede confirmação antes do envio. O usuário deve minimizar os dados, remover identificadores desnecessários e obter autorização institucional antes de usar dados reais.

## Armazenamento individual
- O IndexedDB do navegador é a persistência primária.
- O técnico pode autorizar uma pasta local; em navegadores compatíveis, o Régua atualiza nela o arquivo `regua-meus-chamados.json`.
- O identificador da pasta fica no IndexedDB e a permissão pode precisar ser renovada pelo navegador.
- Se o navegador não oferecer File System Access API, o histórico permanece no IndexedDB e pode ser exportado em JSON.
- A pasta local é individual e não sincroniza registros entre computadores ou técnicos.

## Critérios determinísticos
Os pesos do motor em `src/quality-engine.js` são provisórios e editáveis no código nesta fase. Não representam norma institucional aprovada. A IA pode sugerir revisão dos critérios, mas não pode alterar pesos/regras automaticamente. Alterações oficiais exigem aprovação administrativa, histórico de versões e justificativa.

## Estado
- [x] Assistente de rascunho inicial e versão pós-atendimento.
- [x] Saída estruturada com fatos, ausências, contradições e pendências.
- [x] Provedores Gemini, OpenAI, Claude, Grok e compatível.
- [x] Descoberta de modelos quando suportada pela API.
- [x] Chaves mantidas somente em memória nesta versão experimental.
- [x] Cópia JSON em pasta local autorizada e IndexedDB como persistência primária.
- [ ] Backend seguro para uso institucional.
- [ ] Integração real com Aranda, MapTec API e plataforma patrimonial.
- [ ] Catálogo de critérios configurável e versionado por perfil autorizado.
- [ ] Testes de integração com contas reais de cada provedor e revisão de políticas institucionais.
