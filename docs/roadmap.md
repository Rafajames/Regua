# Régua — Estado atual e roadmap

Atualizado em 23/11/2026. Este documento separa implementação confirmada, fundações parciais e dependências externas.

## Produto e decisões consolidadas
- Régua é uma plataforma de pré-auditoria e inteligência operacional; não substitui o Aranda e não cria, distribui, encaminha, atualiza ou encerra chamados.
- Técnico: mensura e revisa os próprios atendimentos.
- Gestor/supervisor: realiza auditoria independente, obtendo o conjunto de chamados diretamente do Aranda (API ou exportação autorizada). Não recebe chamados encaminhados pelos técnicos e não depende de colaboração/seleção deles.
- Aranda é a fonte dos chamados. MapTec é referência de prédios/unidades. A plataforma patrimonial é referência de equipamentos/tombamentos, condicionada a API e autorização.
- APIs são somente leitura. Sem crawling genérico ou pesquisa pública.
- Sincronização de catálogos prevista às 07h de Boa Vista (11h UTC), com opção manual.
- Dados de chamados e inventário restrito não podem ser versionados em repositório público.

## Já implementado (confirmado no repositório)
- [x] Aplicação estática HTML/CSS/JavaScript.
- [x] Pré-auditoria manual e interpretação inicial de mensagem do WhatsApp.
- [x] Snapshot do catálogo MapTec para apoiar identificação do local.
- [x] Histórico individual no IndexedDB e exportação JSON.
- [x] Workflow Pages e workflow de verificação de fontes.
- [x] Script de validação de endpoints e relatório técnico sem payload bruto.
- [x] Motor de qualidade determinístico por critérios e dimensões.
- [x] Tema claro, escuro e automático, com identidade azul derivada do MapTec.
- [x] Área de importação JSON normalizado para auditoria gerencial em sessão local (não é conexão direta com Aranda).
- [x] Área inicial de relatórios locais.
- [x] Configuração individual do Gemini por chave em memória, teste de conexão e análise assistida com dados minimizados.

## Fundamentos parciais / não considerar produção
- A importação gerencial aceita JSON normalizado, mas ainda não conhece o formato real de exportação do Aranda.
- A chave Gemini é enviada do navegador diretamente à API e não é adequada para uso institucional/multiusuário.
- Histórico e importações permanecem locais ao navegador/sessão; não existe banco compartilhado de auditorias.
- Relatórios dependem dos dados disponíveis localmente.
- O sincronizador atual valida endpoints e gera artefato de status; não publica cache seguro para o frontend nem atualiza catálogo compartilhado.

## Próximas etapas
### Prioridade 1 — Fonte de chamados e segurança
- [ ] Obter autorização e documentação da API/exportação Aranda: endpoint, autenticação, filtros, paginação, limites e campos.
- [ ] Implementar adaptador Aranda somente leitura e mapeamento para o contrato canônico.
- [ ] Projetar backend privado para contas, perfis, auditorias compartilhadas, segregação por escopo e trilha de auditoria.
- [ ] Definir política de retenção, minimização e acesso a dados pessoais.

### Prioridade 2 — Gestão e auditoria
- [ ] Perfis e permissões de técnico, supervisor e administrador.
- [ ] Auditoria independente por período, técnico, prédio, setor, categoria e situação.
- [ ] Histórico centralizado e reprodutível, com versão dos critérios usada em cada auditoria.
- [ ] Exportações controladas e relatórios com cobertura/limitações explícitas.

### Prioridade 3 — Catálogos e patrimônio
- [ ] Receber APIs autorizadas do MapTec e da plataforma patrimonial.
- [ ] Implementar sincronização com detecção de alterações, última cópia válida e status por fonte.
- [ ] Manter dados restritos fora do repositório público.

### Prioridade 4 — IA e governança
- [ ] Migrar chamadas Gemini para backend seguro antes de uso institucional.
- [ ] Adicionar provedores alternativos sem acoplar a interface a um fornecedor.
- [ ] Painel administrativo de critérios/pesos versionados.
- [ ] Fluxo de aprovação humana e monitoramento de qualidade/deriva.

### Prioridade 5 — Qualidade técnica
- [ ] Ampliar testes automatizados de importação, contratos de dados e fluxos de IA.
- [ ] Acessibilidade, revisão de contraste e testes em dispositivos.
- [ ] Validar execução do GitHub Pages e dos workflows após cada release.

## Dependências externas
Não há URLs, credenciais, contratos ou permissões confirmados para Aranda, MapTec API ou plataforma patrimonial. Não inventar endpoints nem presumir acesso. A integração real só começa após esses dados e autorização.

## Atualização de 23/11/2026
Concluído nesta revisão (detalhes em docs/historico-de-melhorias.md): desbloqueio do deploy, módulo de IA revisado, modelo manual, texto padrão offline com trava de encerramento, histórico com pesquisa/filtros/detalhes/recuperação/exclusão, importação validada de backup, atualização controlada do Service Worker, CSP, cores do MapTec e testes em navegador.

Próximos passos sugeridos:
- [ ] Rodar o teste de navegador (tests/e2e) no GitHub Actions.
- [ ] Validar uma chamada real com cada provedor usando chaves de teste do autor.
- [ ] Decidir institucionalmente os pesos e se critérios de solução devem ser "não aplicáveis" em chamados ainda em andamento.
- [ ] Backend privado antes de qualquer uso com dados reais.
