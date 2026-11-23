# Régua — Inteligência Operacional

A Régua apoia a pré-auditoria e a mensuração da qualidade dos atendimentos de TI. **Não é um sistema de chamados**: não cria, distribui, encaminha, atualiza nem encerra registros no Aranda.

## Dois fluxos de auditoria
- **Técnico:** mensura e revisa os próprios atendimentos.
- **Gestor/supervisor:** realiza auditoria independente, obtendo o conjunto diretamente do Aranda por integração ou exportação autorizada. Não depende de receber chamados encaminhados pelos técnicos.

Aranda é a fonte dos chamados. MapTec e a plataforma patrimonial são fontes de referência de local e equipamento, condicionadas às APIs e autorizações correspondentes.

## Funcionalidades presentes nesta versão
- Pré-auditoria manual e interpretação inicial de mensagens do WhatsApp.
- Snapshot do catálogo MapTec para apoiar identificação de local.
- Histórico individual no IndexedDB do navegador e exportação JSON.
- Critérios determinísticos de qualidade por abertura, acompanhamento e encerramento.
- Tema claro, escuro e automático, com identidade azul derivada dos tokens CSS do MapTec.
- Importação gerencial de JSON normalizado apenas em memória/sessão local.
- Relatórios locais, sem alegação de indicadores institucionais consolidados.
- Assistente de resolução em duas etapas: esboço inicial e versão após atendimento, com revisão de fatos ausentes e contradições.
- Provedores configuráveis (Gemini, OpenAI, Claude, Grok e endpoint compatível), com descoberta de modelos quando a API permite.
- Histórico individual no IndexedDB e cópia JSON automática em pasta escolhida pelo técnico quando o navegador oferece File System Access API.

## Limitações importantes
- A importação gerencial não é integração direta com Aranda; depende de JSON no contrato intermediário em docs/contrato-importacao-aranda.md.
- As chaves dos provedores permanecem apenas na memória da aba e são enviadas diretamente às APIs. É um modo experimental individual; não usar com dados pessoais/sigilosos ou em ambiente institucional sem autorização.
- A descoberta de modelos depende do suporte da API do provedor e das permissões/CORS; provedores compatíveis podem exigir URL base e seleção manual se não expuserem catálogo.
- A cópia em pasta depende de navegador compatível e autorização explícita. O IndexedDB continua sendo a persistência primária; a cópia JSON é uma redundância local, não sincronização entre computadores.
- Não há backend multiusuário nem histórico centralizado.
- As integrações reais de Aranda, MapTec API e patrimônio dependem de URLs, contratos, credenciais e autorização.
- O workflow de sincronização atual valida endpoints e gera relatório; não publica dados sincronizados no frontend.

## Documentação
- Estado atual e roadmap: docs/roadmap.md
- Especificação funcional: docs/especificacao-funcional.md
- Arquitetura de integrações: docs/arquitetura-integracoes.md
- Fases 2 e 3: docs/fases-2-e-3.md
- Contrato intermediário Aranda: docs/contrato-importacao-aranda.md
- Módulo de IA e critérios: docs/modulo-ia-e-criterios.md
- Prompt de auditoria: config/prompts/quality-review.md
- Identidade visual: docs/identidade-visual.md

## Integrações e segredos
GitHub Actions Secrets esperados para os catálogos:
- REGUA_MAPTEC_API_URL
- REGUA_MAPTEC_API_TOKEN
- REGUA_PATRIMONIO_API_URL
- REGUA_PATRIMONIO_API_TOKEN

Não coloque chaves no frontend ou no repositório. Para uso institucional, IA e dados de chamados devem passar por backend privado com autenticação, autorização, limites de uso e retenção definida.

## Testes automatizados

Execute `npm test` com Node.js 22 ou superior.

## Execução local
```
python -m http.server 8000
```
Abra http://localhost:8000.
