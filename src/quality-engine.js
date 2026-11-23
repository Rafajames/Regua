// Motor determinístico de qualidade da Régua.
// Os pesos são EXPERIMENTAIS e provisórios até aprovação institucional.
// A IA nunca altera a nota calculada aqui.

export const CRITERIA_VERSION = '0.3-experimental';
export const WEIGHTS_ARE_PROVISIONAL = true;

export const DEFAULT_CRITERIA = [
  { id: 'location', dimension: 'opening', label: 'Local identificável', weight: 2 },
  { id: 'subject', dimension: 'opening', label: 'Assunto específico', weight: 1 },
  { id: 'symptom', dimension: 'opening', label: 'Sintoma descrito', weight: 2 },
  { id: 'asset', dimension: 'opening', label: 'Equipamento ou sistema identificado', weight: 1 },
  { id: 'updates', dimension: 'updates', label: 'Comentários úteis', weight: 2 },
  { id: 'cause', dimension: 'closure', label: 'Causa registrada', weight: 1 },
  { id: 'action', dimension: 'closure', label: 'Ação realizada descrita', weight: 2 },
  { id: 'validation', dimension: 'closure', label: 'Teste ou confirmação', weight: 2 },
  { id: 'pending', dimension: 'closure', label: 'Pendências contextualizadas', weight: 1 }
];

export const DIMENSION_LABELS = { opening: 'Abertura', updates: 'Acompanhamento', closure: 'Solução' };

// met: atendido · not_evidenced: sem registro · needs_review: há registro, mas insuficiente/genérico · not_applicable
export const STATUS_LABELS = {
  met: 'Atendido',
  not_evidenced: 'Não evidenciado',
  needs_review: 'Requer revisão',
  not_applicable: 'Não aplicável'
};

const text = value => String(value ?? '').trim();
const GENERIC = /^(não funciona|nao funciona|problema|erro|defeito|ajuda|verificar|suporte)\.?$/i;

// Regra comum: vazio → não evidenciado; preenchido mas abaixo do mínimo → requer revisão.
function byLength(value, min) {
  const v = text(value);
  if (!v) return 'not_evidenced';
  return v.length >= min ? 'met' : 'needs_review';
}

function inspect(id, data) {
  switch (id) {
    case 'location': {
      const b = !!text(data.building), l = !!text(data.location);
      const status = b && l ? 'met' : (b || l ? 'needs_review' : 'not_evidenced');
      return { status, evidence: status === 'met' ? 'Prédio e localização informados.' : status === 'needs_review' ? 'Local parcialmente informado (falta prédio ou setor/sala).' : 'Prédio e localização não informados.', recommendation: 'Informe prédio, setor, bloco e sala quando aplicável.' };
    }
    case 'subject': {
      const status = byLength(data.subject, 8);
      return { status, evidence: status === 'met' ? 'Assunto possui conteúdo mínimo.' : status === 'needs_review' ? 'Assunto muito curto ou genérico.' : 'Assunto ausente.', recommendation: 'Use um assunto curto que identifique o problema.' };
    }
    case 'symptom': {
      const s = text(data.description);
      let status = byLength(s, 30);
      if (status !== 'not_evidenced' && GENERIC.test(s)) status = 'needs_review';
      return { status, evidence: status === 'met' ? 'Descrição contém contexto textual suficiente.' : status === 'needs_review' ? 'Descrição curta ou genérica.' : 'Descrição ausente.', recommendation: 'Descreva sintoma, contexto e impacto observado.' };
    }
    case 'asset': {
      const status = text(data.assetType) || text(data.asset) ? 'met' : 'not_evidenced';
      return { status, evidence: status === 'met' ? 'Tipo de equipamento/sistema ou patrimônio informado.' : 'Equipamento, sistema ou patrimônio não identificado.', recommendation: 'Identifique o equipamento ou sistema; não invente tombamento.' };
    }
    case 'updates': {
      const status = byLength(data.comments, 15);
      return { status, evidence: status === 'met' ? 'Há comentários ou atualizações registrados.' : status === 'needs_review' ? 'Comentário muito resumido.' : 'Não há comentários ou atualizações registrados.', recommendation: 'Registre evolução, tentativas e dependências relevantes.' };
    }
    case 'cause': {
      const status = byLength(data.cause, 10);
      return { status, evidence: status === 'met' ? 'Há informação no campo de causa.' : status === 'needs_review' ? 'Causa registrada de forma muito resumida.' : 'Causa não registrada.', recommendation: 'Registre a causa encontrada ou indique que permanece em investigação.' };
    }
    case 'action': {
      const status = byLength(data.action, 20);
      return { status, evidence: status === 'met' ? 'Ação executada foi descrita.' : status === 'needs_review' ? 'Ação descrita de forma muito resumida.' : 'Ação realizada não registrada.', recommendation: 'Descreva o procedimento efetivamente realizado.' };
    }
    case 'validation': {
      const status = byLength(data.test, 10);
      return { status, evidence: status === 'met' ? 'Há registro de teste ou confirmação.' : status === 'needs_review' ? 'Validação registrada de forma muito resumida.' : 'Não há registro de teste ou confirmação.', recommendation: 'Registre teste realizado ou confirmação de funcionamento.' };
    }
    case 'pending': {
      const hasPending = /(aguardando|pendente|terceiro|depend[eê]ncia|ser[aá] necess[aá]ri|em andamento|agendad|retorno)/i.test(text(data.notes) + ' ' + text(data.comments));
      if (!hasPending) return { status: 'not_applicable', evidence: 'Nenhuma pendência explícita identificada; critério não aplicável.', recommendation: 'Explique motivo da espera e próximo passo.' };
      const status = byLength(data.notes, 10);
      return { status, evidence: status === 'met' ? 'Pendência possui contextualização.' : status === 'needs_review' ? 'Pendência registrada sem contexto suficiente.' : 'Há indicação de pendência sem contexto ou próximo passo.', recommendation: 'Explique motivo da espera e próximo passo.' };
    }
    default:
      return { status: 'needs_review', evidence: 'Critério desconhecido.', recommendation: 'Revise a configuração do critério.' };
  }
}

function scoreOf(rows) {
  const applicable = rows.filter(r => r.status !== 'not_applicable');
  const weight = applicable.reduce((s, r) => s + r.weight, 0);
  const earned = applicable.filter(r => r.status === 'met').reduce((s, r) => s + r.weight, 0);
  return { score: weight ? Math.round(earned / weight * 100) : null, met: applicable.filter(r => r.status === 'met').length, total: applicable.length };
}

export function evaluateQuality(data = {}, criteria = DEFAULT_CRITERIA) {
  const results = criteria.map(c => {
    const r = inspect(c.id, data);
    return { id: c.id, dimension: c.dimension, label: c.label, weight: c.weight, status: r.status, statusLabel: STATUS_LABELS[r.status], evidence: r.evidence, recommendation: r.recommendation };
  });
  const dimensions = {};
  for (const key of ['opening', 'updates', 'closure']) dimensions[key] = scoreOf(results.filter(r => r.dimension === key));
  const overall = scoreOf(results);
  return {
    engine: 'rules',
    criteriaVersion: CRITERIA_VERSION,
    provisionalWeights: WEIGHTS_ARE_PROVISIONAL,
    evaluatedAt: new Date().toISOString(),
    score: overall.score,
    passed: overall.met,
    total: overall.total,
    dimensions,
    criteria: results
  };
}

export function scoreBand(score) {
  if (typeof score !== 'number') return 'none';
  if (score >= 80) return 'good';
  if (score >= 55) return 'fair';
  return 'low';
}
