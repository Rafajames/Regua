# Módulo de IA e critérios de qualidade

## Objetivo
A IA auxilia a leitura e a explicação de evidências. Não substitui o motor determinístico, não define sozinha a nota institucional e não altera chamados.

## Provedor inicial
- Gemini Developer API por chave informada pelo próprio usuário.
- Modelo inicial sugerido: gemini-2.5-flash; o campo de modelo é editável porque disponibilidade e nomes mudam.
- Endpoint REST generateContent e cabeçalho x-goog-api-key.
- Cliente inicial em src/ai-provider.js.

## Segurança — limite desta versão
A chave é mantida somente na memória da aba e não é gravada em localStorage, IndexedDB ou no repositório. Ela é enviada diretamente do navegador ao Google. Isso é um modo de teste individual (BYOK), não uma arquitetura institucional de produção: a chave pode ser inspecionada pelo próprio usuário no navegador e a aplicação pública não consegue impor limites de uso ou políticas organizacionais.
Para uso multiusuário, a chamada deve migrar para backend privado com autenticação, autorização, gestão de segredos, rate limiting, auditoria e política de retenção. Nunca inserir chave em HTML, JavaScript versionado, GitHub Actions público ou logs.

## Dados enviados
O cliente envia apenas campos técnicos permitidos: assunto, prédio/local, descrição, comentários, causa, ação, teste, observações e tipo de equipamento. Não envia número do chamado, nome do solicitante ou nome do técnico. Isso não garante anonimização: comentários e descrições ainda podem conter nomes, telefones, e-mails, números ou dados sensíveis. A interface pede confirmação antes do envio. O usuário deve remover dados pessoais/sigilosos e obter autorização institucional antes de usar dados reais.

## Prompt-base
O avaliador deve:
1. avaliar abertura, identificação, diagnóstico, atualizações, causa, ação, validação e encerramento;
2. citar evidências textuais ou declarar insuficiência de evidência;
3. diferenciar ausência de registro de falha técnica;
4. não inferir culpa, intenção, resolução ou duração;
5. declarar incerteza e solicitar revisão humana;
6. devolver JSON estruturado;
7. nunca executar ações no Aranda.

## Critérios determinísticos
Os pesos do motor em src/quality-engine.js são provisórios e editáveis no código nesta fase. Não representam norma institucional aprovada. A IA pode sugerir revisão dos critérios, mas não pode alterar pesos/regras automaticamente. Alterações oficiais exigem aprovação administrativa, histórico de versões e justificativa.

## Evolução
- [x] Campo de chave Gemini em sessão e teste de conexão.
- [x] Prompt restritivo e resposta JSON para análise assistida.
- [x] Minimização de campos enviados pelo cliente.
- [ ] Backend seguro para uso institucional.
- [ ] Gestão de múltiplos provedores (Gemini, OpenAI, Claude e outros).
- [ ] Catálogo de critérios configurável por perfil autorizado e versionado.
- [ ] Revisão humana, trilha de auditoria e política formal de retenção.
