export const DEFAULT_CRITERIA = [
 {id:'location',dimension:'opening',label:'Local identificável',weight:2,fields:['building','location']},
 {id:'subject',dimension:'opening',label:'Assunto específico',weight:1,minLength:{subject:8}},
 {id:'symptom',dimension:'opening',label:'Sintoma descrito',weight:2,minLength:{description:30}},
 {id:'asset',dimension:'opening',label:'Equipamento ou sistema identificado',weight:1,any:['asset','assetType']},
 {id:'updates',dimension:'updates',label:'Comentários úteis',weight:2,minLength:{comments:15}},
 {id:'cause',dimension:'closure',label:'Causa registrada',weight:1,minLength:{cause:10}},
 {id:'action',dimension:'closure',label:'Ação realizada descrita',weight:2,minLength:{action:20}},
 {id:'validation',dimension:'closure',label:'Teste ou confirmação',weight:2,minLength:{test:10}}
];
export function evaluateQuality(data={}, criteria=DEFAULT_CRITERIA) {
 const results=criteria.map(c=>{
  const fields=c.fields||[]; const hasFields=fields.length?fields.every(k=>String(data[k]||'').trim()):true;
  const lengths=c.minLength||{}; const hasLengths=Object.entries(lengths).every(([k,n])=>String(data[k]||'').trim().length>=n);
  const hasAny=c.any?c.any.some(k=>Boolean(String(data[k]||'').trim())):true;
  const met=hasFields&&hasLengths&&hasAny;
  return {id:c.id,dimension:c.dimension,label:c.label,weight:c.weight,status:met?'met':'review',evidence:met?'Informação preenchida conforme regra objetiva.':'Informação ausente ou abaixo do mínimo configurado.'};
 });
 const dimensions={};
 for(const key of ['opening','updates','closure']){
  const rows=results.filter(r=>r.dimension===key), total=rows.reduce((s,r)=>s+r.weight,0), earned=rows.filter(r=>r.status==='met').reduce((s,r)=>s+r.weight,0);
  dimensions[key]={score:total?Math.round(earned/total*100):null,met:rows.filter(r=>r.status==='met').length,total:rows.length};
 }
 return {engine:'rules',evaluatedAt:new Date().toISOString(),dimensions,criteria:results};
}
