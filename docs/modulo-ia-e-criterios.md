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
- Google Gemini (lista de modelos pela API Gemini); nesta versão, `gemini-3.8-flash` é priorizado como modelo padrão quando a conta o disponibiliza. Modelos antigos ficam abaixo na lista, e a seleção pode ser alterada após testar a conexão.
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
- [x] Descoberta de modelos quando suportada pela API, com priorização do Gemini 3.8 Flash e seleção manual habilitada após o teste.
- [x] Chaves mantidas somente em memória nesta versão experimental.
- [x] Cópia JSON em pasta local autorizada e IndexedDB como persistência primária.
- [ ] Backend seguro para uso institucional.
- [ ] Integração real com Aranda, MapTec API e plataforma patrimonial.
- [ ] Catálogo de critérios configurável e versionado por perfil autorizado.
- [ ] Testes de integração com contas reais de cada provedor e revisão de políticas institucionais.

---

## Atualização de 23/11/2026 (auditoria técnica)
- **Gemini 3.8 Flash** confirmado na documentação oficial como modelo GA no mesmo endpoint `v1beta/models/{modelo}:generateContent`. Não houve migração para a Interactions API: não há necessidade concreta.
- O Gemini passa a receber o prompt em `systemInstruction` (antes o prompt de sistema era enviado duas vezes). Para a família Gemini 3 a `temperature` não é enviada, seguindo a recomendação do Google de manter o padrão.
- A lista de modelos é ordenada: `gemini-3.8-flash` primeiro, depois versões estáveis mais novas; modelos de voz, imagem e embeddings são removidos. O prefixo `models/` é removido uma única vez.
- A escolha do usuário é preservada: ao testar novamente, o modelo escolhido antes é mantido se continuar disponível; se não existir mais, volta ao recomendado (o sistema não fica preso a um modelo antigo).
- **Modelo manual**: campo para digitar o identificador quando o provedor não oferece catálogo (comum em APIs compatíveis). Tem prioridade sobre a lista e é validado na primeira geração.
- OpenAI: a lista exclui modelos que não geram texto (whisper, dall-e, tts, embeddings, realtime, moderação). Quando o modelo recusa `temperature` ou `response_format`, o parâmetro é removido e a chamada repetida automaticamente.
- Erros classificados em linguagem simples: autenticação, permissão, modelo indisponível, cota, rede/CORS, tempo esgotado, instabilidade do provedor, conteúdo bloqueado e resposta inválida. O detalhe técnico do provedor aparece em letra menor, com a chave ocultada.
- **Texto padrão sem IA**: o modelo de referência (Prezado(a) Sr(a)… Atenciosamente, assinatura) é montado localmente, inclusive offline, apenas com o que foi registrado, com `[CONFIRMAR: …]` onde faltar informação.
- **Trava de encerramento**: "Sendo assim, encerro o chamado." e a frase da pesquisa de satisfação só entram quando o técnico marca "apto para encerramento" e não há pendência registrada. Textos da IA que declarem encerramento sem confirmação recebem alerta antes da cópia.
- **Estados dos critérios** passam a seguir a referência: Atendido, Não evidenciado (campo vazio), Requer revisão (há conteúdo, mas insuficiente/genérico) e Não aplicável. A fórmula da nota e os pesos não mudaram; ambos os estados negativos valem zero, como antes. Pesos continuam provisórios (`CRITERIA_VERSION = 0.2-experimental`).

### Acesso direto pelo navegador (CORS)
| Provedor | Situação |
|---|---|
| Gemini | Permite chamadas do navegador com a chave no cabeçalho `x-goog-api-key`. |
| OpenAI | Permite; a própria OpenAI desaconselha chave no navegador em produção. |
| Claude | Permite somente com o cabeçalho `anthropic-dangerous-direct-browser-access: true` (enviado). |
| Grok (xAI) | Não confirmado. Se o navegador bloquear, a Régua mostra "conexão ou CORS". |
| Personalizado | Depende de o servidor liberar CORS para `rafajames.github.io`. HTTP só é aceito para localhost. |

Nenhuma integração real foi testada com chaves verdadeiras nesta auditoria; os testes usam respostas simuladas.
