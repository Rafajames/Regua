export const DEFAULT_CRITERIA = [
  {id:'location',dimension:'opening',label:'Local identificável',weight:2},
  {id:'subject',dimension:'opening',label:'Assunto específico',weight:1},
  {id:'symptom',dimension:'opening',label:'Sintoma descrito',weight:2},
  {id:'asset',dimension:'opening',label:'Equipamento ou sistema identificado',weight:1},
  {id:'updates',dimension:'updates',label:'Comentários úteis',weight:2},
  {id:'cause',dimension:'closure',label:'Causa registrada',weight:1},
  {id:'action',dimension:'closure',label:'Ação realizada descrita',weight:2},
  {id:'validation',dimension:'closure',label:'Teste ou confirmação',weight:2},
  {id:'pending',dimension:'closure',label:'Pendências contextualizadas',weight:1}
];
const text = value => String(value ?? '').trim();
function inspect(id,data){
  switch(id){
    case 'location': return {met:!!text(data.building)&&!!text(data.location),evidence:'Prédio e localização informados: '+(!!text(data.building)&&!!text(data.location)?'sim':'não')+'.',recommendation:'Informe prédio, setor, bloco e sala quando aplicável.'};
    case 'subject': return {met:text(data.subject).length>=8,evidence:text(data.subject).length>=8?'Assunto possui conteúdo mínimo.':'Assunto ausente ou muito genérico.',recommendation:'Use um assunto curto que identifique o problema.'};
    case 'symptom': {const s=text(data.description),met=s.length>=30&&!/^(não funciona|nao funciona|problema|erro)$/i.test(s);return {met,evidence:met?'Descrição contém contexto textual suficiente.':'Descrição ausente, curta ou genérica.',recommendation:'Descreva sintoma, contexto e impacto observado.'};}
    case 'asset': {const met=!!text(data.assetType)||!!text(data.asset);return {met,evidence:met?'Tipo de equipamento/sistema ou patrimônio informado.':'Equipamento, sistema ou patrimônio não identificado.',recommendation:'Identifique o equipamento ou sistema; não invente tombamento.'};}
    case 'updates': {const met=text(data.comments).length>=15;return {met,evidence:met?'Há comentários ou atualizações registrados.':'Não há atualização suficiente no campo de comentários.',recommendation:'Registre evolução, tentativas e dependências relevantes.'};}
    case 'cause': {const met=text(data.cause).length>=10;return {met,evidence:met?'Há informação no campo de causa.':'Causa não registrada ou insuficientemente descrita.',recommendation:'Registre a causa encontrada ou indique que permanece em investigação.'};}
    case 'action': {const met=text(data.action).length>=20;return {met,evidence:met?'Ação executada foi descrita.':'Ação ausente ou muito resumida.',recommendation:'Descreva o procedimento efetivamente realizado.'};}
    case 'validation': {const met=text(data.test).length>=10;return {met,evidence:met?'Há registro de teste ou confirmação.':'Não há evidência suficiente de validação.',recommendation:'Registre teste realizado ou confirmação de funcionamento.'};}
    case 'pending': {const hasPending=/(aguardando|pendente|terceiro|depend[eê]ncia)/i.test(text(data.notes)+' '+text(data.comments));const met=!hasPending||text(data.notes).length>=10;return {met,evidence:!hasPending?'Nenhuma pendência explícita identificada nos campos analisados.':met?'Pendência possui contextualização.':'Há indicação de pendência sem contexto ou próximo passo.',recommendation:'Explique motivo da espera e próximo passo.'};}
    default:return {met:false,evidence:'Critério desconhecido.',recommendation:'Revise a configuração do critério.'};
  }
}
export function evaluateQuality(data={},criteria=DEFAULT_CRITERIA){
  const results=criteria.map(c=>{const r=inspect(c.id,data);return {id:c.id,dimension:c.dimension,label:c.label,weight:c.weight,status:r.met?'met':'review',evidence:r.evidence,recommendation:r.recommendation};});
  const dimensions={};
  for(const key of ['opening','updates','closure']){
    const rows=results.filter(r=>r.dimension===key),weight=rows.reduce((s,r)=>s+r.weight,0),earned=rows.filter(r=>r.status==='met').reduce((s,r)=>s+r.weight,0);
    dimensions[key]={score:weight?Math.round(earned/weight*100):null,met:rows.filter(r=>r.status==='met').length,total:rows.length};
  }
  const weight=results.reduce((s,r)=>s+r.weight,0),earned=results.filter(r=>r.status==='met').reduce((s,r)=>s+r.weight,0);
  return {engine:'rules',evaluatedAt:new Date().toISOString(),score:weight?Math.round(earned/weight*100):null,dimensions,criteria:results};
}
