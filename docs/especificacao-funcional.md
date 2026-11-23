# Régua — Especificação funcional

## 1. Propósito
Plataforma de pré-auditoria e inteligência operacional dos serviços de TI. Não abre, distribui, encaminha, atualiza nem encerra chamados no sistema oficial.

## 2. Fluxos
1. Pré-auditoria individual de chamado existente.
2. Auditoria operacional de registros importados/cadastrados.
3. Sincronização diária dos catálogos de referência MapTec e patrimônio, exclusivamente por APIs autorizadas.

## 3. Qualidade
Três dimensões: abertura, acompanhamento/comentários e encerramento. Cada critério retorna estado, justificativa e evidência. O motor determinístico está em `src/quality-engine.js`; a ausência de dados não pode ser tratada como fato presumido. IA futura será apenas assistiva, com dados minimizados e resposta estruturada, sem alterar chamados.

## 4. Indicadores
Total, aberturas, encerramentos, backlog, tempo médio/mediano de resolução quando houver datas válidas, distribuição por prédio/categoria/prioridade, cobertura dos campos e comparação de períodos. Funções iniciais em `src/reporting.js`. SLA, recorrência e carga por técnico dependem de dados confiáveis e parâmetros oficiais.

## 5. Integrações
- MapTec: prédios, blocos, andares, salas, setores e unidades.
- Patrimônio: equipamentos e tombamentos, conforme campos autorizados.
- Agendamento diário às 07h de Boa Vista (11h UTC), com execução manual.
- Credenciais somente em GitHub Actions Secrets.
- APIs somente leitura; timeout, validação de JSON e logs sem payload bruto.
- URLs, autenticação e formatos reais ainda dependem dos responsáveis pelas plataformas.
- O workflow atual valida as APIs e guarda relatório técnico; não publica dados de API no site.

## 6. Privacidade e arquitetura
GitHub Pages é público e IndexedDB é local ao navegador. Não armazenar dados pessoais de chamados ou inventário restrito no repositório público. Consolidação multiusuário exige backend privado, autenticação, autorização e política de retenção.

## 7. Fases
1. Base manual e pré-auditoria inicial.
2. Motor de qualidade por dimensões, critérios e preparação para IA segura.
3. Indicadores, comparação de períodos e relatórios.
4. Importação em lote de CSV/Aranda.
5. Automação autorizada.
