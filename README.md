# Régua — Inteligência operacional

A Régua é uma plataforma de **pré-auditoria e análise da qualidade dos serviços de TI** em prédios e unidades.

> A Régua não é um sistema de chamados. Ela não abre, distribui, encaminha nem encerra chamados no sistema oficial.

## O que faz

- **Pré-auditoria:** o técnico copia ou informa os dados de um chamado que já existe e verifica sua qualidade antes de encerrá-lo no sistema de origem.
- **Auditoria operacional:** analisa registros importados ou cadastrados para identificar volume, encerramentos, tempos, recorrência e qualidade.
- **Relatórios:** organiza indicadores e pontos de atenção para apoiar decisões.

O técnico realiza qualquer correção diretamente no sistema oficial. A Régua não altera o chamado original e não bloqueia seu encerramento.

## Publicação

Aplicação estática em HTML, CSS e JavaScript, preparada para GitHub Pages.

- Código público neste repositório.
- Dados guardados no IndexedDB do navegador.
- Cada técnico terá sua própria base local por navegador/dispositivo.
- **Não há sincronização nem painel consolidado entre usuários nesta versão.**

Para consolidar dados de diferentes técnicos, será necessário adicionar backend, autenticação, banco compartilhado e regras de acesso.

## Privacidade

Não insira dados pessoais ou sensíveis em ambientes públicos de demonstração. Não coloque chaves de API no código público. A integração Gemini será implementada posteriormente com anonimização e arquitetura segura.

## Documentação

Consulte [a especificação funcional](docs/especificacao-funcional.md).

## Desenvolvimento local

Abra a pasta por um servidor HTTP, por exemplo:

```bash
python -m http.server 8000
```

Acesse http://localhost:8000.
