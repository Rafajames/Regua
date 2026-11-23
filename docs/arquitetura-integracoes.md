# Arquitetura de integrações — Régua

## Decisão
A Régua consulta somente as plataformas explicitamente configuradas pelo administrador:
1. MapTec: catálogo de prédios, blocos, andares, salas, setores e unidades.
2. Plataforma patrimonial: catálogo de equipamentos e tombamentos, limitado aos campos autorizados.

A Régua não pesquisa Google, não rastreia páginas e não consulta fontes externas genéricas.

## Sincronização
- Agendamento: diariamente às 07:00 no horário de Boa Vista (UTC-4), equivalente a 11:00 UTC.
- Execução manual disponível no GitHub Actions.
- Consultas somente leitura.
- Cada fonte é independente: falha em uma não impede validar a outra.
- Timeout, limite de resposta, validação de JSON e registro de erro.
- Nunca substituir a última cópia válida por resposta vazia, inválida ou incompleta.
- Registrar última tentativa, última sincronização bem-sucedida, duração, quantidade de registros e resultado.
- Repetir manualmente após corrigir indisponibilidade.

## Contrato de API esperado
Cada endpoint deve responder JSON:
```json
{
  "data": [
    {
      "id": "identificador-estavel",
      "name": "exemplo",
      "updatedAt": "2026-11-22T12:00:00Z"
    }
  ],
  "meta": {
    "generatedAt": "2026-11-23T11:00:00Z",
    "version": "opcional"
  }
}
```
O adaptador aceita uma lista em `data` ou um array JSON na raiz. O mapeamento real dos campos será ajustado quando os responsáveis fornecerem a documentação/API de cada plataforma. Não presumir nomes de campos nem URLs.

## Segurança e publicação
O frontend GitHub Pages é público. Portanto:
- tokens ficam exclusivamente em GitHub Actions Secrets;
- nunca incluir segredos em HTML, JavaScript, arquivos versionados ou logs;
- não enviar nomes de solicitantes, comentários de chamados ou outros dados pessoais para um repositório público;
- não publicar inventário/tombamentos até confirmar que o responsável autoriza expressamente a exposição pública desses campos;
- o sincronizador atual valida e gera artefatos de execução; não grava respostas brutas no repositório;
- para dados restritos ou compartilhados entre técnicos, será necessário backend privado com autenticação e controle de acesso. GitHub Pages não é banco privado.

## Estado atual
Os conectores estão preparados para receber endpoints e tokens via Secrets. A integração real permanece pendente até receber URLs, autenticação, contrato e autorização dos dois responsáveis.
