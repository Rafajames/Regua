const PROVIDERS={
 gemini:{label:'Google Gemini',kind:'gemini'},
 openai:{label:'OpenAI',kind:'openai'},
 claude:{label:'Anthropic Claude',kind:'anthropic'},
 grok:{label:'xAI Grok',kind:'openai-compatible',baseUrl:'https://api.x.ai/v1'},
 custom:{label:'API compatível com OpenAI',kind:'openai-compatible'}
};
const SYSTEM_PROMPT=`Você é o assistente de documentação técnica da plataforma Régua.
Sua tarefa é transformar solicitação, histórico/comentários e anotações livres do técnico em um rascunho profissional em português do Brasil.
REGRAS OBRIGATÓRIAS:
- Use apenas fatos presentes nas entradas. Nunca invente diagnóstico, ação, equipamento, patrimônio, data, teste, resultado, nome ou autorização.
- Separe claramente: fatos da solicitação, fatos dos comentários anteriores, ações que o técnico diz ter realizado e pendências.
- Não transforme ação solicitada ou sugerida em ação realizada.
- Não declare que o problema foi resolvido, que o chamado foi encerrado ou que houve validação se o técnico não confirmou expressamente.
- Quando houver dados insuficientes, use marcadores [CONFIRMAR: ...] e liste perguntas curtas em missing_information.
- Preserve números de patrimônio, modelos e nomes exatamente como recebidos; sinalize divergências em contradictions.
- Escreva com cordialidade e formalidade, seguindo esta estrutura: saudação; introdução; descrição detalhada dos procedimentos confirmados; pendências/orientações; encerramento condicional; pesquisa de satisfação quando configurada; disponibilidade; assinatura.
- Se ainda não houve atendimento, produza um ESBOÇO que não afirme execução: use formulação futura/condicional e campos a preencher.
Retorne somente JSON válido com: draft (string), facts_used (array), missing_information (array), contradictions (array), pending_items (array), requires_technician_confirmation (boolean).`;
function parseJson(raw){const clean=String(raw||'').replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'');try{return JSON.parse(clean)}catch{throw new Error('A IA não retornou JSON válido. Tente novamente ou escolha outro modelo.')}}
async function geminiModels(key){
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':key}});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error?.message||'Não foi possível listar modelos Gemini.');
 return (b.models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes('generateContent')).map(x=>x.name.replace(/^models\//,''));
}
async function openAiModels(key,base='https://api.openai.com/v1'){
 const r=await fetch(base.replace(/\/$/,'')+'/models',{headers:{Authorization:'Bearer '+key}});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error?.message||'Não foi possível listar modelos deste provedor.');
 return (b.data||[]).map(x=>x.id).filter(Boolean);
}
async function anthropicModels(key){
 const r=await fetch('https://api.anthropic.com/v1/models?limit=100',{headers:{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error?.message||'Não foi possível listar modelos Claude.');
 return (b.data||[]).map(x=>x.id).filter(Boolean);
}
export async function discoverModels(provider,key,customBase=''){
 if(!key?.trim())throw new Error('Informe a chave de API.');
 if(provider==='gemini')return geminiModels(key.trim());
 if(provider==='claude')return anthropicModels(key.trim());
 const base=provider==='grok'?'https://api.x.ai/v1':provider==='custom'?customBase:'https://api.openai.com/v1';
 if(!base)throw new Error('Informe a URL base da API compatível.');
 return openAiModels(key.trim(),base);
}
async function generate(provider,key,model,prompt,customBase='',systemPrompt=SYSTEM_PROMPT){
 if(!key?.trim())throw new Error('Informe uma chave de API.');
 let response,body;
 if(provider==='gemini'){
  const id=(model||'').replace(/^models\//,'');if(!id)throw new Error('Nenhum modelo Gemini compatível foi identificado.');
  response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(id)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key.trim()},body:JSON.stringify({contents:[{role:'user',parts:[{text:systemPrompt+'\n\n'+prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
  body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Gemini retornou HTTP '+response.status);
  return parseJson(body?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n'));
 }
 if(provider==='claude'){
  if(!model)throw new Error('Nenhum modelo Claude foi identificado.');
  response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key.trim(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:3000,system:systemPrompt,messages:[{role:'user',content:prompt}]})});
  body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'Claude retornou HTTP '+response.status);
  return parseJson((body.content||[]).map(x=>x.text||'').join('\n'));
 }
 const base=provider==='grok'?'https://api.x.ai/v1':provider==='custom'?customBase:'https://api.openai.com/v1';
 if(!model)throw new Error('Nenhum modelo foi identificado para este provedor.');
 response=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.trim()},body:JSON.stringify({model,temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:systemPrompt},{role:'user',content:prompt}]})});
 body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error?.message||'A API retornou HTTP '+response.status);
 return parseJson(body?.choices?.[0]?.message?.content);
}
export async function testProviderConnection(provider,key,customBase=''){
 const models=await discoverModels(provider,key,customBase);
 if(!models.length)throw new Error('A chave foi aceita, mas nenhum modelo compatível foi encontrado.');
 return {models,selectedModel:models[0]};
}
export async function generateResolutionDraft({provider='gemini',apiKey,model,customBase='',request='',history='',technicianNotes='',signature='',stage='initial'}){
 const input={solicitacao_original:request,comentarios_historico:history,anotacoes_do_tecnico:technicianNotes,assinatura:signature,etapa:stage};
 const task=stage==='initial'?'Gere um primeiro esboço com base na solicitação e no histórico. Ainda não presuma que o atendimento ocorreu.':'Atualize a minuta após a execução, incorporando somente as ações que o técnico relata ter realizado. Não confunda disponibilização anterior com entrega/instalação já realizada.';
 return generate(provider,apiKey,model,SYSTEM_PROMPT+'\n\n'+task+'\n\nENTRADAS:\n'+JSON.stringify(input),customBase);
}
export async function reviewTicketWithProvider({provider='gemini',apiKey,model,customBase='',data={}}){
 const allowed={subject:data.subject||'',building:data.building||'',location:data.location||'',description:data.description||'',comments:data.comments||'',cause:data.cause||'',action:data.action||'',test:data.test||'',notes:data.notes||'',assetType:data.assetType||''};
 const reviewPrompt='Você é um auditor documental de chamados de suporte de TI. Não invente fatos nem atribua culpa. Diferencie ausência de registro de falha técnica e não presuma resolução. Retorne somente JSON com overall, confidence, findings (criterion, status, evidence, explanation), missing_information, recommendations e human_review.';
 return generate(provider,apiKey,model,'Analise a qualidade documental do chamado. Dados técnicos minimizados:\n'+JSON.stringify(allowed),customBase,reviewPrompt);
}
export async function proposeCriteriaConfiguration(apiKey,model,context='',provider='gemini',customBase=''){
 const current=[{id:'location',label:'Local identificável',weight:2,dimension:'opening'},{id:'subject',label:'Assunto específico',weight:1,dimension:'opening'},{id:'symptom',label:'Sintoma descrito',weight:2,dimension:'opening'},{id:'asset',label:'Equipamento ou sistema identificado',weight:1,dimension:'opening'},{id:'updates',label:'Comentários úteis',weight:2,dimension:'updates'},{id:'cause',label:'Causa registrada',weight:1,dimension:'closure'},{id:'action',label:'Ação realizada descrita',weight:2,dimension:'closure'},{id:'validation',label:'Teste ou confirmação',weight:2,dimension:'closure'},{id:'pending',label:'Pendências contextualizadas',weight:1,dimension:'closure'}];
 const prompt='Proponha critérios objetivos e auditáveis para a Régua. Não crie normas institucionais. Preserve IDs, sugira pesos de 1 a 5 e justifique. Retorne JSON com rationale, criteria, proposed_additions, governance_warnings, human_approval_required=true. Contexto: '+context+' Critérios: '+JSON.stringify(current);
 const criteriaSystem='Você é consultor de desenho de critérios de qualidade para suporte de TI. Retorne somente JSON válido com rationale, criteria, proposed_additions, governance_warnings e human_approval_required=true. Não invente normas institucionais.';
 return generate(provider,apiKey,model,prompt,customBase,criteriaSystem);
}
export {PROVIDERS,SYSTEM_PROMPT};
