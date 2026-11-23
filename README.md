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
- Configuração individual do Gemini, teste de conexão e análise assistida com prompt restritivo.

## Limitações importantes
- A importação gerencial não é integração direta com Aranda; depende de JSON no contrato intermediário em docs/contrato-importacao-aranda.md.
- A chave Gemini é mantida na memória da aba e enviada do navegador diretamente ao Google. É apenas um modo de teste individual; não usar com dados pessoais/sigilosos ou em ambiente institucional sem autorização.
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

## Execução local
```
python -m http.server 8000
```
Abra http://localhost:8000.
