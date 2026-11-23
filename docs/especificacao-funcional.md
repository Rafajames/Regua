# Régua — Especificação funcional

## 1. Propósito
Plataforma de pré-auditoria e inteligência operacional dos serviços de TI. Não abre, distribui, encaminha, atualiza nem encerra chamados no sistema oficial.

## 2. Perfis e fluxos
### Técnico
- Consulta e mensura os próprios atendimentos.
- Realiza pré-auditoria e identifica lacunas de documentação.
- Corrige o chamado diretamente no Aranda; a Régua não escreve na origem.

### Gestor/supervisor
- Executa auditoria independente.
- Obtém o conjunto de chamados diretamente do Aranda por API autorizada ou exportação.
- Filtra por período, técnico, prédio/unidade, categoria e situação, conforme campos disponíveis.
- Não recebe chamados encaminhados pelos técnicos e não depende de submissão individual.
- A visão gerencial completa exige backend privado, perfis e permissões; a importação JSON atual é local e provisória.

## 3. Fontes
- Aranda: fonte dos chamados e histórico de atendimento.
- MapTec: referência de prédios, blocos, andares, salas, setores e unidades.
- Plataforma patrimonial: referência de equipamentos e tombamentos, conforme autorização.
- Não consultar fontes genéricas externas nem realizar crawling público.

## 4. Qualidade
Dimensões: abertura, acompanhamento/comentários e encerramento. Critérios determinísticos em src/quality-engine.js, com pesos iniciais provisórios. Cada resultado apresenta estado, evidência e recomendação. Ausência de dado não deve ser confundida com falha técnica. A IA é assistiva, não altera nota determinística nem decide encerramento.

## 5. Indicadores e relatórios
Total, aberturas, encerramentos, backlog, tempo médio/mediano quando houver datas válidas, distribuição por prédio/categoria/prioridade/técnico, recorrência e cobertura. Cada métrica deve informar período, filtros e quantidade de registros. Não confundir data/hora de solução com duração. SLA e metas dependem de parâmetros oficiais.

## 6. IA
- Gemini inicial por chave individual, mantida apenas em memória nesta versão.
- Teste de conexão e modelo editável.
- Prompt restritivo, resposta JSON e minimização de campos.
- Nenhuma chave é armazenada no repositório.
- Chamada direta do navegador é somente para teste individual; uso institucional exige backend privado.
- Pesos/regras oficiais só podem ser alterados por pessoa autorizada e com versionamento.

## 7. Integrações
- Aranda: adaptador de chamados pendente de API/exportação, autenticação, filtros, paginação e autorização.
- MapTec e patrimônio: APIs autorizadas; sincronização prevista diariamente às 07h de Boa Vista (11h UTC).
- Consultas somente leitura.
- O workflow atual valida endpoints e gera relatório técnico; ainda não publica cache sincronizado.

## 8. Privacidade e arquitetura
GitHub Pages é público; IndexedDB/localStorage são locais ao navegador. Não publicar dados pessoais, chamados ou inventário restrito no repositório. Dados compartilhados exigem backend privado, autenticação, autorização, retenção e trilha de auditoria.

## 9. Fases
1. Base manual e pré-auditoria inicial.
2. Critérios avançados, evidências e IA segura.
3. Indicadores e relatórios.
4. Importação em lote e auditoria gerencial independente.
5. Integração Aranda e backend multiusuário.
6. Sincronização autorizada de catálogos e patrimônio.
