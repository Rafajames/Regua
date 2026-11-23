const API_BASE='https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL='gemini-2.5-flash';
const SYSTEM_PROMPT=`Você é o avaliador assistivo de qualidade da plataforma Régua.
Analise somente o conteúdo fornecido. Não invente fatos, datas, responsáveis, causas, testes ou resultados.
Diferencie ausência de registro de falha técnica. Não atribua culpa ou intenção ao técnico.
Não presuma resolução porque o chamado está encerrado. Não confunda data/hora de solução com duração.
Avalie abertura, identificação/local, diagnóstico, atualizações, causa, ação executada, validação e encerramento.
Para cada achado, indique evidência textual ou declare que não há evidência suficiente.
A avaliação é consultiva e deve ser revisada por uma pessoa. Não altere sistemas externos.
Responda exclusivamente em JSON com as chaves: overall (string), confidence (string), findings (array de objetos com criterion, status, evidence, explanation), missing_information (array), recommendations (array de strings), human_review (array de strings).`;
async function callGemini(apiKey,model,prompt){
  if(!apiKey||!apiKey.trim())throw new Error('Informe uma chave de API.');
  const modelId=(model||DEFAULT_MODEL).trim().replace(/^models\//,'');
  const response=await fetch(API_BASE+encodeURIComponent(modelId)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey.trim()},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.1,responseMimeType:'application/json'}})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error?.message||('Gemini retornou HTTP '+response.status));
  const raw=body?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
  if(!raw)throw new Error('A resposta do Gemini veio vazia.');
  try{return JSON.parse(raw)}catch{throw new Error('O Gemini não retornou JSON válido. Tente outro modelo ou revise o prompt.')}
}
export async function testGeminiConnection(apiKey,model=DEFAULT_MODEL){
  const result=await callGemini(apiKey,model,'Retorne JSON com a propriedade status e o valor connected.');
  if(!result||result.status!=='connected')throw new Error('A resposta de teste não confirmou a conexão.');
  return true;
}
export async function reviewTicketWithGemini(apiKey,model,data={}){
  const allowed={subject:data.subject||'',building:data.building||'',location:data.location||'',description:data.description||'',comments:data.comments||'',cause:data.cause||'',action:data.action||'',test:data.test||'',notes:data.notes||'',assetType:data.assetType||''};
  return callGemini(apiKey,model,SYSTEM_PROMPT+'\n\nCHAMADO PARA ANÁLISE (sem número, solicitante ou técnico):\n'+JSON.stringify(allowed));
}
export {SYSTEM_PROMPT,DEFAULT_MODEL};
