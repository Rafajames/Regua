# Régua — Inteligência operacional

A Régua é uma plataforma de **pré-auditoria e análise da qualidade dos serviços de TI** em prédios e unidades.

> A Régua não é um sistema de chamados. Ela não abre, distribui, encaminha, atualiza nem encerra chamados no sistema oficial.

## O que faz
- Pré-auditoria de abertura, comentários, causa, ação realizada e validação.
- Indicadores de volume, encerramentos, backlog, tempos e distribuição por local/categoria.
- Comparação de períodos e relatórios com indicação da cobertura dos dados.
- Preparação para consultar exclusivamente MapTec e a plataforma patrimonial indicada pelo administrador.

## Arquitetura
- Frontend estático HTML/CSS/JavaScript preparado para GitHub Pages.
- Histórico legado em IndexedDB local por navegador.
- Snapshot local do catálogo MapTec; ainda não está conectado em tempo real.
- Módulos de lógica em `src/quality-engine.js` e `src/reporting.js`.
- Sincronização diária preparada no GitHub Actions às 07:00 de Boa Vista (11:00 UTC), além de execução manual.
- Conectores dependem de URLs, autenticação e contrato de resposta fornecidos pelos responsáveis.

## Integrações
Consulte [arquitetura de integrações](docs/arquitetura-integracoes.md), [fases 2 e 3](docs/fases-2-e-3.md) e [exemplo de configuração](config/integrations.example.json).

GitHub Actions Secrets esperados:
- `REGUA_MAPTEC_API_URL`
- `REGUA_MAPTEC_API_TOKEN` (se exigido)
- `REGUA_PATRIMONIO_API_URL`
- `REGUA_PATRIMONIO_API_TOKEN` (se exigido)

O workflow valida as APIs e guarda relatório técnico da execução por 30 dias. Nesta etapa ele **não publica payloads das APIs no site nem grava dados brutos no repositório**.

## Privacidade
Nunca coloque tokens no JavaScript público. Não publique nomes de solicitantes, comentários de chamados ou inventário restrito em repositório público. As integrações são somente leitura. Para compartilhar dados de chamados entre técnicos ou armazenar dados restritos, será necessário backend privado, autenticação e autorização. GitHub Pages/IndexedDB não oferecem uma base central privada.

## Desenvolvimento local
```bash
python -m http.server 8000
```
Acesse http://localhost:8000.
